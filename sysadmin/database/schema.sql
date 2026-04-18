/*
  Schema do modulo auth
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
