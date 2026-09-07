-- AlterTable
ALTER TABLE `ConfiguracionNegocio` ADD COLUMN `prefijoPais` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `aceptaWhatsapp` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `aceptaWhatsappEn` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `NotificacionSalida` (
    `id` VARCHAR(191) NOT NULL,
    `citaId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('CONFIRMACION_CITA', 'RECORDATORIO_CITA', 'CANCELACION_CITA') NOT NULL,
    `canal` ENUM('WHATSAPP') NOT NULL DEFAULT 'WHATSAPP',
    `destino` VARCHAR(191) NOT NULL,
    `variables` JSON NOT NULL,
    `estado` ENUM('PENDIENTE', 'ENVIANDO', 'ENVIADA', 'FALLIDA') NOT NULL DEFAULT 'PENDIENTE',
    `intentos` INTEGER NOT NULL DEFAULT 0,
    `proximoIntentoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimoError` TEXT NULL,
    `idExterno` VARCHAR(191) NULL,
    `enviadaEn` DATETIME(3) NULL,
    `entregadaEn` DATETIME(3) NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NotificacionSalida_estado_proximoIntentoEn_idx`(`estado`, `proximoIntentoEn`),
    INDEX `NotificacionSalida_idExterno_idx`(`idExterno`),
    UNIQUE INDEX `NotificacionSalida_citaId_tipo_key`(`citaId`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TokenConfirmacion` (
    `hash` VARCHAR(191) NOT NULL,
    `citaId` VARCHAR(191) NOT NULL,
    `expiraEn` DATETIME(3) NOT NULL,
    `usadoEn` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TokenConfirmacion_citaId_key`(`citaId`),
    PRIMARY KEY (`hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventoWebhook` (
    `id` VARCHAR(191) NOT NULL,
    `canal` ENUM('WHATSAPP') NOT NULL DEFAULT 'WHATSAPP',
    `tipo` VARCHAR(191) NOT NULL,
    `recibidoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NotificacionSalida` ADD CONSTRAINT `NotificacionSalida_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TokenConfirmacion` ADD CONSTRAINT `TokenConfirmacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
