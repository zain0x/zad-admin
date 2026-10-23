-- CreateTable
CREATE TABLE `certificates` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `type` ENUM('INTERNSHIP', 'ATTENDANCE', 'COURSE') NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `name_ar` VARCHAR(160) NOT NULL,
    `name_en` VARCHAR(160) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL DEFAULT 'MALE',
    `email` VARCHAR(191) NULL,
    `details` JSON NOT NULL,
    `issued_at` DATETIME(3) NOT NULL,
    `batch_id` VARCHAR(32) NULL,
    `issued_by_id` VARCHAR(191) NULL,
    `revoked_at` DATETIME(3) NULL,
    `revoked_by_id` VARCHAR(191) NULL,
    `revoke_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `certificates_code_key`(`code`),
    INDEX `certificates_type_idx`(`type`),
    INDEX `certificates_status_idx`(`status`),
    INDEX `certificates_batch_id_idx`(`batch_id`),
    INDEX `certificates_created_at_idx`(`created_at`),
    INDEX `certificates_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_issued_by_id_fkey` FOREIGN KEY (`issued_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_revoked_by_id_fkey` FOREIGN KEY (`revoked_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
