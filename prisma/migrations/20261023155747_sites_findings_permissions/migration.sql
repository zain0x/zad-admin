-- AlterTable
ALTER TABLE `scan_requests` ADD COLUMN `closed_at` DATETIME(3) NULL,
    ADD COLUMN `closed_by_id` VARCHAR(191) NULL,
    ADD COLUMN `due_at` DATETIME(3) NULL,
    ADD COLUMN `summary` TEXT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `perm_certificates` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `perm_emails` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `perm_sites` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `findings` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `severity` ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO') NOT NULL,
    `status` ENUM('OPEN', 'FIXED') NOT NULL DEFAULT 'OPEN',
    `affected` VARCHAR(500) NULL,
    `description` TEXT NOT NULL,
    `steps` TEXT NULL,
    `recommendation` TEXT NULL,
    `author_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `findings_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_files` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `mime` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `storage_key` VARCHAR(100) NOT NULL,
    `uploaded_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `request_files_storage_key_key`(`storage_key`),
    INDEX `request_files_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scan_requests` ADD CONSTRAINT `scan_requests_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `findings` ADD CONSTRAINT `findings_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `scan_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `findings` ADD CONSTRAINT `findings_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_files` ADD CONSTRAINT `request_files_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `scan_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_files` ADD CONSTRAINT `request_files_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
