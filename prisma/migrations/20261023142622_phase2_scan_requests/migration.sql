-- CreateTable
CREATE TABLE `scan_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_id` VARCHAR(64) NULL,
    `type` ENUM('SITE', 'LEAK', 'NOTIFY') NOT NULL,
    `status` ENUM('NEW', 'CONTACTED', 'SCANNING', 'REPORT_SENT', 'CONVERTED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `name` VARCHAR(120) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `target` VARCHAR(500) NULL,
    `authorized` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(64) NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(255) NULL,
    `assignee_id` VARCHAR(191) NULL,
    `status_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `scan_requests_external_id_key`(`external_id`),
    INDEX `scan_requests_status_idx`(`status`),
    INDEX `scan_requests_type_idx`(`type`),
    INDEX `scan_requests_created_at_idx`(`created_at`),
    INDEX `scan_requests_email_idx`(`email`),
    INDEX `scan_requests_assignee_id_idx`(`assignee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_notes` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` INTEGER NOT NULL,
    `author_id` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `request_notes_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scan_requests` ADD CONSTRAINT `scan_requests_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_notes` ADD CONSTRAINT `request_notes_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `scan_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_notes` ADD CONSTRAINT `request_notes_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
