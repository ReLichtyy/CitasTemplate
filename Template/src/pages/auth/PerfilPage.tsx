import { useState, type FormEvent } from 'react';
import { AuthShell } from '../../components/layout/AuthShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useAuth } from '../../context/AuthContext';
import { authService, type Rol, type UsuarioActual } from '../../services/authService';

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administracion',
  EMPLEADO: 'Equipo',
  CLIENTE: 'Cliente',
};

/** El mismo piso que `PASSWORD_MIN` en el API. Aqui es aviso; alli es la regla. */
const LARGO_MINIMO_PASSWORD = 8;

const PASSWORD_VACIO = { actual: '', nueva: '', confirmacion: '' };

function formularioDe(usuario: UsuarioActual) {
  return {
    nombre: usuario.nombre,
    apellido: usuario.apellido ?? '',
    email: usuario.email ?? '',
  };
}

export function PerfilPage() {
  const { usuario, cargando, setUsuario } = useAuth();

  /**
   * Solo se guarda lo que el usuario escribio. Mientras no toque nada, el formulario se
   * deriva de la ficha del contexto — que puede llegar despues de este primer render,
   * porque `AuthProvider` la pide al arrancar. Sin efecto de por medio no hay forma de
   * que el formulario y la ficha queden desfasados.
   */
  const [editado, setEditado] = useState<ReturnType<typeof formularioDe> | null>(null);
  const [guardado, setGuardado] = useState(false);

  const [password, setPassword] = useState(PASSWORD_VACIO);
  const [desajuste, setDesajuste] = useState<string | null>(null);
  const [passwordCambiada, setPasswordCambiada] = useState(false);

  const guardarPerfil = useAccionApi(authService.actualizarPerfil);
  const cambiarPassword = useAccionApi(authService.cambiarPassword);

  const datos = editado ?? (usuario ? formularioDe(usuario) : null);

  if (!datos || !usuario) {
    return (
      <AuthShell titulo="Mi perfil">
        {cargando ? (
          <Spinner label="Cargando sus datos..." />
        ) : (
          <Alert>No se pudieron cargar sus datos. Recargue la pagina.</Alert>
        )}
      </AuthShell>
    );
  }

  const hayCambios =
    datos.nombre !== usuario.nombre ||
    datos.apellido !== (usuario.apellido ?? '') ||
    datos.email !== (usuario.email ?? '');

  const cambiar = (campo: keyof typeof datos) => (evento: { target: { value: string } }) => {
    setGuardado(false);
    setEditado({ ...datos, [campo]: evento.target.value });
  };

  const cambiarPass =
    (campo: keyof typeof PASSWORD_VACIO) => (evento: { target: { value: string } }) => {
      setDesajuste(null);
      setPasswordCambiada(false);
      setPassword((previo) => ({ ...previo, [campo]: evento.target.value }));
    };

  async function enviarPerfil(evento: FormEvent) {
    evento.preventDefault();
    const actualizado = await guardarPerfil.ejecutar(datos!);
    if (actualizado) {
      setUsuario(actualizado);
      // Se suelta el borrador: el formulario vuelve a derivarse de lo que confirmo el API,
      // que es lo unico que de verdad quedo guardado.
      setEditado(null);
      setGuardado(true);
    }
  }

  async function enviarPassword(evento: FormEvent) {
    evento.preventDefault();
    // Lo unico que el servidor no puede comprobar: que las dos copias coincidan.
    if (password.nueva !== password.confirmacion) {
      setDesajuste('Las contrasenas no coinciden.');
      return;
    }
    setDesajuste(null);
    // Devuelve 204 sin cuerpo, asi que el exito es "no fue null".
    const resultado = await cambiarPassword.ejecutar({
      actual: password.actual,
      nueva: password.nueva,
    });
    if (resultado !== null) {
      setPassword(PASSWORD_VACIO);
      setPasswordCambiada(true);
    }
  }

  const passwordCompleto =
    password.actual !== '' && password.nueva !== '' && password.confirmacion !== '';

  return (
    <AuthShell
      eyebrow="Su cuenta"
      titulo="Mi perfil"
      descripcion="Sus datos y su contrasena. El telefono es su identidad y no se edita desde aqui."
      ancho="ancho"
      // Dos secciones, cada una en su card: el armazon no envuelve.
      enCard={false}
    >
      <Card className="flex flex-col gap-6">
        <section className="flex flex-col gap-1 rounded-lg bg-bg p-4">
          <p className="m-0 text-xs font-medium text-text-muted">Telefono</p>
          <p className="m-0 text-lg font-medium tabular-nums text-text-h">{usuario.telefono}</p>
          <p className="m-0 text-xs text-text">
            Es su identidad en el sistema y no se edita desde aqui: cambiarla es un tramite con
            el negocio. Su acceso es {ETIQUETA_ROL[usuario.rol]}.
          </p>
        </section>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={enviarPerfil} noValidate>
          <h2 className="m-0 text-base sm:col-span-2">Sus datos</h2>

          <Field
            label="Nombre *"
            type="text"
            required
            autoComplete="given-name"
            value={datos.nombre}
            disabled={guardarPerfil.enviando}
            onChange={cambiar('nombre')}
          />
          <Field
            label="Apellido"
            type="text"
            autoComplete="family-name"
            value={datos.apellido}
            disabled={guardarPerfil.enviando}
            onChange={cambiar('apellido')}
          />
          <Field
            wrapperClassName="sm:col-span-2"
            label="Correo (opcional)"
            type="email"
            autoComplete="email"
            hint="Solo para avisos de sus citas. El telefono sigue siendo el usuario."
            value={datos.email}
            disabled={guardarPerfil.enviando}
            onChange={cambiar('email')}
          />

          {guardarPerfil.error && (
            <div className="sm:col-span-2">
              <Alert>{guardarPerfil.error}</Alert>
            </div>
          )}
          {guardado && !hayCambios && (
            <div className="sm:col-span-2">
              <Alert variant="success">Sus datos quedaron guardados.</Alert>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={guardarPerfil.enviando || !hayCambios}>
              {guardarPerfil.enviando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>

      {/* En su propia card y no en la misma: cambiar la credencial no es editar un dato de
          contacto, y meterlo en el mismo formulario invita a mandar las dos cosas juntas. */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-base">Cambiar contrasena</h2>
          <p className="m-0 text-xs text-text">
            Se pide la actual: sin eso, cualquiera que agarre una sesion abierta se queda con
            la cuenta. Las sesiones ya abiertas en otros dispositivos siguen activas hasta que
            vencen.
          </p>
        </div>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={enviarPassword} noValidate>
          <Field
            wrapperClassName="sm:col-span-2"
            label="Contrasena actual *"
            type="password"
            required
            autoComplete="current-password"
            value={password.actual}
            disabled={cambiarPassword.enviando}
            onChange={cambiarPass('actual')}
          />
          <Field
            label="Contrasena nueva *"
            type="password"
            required
            minLength={LARGO_MINIMO_PASSWORD}
            autoComplete="new-password"
            hint={`Minimo ${LARGO_MINIMO_PASSWORD} caracteres.`}
            value={password.nueva}
            disabled={cambiarPassword.enviando}
            onChange={cambiarPass('nueva')}
          />
          <Field
            label="Repita la nueva *"
            type="password"
            required
            autoComplete="new-password"
            value={password.confirmacion}
            disabled={cambiarPassword.enviando}
            onChange={cambiarPass('confirmacion')}
          />

          {(desajuste || cambiarPassword.error) && (
            <div className="sm:col-span-2">
              <Alert>{desajuste ?? cambiarPassword.error}</Alert>
            </div>
          )}
          {passwordCambiada && (
            <div className="sm:col-span-2">
              <Alert variant="success">Su contrasena quedo cambiada.</Alert>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="secondary"
              disabled={cambiarPassword.enviando || !passwordCompleto}
            >
              {cambiarPassword.enviando ? 'Cambiando...' : 'Cambiar contrasena'}
            </Button>
          </div>
        </form>
      </Card>
    </AuthShell>
  );
}
