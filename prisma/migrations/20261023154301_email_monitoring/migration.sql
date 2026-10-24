-- CreateTable
CREATE TABLE `monitored_emails` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED') NOT NULL DEFAULT 'ACTIVE',
    `frequency` ENUM('WEEKLY', 'MONTHLY') NOT NULL DEFAULT 'WEEKLY',
    `source` VARCHAR(64) NULL,
    `note` VARCHAR(500) NULL,
    `known_breaches` JSON NULL,
    `breach_count` INTEGER NOT NULL DEFAULT 0,
    `has_new_breach` BOOLEAN NOT NULL DEFAULT false,
    `last_new_breach_at` DATETIME(3) NULL,
    `last_checked_at` DATETIME(3) NULL,
    `next_check_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_error` VARCHAR(255) NULL,
    `added_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `monitored_emails_email_key`(`email`),
    INDEX `monitored_emails_status_next_check_at_idx`(`status`, `next_check_at`),
    INDEX `monitored_emails_has_new_breach_idx`(`has_new_breach`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_checks` (
    `id` VARCHAR(191) NOT NULL,
    `email_id` VARCHAR(191) NOT NULL,
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `breach_count` INTEGER NOT NULL DEFAULT 0,
    `new_breaches` JSON NULL,
    `exposed` JSON NULL,
    `error` VARCHAR(255) NULL,

    INDEX `email_checks_email_id_checked_at_idx`(`email_id`, `checked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `breach_check_stats` (
    `id` VARCHAR(191) NOT NULL,
    `email_hash` CHAR(64) NOT NULL,
    `breach_count` INTEGER NOT NULL,
    `breaches` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `breach_check_stats_created_at_idx`(`created_at`),
    INDEX `breach_check_stats_email_hash_idx`(`email_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `monitored_emails` ADD CONSTRAINT `monitored_emails_added_by_id_fkey` FOREIGN KEY (`added_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_checks` ADD CONSTRAINT `email_checks_email_id_fkey` FOREIGN KEY (`email_id`) REFERENCES `monitored_emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
