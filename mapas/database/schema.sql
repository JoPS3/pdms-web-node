/*
  Schema do modulo mapas (autonomo)
  Base de dados alvo: pedaco-mapas
*/

CREATE DATABASE IF NOT EXISTS `pedaco-mapas`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_520_nopad_ci;

USE `pedaco-mapas`;

CREATE TABLE IF NOT EXISTS `diario_caixa` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `data` date NOT NULL,
  `codigo_entidade` varchar(100) NOT NULL,
  `doc_entidade` varchar(100) NOT NULL,
  `doc_interno` varchar(100) NOT NULL,
  `codigo_tipo` varchar(100) NOT NULL,
  `centro_custos` varchar(100) DEFAULT NULL,
  `mapa` varchar(50) NOT NULL,
  `valor` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credito_debito` varchar(10) NOT NULL,
  `conta` varchar(10) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci NOT NULL DEFAULT 'app@pedaco.pt',
  `changed_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `changed_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `diario_caixa_unique` (`data`,`codigo_entidade`,`doc_entidade`,`doc_interno`,`codigo_tipo`,`centro_custos`,`mapa`,`valor`,`credito_debito`,`conta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_nopad_ci;

CREATE TABLE IF NOT EXISTS `auditoria_logs` (
  `id` UUID NOT NULL DEFAULT UUID_v7(),
  `user_id` UUID NOT NULL,
  `acao` varchar(50) NOT NULL,
  `nome_tabela` varchar(100) NOT NULL,
  `registo_id` UUID NOT NULL,
  `payload_alteracoes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload_alteracoes`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tabela_registo` (`nome_tabela`,`registo_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_criado_em` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_nopad_ci;

/*
  Migracao recomendada para ambientes existentes:
  1) preencher UUIDs em linhas antigas sem id_new
  2) promover id_new para PK, removendo id antigo auto_increment

  UPDATE diario_caixa
  SET id_new = UUID_v7()
  WHERE id_new IS NULL OR id_new = '';

  ALTER TABLE diario_caixa
    MODIFY COLUMN id BIGINT(20) UNSIGNED NOT NULL,
    MODIFY COLUMN id_new UUID NOT NULL DEFAULT UUID_v7();

  ALTER TABLE diario_caixa
    DROP PRIMARY KEY,
    DROP COLUMN id,
    CHANGE COLUMN id_new id UUID NOT NULL DEFAULT UUID_v7(),
    ADD PRIMARY KEY (id);
*/