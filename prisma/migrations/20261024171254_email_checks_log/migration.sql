-- AlterTable
ALTER TABLE `breach_check_stats` ADD COLUMN `email_domain` VARCHAR(191) NULL,
    ADD COLUMN `email_masked` VARCHAR(200) NULL,
    ADD COLUMN `is_company` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `breach_check_stats_email_domain_idx` ON `breach_check_stats`(`email_domain`);
