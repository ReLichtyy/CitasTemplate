-- CreateTable
CREATE TABLE `ConfiguracionNegocio` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `nombre` VARCHAR(191) NOT NULL,
    `eslogan` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `colorAcento` VARCHAR(191) NOT NULL DEFAULT '#aa3bff',
    `terminoServicio` VARCHAR(191) NOT NULL DEFAULT 'Servicio',
    `terminoServicioPlural` VARCHAR(191) NOT NULL DEFAULT 'Servicios',
    `terminoEmpleado` VARCHAR(191) NOT NULL DEFAULT 'Profesional',
    `terminoEmpleadoPlural` VARCHAR(191) NOT NULL DEFAULT 'Especialistas',
    `telefonoContacto` VARCHAR(191) NULL,
    `emailContacto` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `locale` VARCHAR(191) NOT NULL DEFAULT 'es',
    `zonaHoraria` VARCHAR(191) NOT NULL DEFAULT 'UTC',
    `actualizadoEn` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NULL,
    `rol` ENUM('ADMIN', 'EMPLEADO', 'CLIENTE') NOT NULL DEFAULT 'CLIENTE',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_telefono_key`(`telefono`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Especialidad` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,

    UNIQUE INDEX `Especialidad_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Empleado` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `especialidadId` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `fotoUrl` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Empleado_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Servicio` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `duracionMinutos` INTEGER NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `imagenUrl` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServicioAdicional` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EstadoCita` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `bloqueaDisponibilidad` BOOLEAN NOT NULL DEFAULT true,
    `permiteEdicion` BOOLEAN NOT NULL DEFAULT true,
    `permiteCancelacionCliente` BOOLEAN NOT NULL DEFAULT false,
    `permiteCancelacionPersonal` BOOLEAN NOT NULL DEFAULT true,
    `esFinal` BOOLEAN NOT NULL DEFAULT false,
    `orden` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `EstadoCita_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HorarioAtencion` (
    `id` VARCHAR(191) NOT NULL,
    `dia` ENUM('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO') NOT NULL,
    `minutoApertura` INTEGER NOT NULL,
    `minutoCierre` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `HorarioAtencion_dia_minutoApertura_key`(`dia`, `minutoApertura`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RestriccionHorario` (
    `id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('FERIADO', 'VACACIONES', 'BLOQUEO') NOT NULL,
    `empleadoId` VARCHAR(191) NULL,
    `inicio` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `motivo` VARCHAR(191) NULL,

    INDEX `RestriccionHorario_empleadoId_inicio_fin_idx`(`empleadoId`, `inicio`, `fin`),
    INDEX `RestriccionHorario_inicio_fin_idx`(`inicio`, `fin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cita` (
    `id` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `registradaPorId` VARCHAR(191) NOT NULL,
    `empleadoId` VARCHAR(191) NOT NULL,
    `servicioId` VARCHAR(191) NOT NULL,
    `estadoId` VARCHAR(191) NOT NULL,
    `inicio` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `slotOcupado` DATETIME(3) NULL,
    `precioServicio` DECIMAL(10, 2) NOT NULL,
    `costoAdicionales` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `costoTotal` DECIMAL(10, 2) NOT NULL,
    `motivoCancelacion` VARCHAR(255) NULL,
    `notas` TEXT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,

    INDEX `Cita_empleadoId_inicio_fin_idx`(`empleadoId`, `inicio`, `fin`),
    INDEX `Cita_clienteId_inicio_idx`(`clienteId`, `inicio`),
    UNIQUE INDEX `Cita_empleadoId_slotOcupado_key`(`empleadoId`, `slotOcupado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CitaAdicional` (
    `citaId` VARCHAR(191) NOT NULL,
    `adicionalId` VARCHAR(191) NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`citaId`, `adicionalId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_EmpleadoServicios` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_EmpleadoServicios_AB_unique`(`A`, `B`),
    INDEX `_EmpleadoServicios_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Empleado` ADD CONSTRAINT `Empleado_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Empleado` ADD CONSTRAINT `Empleado_especialidadId_fkey` FOREIGN KEY (`especialidadId`) REFERENCES `Especialidad`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RestriccionHorario` ADD CONSTRAINT `RestriccionHorario_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `Empleado`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_registradaPorId_fkey` FOREIGN KEY (`registradaPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `Empleado`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_servicioId_fkey` FOREIGN KEY (`servicioId`) REFERENCES `Servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_estadoId_fkey` FOREIGN KEY (`estadoId`) REFERENCES `EstadoCita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitaAdicional` ADD CONSTRAINT `CitaAdicional_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitaAdicional` ADD CONSTRAINT `CitaAdicional_adicionalId_fkey` FOREIGN KEY (`adicionalId`) REFERENCES `ServicioAdicional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_EmpleadoServicios` ADD CONSTRAINT `_EmpleadoServicios_A_fkey` FOREIGN KEY (`A`) REFERENCES `Empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_EmpleadoServicios` ADD CONSTRAINT `_EmpleadoServicios_B_fkey` FOREIGN KEY (`B`) REFERENCES `Servicio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
