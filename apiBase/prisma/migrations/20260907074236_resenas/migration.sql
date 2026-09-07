-- CreateTable
CREATE TABLE `Resena` (
    `id` VARCHAR(191) NOT NULL,
    `empleadoId` VARCHAR(191) NOT NULL,
    `autor` VARCHAR(80) NOT NULL,
    `puntuacion` INTEGER NOT NULL,
    `comentario` TEXT NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `publicada` BOOLEAN NOT NULL DEFAULT false,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Resena_empleadoId_publicada_fecha_idx`(`empleadoId`, `publicada`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Resena` ADD CONSTRAINT `Resena_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `Empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
