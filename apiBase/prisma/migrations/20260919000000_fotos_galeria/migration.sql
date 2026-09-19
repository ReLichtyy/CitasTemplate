-- CreateTable
CREATE TABLE `FotoGaleria` (
    `id` VARCHAR(191) NOT NULL,
    `imagenUrl` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(200) NULL,
    `servicioId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FotoGaleria_servicioId_creadoEn_idx`(`servicioId`, `creadoEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FotoGaleria` ADD CONSTRAINT `FotoGaleria_servicioId_fkey` FOREIGN KEY (`servicioId`) REFERENCES `Servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
