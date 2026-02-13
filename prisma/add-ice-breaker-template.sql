-- Run this manually when migrate dev fails (e.g. no shadow DB permission).
-- Apply via MySQL client, phpMyAdmin, or: mysql -u user -p centxo < prisma/add-ice-breaker-template.sql

CREATE TABLE IF NOT EXISTS `IceBreakerTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `items` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `IceBreakerTemplate_userId_idx`(`userId`),
  CONSTRAINT `IceBreakerTemplate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
