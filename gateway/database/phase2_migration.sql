/*
  Phase 2 Migration: Add refresh token support
  Execution: mysql -u root -p pedaco-000 < phase2_migration.sql
*/

USE `pedaco-000`;

-- 1. Add refresh token columns to sessions table
ALTER TABLE `sessions`
ADD COLUMN `refresh_token` varchar(255) UNIQUE NULL COMMENT 'Opaque refresh token',
ADD COLUMN `refresh_token_expires_at` timestamp NULL COMMENT 'Quando expira o refresh token',
ADD COLUMN `refresh_token_rotated` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Flag para rastrear rotação';

-- Create index for refresh token lookups
CREATE INDEX `sessions_refresh_token_idx` ON `sessions`(`refresh_token`);

-- 2. Create session_refresh_log table for audit trail
CREATE TABLE IF NOT EXISTS `session_refresh_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `session_id` UUID NOT NULL,
  `old_refresh_token` varchar(255) NULL COMMENT 'Token anterior (antes de rotação)',
  `new_refresh_token` varchar(255) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `refreshed_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(100) NOT NULL DEFAULT 'gateway-auth',
  KEY `session_refresh_log_session_id_FK` (`session_id`),
  KEY `session_refresh_log_refreshed_at_idx` (`refreshed_at`),
  CONSTRAINT `session_refresh_log_session_id_FK` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;

-- 3. Verify migration
SELECT 'Migration Phase 2 completed successfully' as status;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'sessions' AND TABLE_SCHEMA = 'pedaco-000' 
ORDER BY ORDINAL_POSITION;
