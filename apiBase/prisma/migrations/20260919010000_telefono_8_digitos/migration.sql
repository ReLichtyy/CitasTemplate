-- El telefono pasa a guardarse en forma local: 8 digitos, sin el prefijo 506 que
-- traian las cuentas existentes. La forma internacional la reconstruye `aE164`
-- con `ConfiguracionNegocio.prefijoPais` al encolar avisos; nada la lee de aqui.
-- Ver src/common/telefono.ts.
--
-- El recorte puede chocar: quien reservo escribiendo "8888 7777" dejo una ficha en
-- forma local, y quien se registro con "50688887777" dejo otra del mismo numero. El
-- unique de `Usuario` reventaria el UPDATE y con ello el arranque del contenedor
-- (el entrypoint reintenta la migracion y termina muriendo). Por eso va en dos pasos:
--
--   1. Absorcion: en cada grupo de duplicados gana la ficha con contrasena —es la que
--      puede entrar—; las que no la tienen entregan sus citas y su ficha de Empleado,
--      y desaparecen. Dos fichas AMBAS con contrasena no se fusionan: eso son dos
--      cuentas reclamadas, y ninguna migracion lo decide por el negocio.
--   2. Recorte solo de las fichas cuya forma local queda libre. Una ficha saltada
--      conserva su 506 delante: queda inalcanzable, pero intacta, y el despliegue no
--      se cae.

-- Tablas de apoyo: viven y mueren dentro de esta misma migracion. Llevan el mismo
-- collation que las tablas de Prisma (utf8mb4_unicode_ci): el de la base es
-- uca1400 en MariaDB 11.4, y cruzar las dos en un JOIN es un "Illegal mix of
-- collations" que no suena a lo que es.
DROP TABLE IF EXISTS `_telefono_formas`;
CREATE TABLE `_telefono_formas` (
    id          VARCHAR(191) NOT NULL PRIMARY KEY,
    formaLocal  VARCHAR(191) NOT NULL,
    puesto      INT          NOT NULL,
    conPassword BOOLEAN      NOT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- La forma local de cada telefono, y el puesto de cada ficha dentro de su grupo:
-- primero las que tienen contrasena, y a igualdad, la mas antigua.
INSERT INTO `_telefono_formas` (id, formaLocal, puesto, conPassword)
SELECT id, formaLocal,
       ROW_NUMBER() OVER (
           PARTITION BY formaLocal
           ORDER BY conPassword DESC, creadoEn, id
       ) AS puesto,
       conPassword
FROM (
    SELECT id, creadoEn, password IS NOT NULL AS conPassword,
           CASE
               WHEN CHAR_LENGTH(telefono) = 11 AND telefono LIKE '506%' THEN SUBSTRING(telefono, 4)
               WHEN CHAR_LENGTH(telefono) = 12 AND telefono LIKE '+506%' THEN SUBSTRING(telefono, 5)
               ELSE telefono
           END AS formaLocal
    FROM `Usuario`
) formas;

DROP TABLE IF EXISTS `_telefono_pares`;
CREATE TABLE `_telefono_pares` (
    perdedorId VARCHAR(191) NOT NULL PRIMARY KEY,
    ganadorId  VARCHAR(191) NOT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Los duplicados que se pueden fusionar sin decidir nada: perdedores sin contrasena
-- contra el puesto 1 de su grupo.
INSERT INTO `_telefono_pares` (perdedorId, ganadorId)
SELECT perdedor.id, ganador.id
FROM `_telefono_formas` perdedor
JOIN `_telefono_formas` ganador
    ON ganador.formaLocal = perdedor.formaLocal AND ganador.puesto = 1
WHERE perdedor.puesto <> 1 AND NOT perdedor.conPassword;

-- Las citas del duplicado apuntan al ganador: quien entre con el telefono las ve.
UPDATE `Cita` cita
JOIN `_telefono_pares` par ON par.perdedorId = cita.clienteId
SET cita.clienteId = par.ganadorId;

UPDATE `Cita` cita
JOIN `_telefono_pares` par ON par.perdedorId = cita.registradaPorId
SET cita.registradaPorId = par.ganadorId;

-- La ficha de Empleado tambien se muda, salvo que el ganador ya tenga una: una persona
-- no tiene dos fichas laborales, y ese caso (dos cuentas reclamadas del mismo numero,
-- ambas con ficha) no se resuelve solo.
UPDATE `Empleado` empleado
JOIN `_telefono_pares` par ON par.perdedorId = empleado.usuarioId
LEFT JOIN `Empleado` delGanador ON delGanador.usuarioId = par.ganadorId
SET empleado.usuarioId = par.ganadorId
WHERE delGanador.id IS NULL;

-- El perdedor desaparece solo si su ficha de Empleado se mudo o nunca la tuvo.
DELETE usuario FROM `Usuario` usuario
JOIN `_telefono_pares` par ON par.perdedorId = usuario.id
LEFT JOIN `Empleado` empleadoPerdedor ON empleadoPerdedor.usuarioId = par.perdedorId
WHERE empleadoPerdedor.id IS NULL;

DROP TABLE IF EXISTS `_telefono_pares`;
DROP TABLE IF EXISTS `_telefono_formas`;

-- El recorte, ya sin choques. Solo toca la ficha cuya forma local esta libre: la tabla
-- derivada se materializa antes del UPDATE, que es lo que permite cruzar `Usuario`
-- consigo mismo. Primero las sin "+": ocupan el lugar y la siguiente pasada lo ve tomado.
UPDATE `Usuario` usuario
LEFT JOIN (
    SELECT DISTINCT telefono FROM `Usuario` WHERE CHAR_LENGTH(telefono) = 8
) ocupado ON ocupado.telefono = SUBSTRING(usuario.telefono, 4)
SET usuario.telefono = SUBSTRING(usuario.telefono, 4)
WHERE CHAR_LENGTH(usuario.telefono) = 11 AND usuario.telefono LIKE '506%'
  AND ocupado.telefono IS NULL;

UPDATE `Usuario` usuario
LEFT JOIN (
    SELECT DISTINCT telefono FROM `Usuario` WHERE CHAR_LENGTH(telefono) = 8
) ocupado ON ocupado.telefono = SUBSTRING(usuario.telefono, 5)
SET usuario.telefono = SUBSTRING(usuario.telefono, 5)
WHERE CHAR_LENGTH(usuario.telefono) = 12 AND usuario.telefono LIKE '+506%'
  AND ocupado.telefono IS NULL;
