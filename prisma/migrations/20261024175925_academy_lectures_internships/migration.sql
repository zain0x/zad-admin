-- AlterTable
ALTER TABLE `users` ADD COLUMN `perm_internships` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `perm_lectures` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lectures` (
    `id` VARCHAR(191) NOT NULL,
    `title_ar` VARCHAR(200) NOT NULL,
    `title_en` VARCHAR(200) NULL,
    `speaker` VARCHAR(160) NULL,
    `description` TEXT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `mode` ENUM('IN_PERSON', 'ONLINE') NOT NULL DEFAULT 'IN_PERSON',
    `location` VARCHAR(300) NULL,
    `online_url` VARCHAR(500) NULL,
    `capacity` INTEGER NOT NULL,
    `registration_deadline` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `image_key` VARCHAR(100) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lectures_status_starts_at_idx`(`status`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lecture_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `lecture_id` VARCHAR(191) NOT NULL,
    `name_ar` VARCHAR(160) NOT NULL,
    `name_en` VARCHAR(160) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL DEFAULT 'MALE',
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `status` ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    `attended` BOOLEAN NOT NULL DEFAULT false,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lecture_registrations_code_key`(`code`),
    INDEX `lecture_registrations_lecture_id_status_idx`(`lecture_id`, `status`),
    UNIQUE INDEX `lecture_registrations_lecture_id_email_key`(`lecture_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `internship_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name_ar` VARCHAR(160) NOT NULL,
    `name_en` VARCHAR(160) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL DEFAULT 'MALE',
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `university` VARCHAR(200) NOT NULL,
    `major` VARCHAR(200) NULL,
    `study_year` VARCHAR(60) NULL,
    `field` VARCHAR(100) NOT NULL,
    `bio` TEXT NULL,
    `cv_key` VARCHAR(100) NULL,
    `cv_name` VARCHAR(255) NULL,
    `status` ENUM('NEW', 'REVIEWING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'NEW',
    `supervisor_id` VARCHAR(191) NULL,
    `department` VARCHAR(120) NULL,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `hours` INTEGER NULL,
    `certificate_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `internship_applications_certificate_id_key`(`certificate_id`),
    INDEX `internship_applications_status_idx`(`status`),
    INDEX `internship_applications_created_at_idx`(`created_at`),
    INDEX `internship_applications_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `internship_notes` (
    `id` VARCHAR(191) NOT NULL,
    `application_id` INTEGER NOT NULL,
    `author_id` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `internship_notes_application_id_idx`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lectures` ADD CONSTRAINT `lectures_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecture_registrations` ADD CONSTRAINT `lecture_registrations_lecture_id_fkey` FOREIGN KEY (`lecture_id`) REFERENCES `lectures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `internship_applications` ADD CONSTRAINT `internship_applications_supervisor_id_fkey` FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `internship_notes` ADD CONSTRAINT `internship_notes_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `internship_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `internship_notes` ADD CONSTRAINT `internship_notes_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
