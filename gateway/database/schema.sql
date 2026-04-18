/*
  Schema do gateway
  Base de dados alvo: pedaco-000
*/

CREATE DATABASE IF NOT EXISTS `pedaco-000`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_520_nopad_ci;

USE `pedaco-000`;

CREATE TABLE IF NOT EXISTS `users_role` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `role` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) NOT NULL DEFAULT 'app@pedaco.pt',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `old_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_role_unique` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `role_id` UUID NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `user_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) DEFAULT NULL COMMENT 'Password do utilizador',
  `is_authorized` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) NOT NULL DEFAULT 'app@pedaco.pt',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `old_id` bigint(20) unsigned DEFAULT NULL,
  `old_role_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_name_unique` (`user_name`),
  KEY `users_users_role_FK` (`role_id`),
  CONSTRAINT `users_users_role_FK` FOREIGN KEY (`role_id`) REFERENCES `users_role` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `user_id` UUID NOT NULL,
  `session_token` varchar(255) NOT NULL UNIQUE COMMENT 'Token da sessão (hash)',
  `refresh_token` varchar(255) UNIQUE NULL COMMENT 'Opaque refresh token',
  `refresh_token_expires_at` timestamp NULL COMMENT 'Quando expira o refresh token',
  `refresh_token_rotated` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Flag para rastrear rotação',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IPv4 ou IPv6',
  `user_agent` varchar(500) DEFAULT NULL,
  `expires_at` timestamp NOT NULL COMMENT 'Quando expira a sessão',
  `last_activity` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_valid` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Flag para logout sem eliminar',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) NOT NULL DEFAULT 'app@pedaco.pt',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessions_token_unique` (`session_token`),
  KEY `sessions_refresh_token_idx` (`refresh_token`),
  KEY `sessions_user_id_FK` (`user_id`),
  KEY `sessions_expires_at_idx` (`expires_at`),
  CONSTRAINT `sessions_user_id_FK` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;

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

CREATE TABLE IF NOT EXISTS `onedrive_connections` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `owner_user_id` UUID NOT NULL,
  `provider` varchar(20) NOT NULL DEFAULT 'onedrive',
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `tenant_id` varchar(100) DEFAULT NULL,
  `drive_id` varchar(100) DEFAULT NULL,
  `account_email` varchar(190) DEFAULT NULL,
  `connected_at` timestamp NULL DEFAULT NULL,
  `last_check_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) NOT NULL DEFAULT 'gateway-onedrive',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `onedrive_connections_user_idx` (`owner_user_id`),
  CONSTRAINT `onedrive_connections_user_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;

CREATE TABLE IF NOT EXISTS `onedrive_tokens` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `connection_id` UUID NOT NULL,
  `access_token_enc` text NOT NULL,
  `refresh_token_enc` text NOT NULL,
  `access_expires_at` timestamp NOT NULL,
  `scope` text DEFAULT NULL,
  `token_type` varchar(30) DEFAULT 'Bearer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) NOT NULL DEFAULT 'gateway-onedrive',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `onedrive_tokens_connection_idx` (`connection_id`),
  CONSTRAINT `onedrive_tokens_connection_fk` FOREIGN KEY (`connection_id`) REFERENCES `onedrive_connections` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;

CREATE TABLE IF NOT EXISTS `onedrive_auth_states` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `owner_user_id` UUID NOT NULL,
  `connection_id` UUID NOT NULL,
  `state_token` varchar(128) NOT NULL,
  `code_verifier` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) NOT NULL DEFAULT 'gateway-onedrive',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `onedrive_auth_states_state_unique` (`state_token`),
  KEY `onedrive_auth_states_user_idx` (`owner_user_id`),
  KEY `onedrive_auth_states_connection_idx` (`connection_id`),
  CONSTRAINT `onedrive_auth_states_user_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `onedrive_auth_states_connection_fk` FOREIGN KEY (`connection_id`) REFERENCES `onedrive_connections` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;

CREATE TABLE IF NOT EXISTS `onedrive_settings` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `provider` varchar(20) NOT NULL DEFAULT 'onedrive',
  `client_id` varchar(190) NOT NULL,
  `client_secret_enc` text NOT NULL,
  `tenant_id` varchar(100) NOT NULL DEFAULT 'common',
  `scopes` text NOT NULL,
  `redirect_uri` varchar(255) DEFAULT NULL,
  `gateway_public_base_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) NOT NULL DEFAULT 'gateway-onedrive-setup',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `onedrive_settings_provider_unique` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_nopad_ci;