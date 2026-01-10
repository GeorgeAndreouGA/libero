-- ===========================
-- LIBERO BETS - DATABASE SCHEMA
-- ===========================
-- MySQL 8.0+ Database Schema
-- Run this file to create all tables

-- Set character encoding for proper Greek/Unicode support
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ===========================
-- Users Table
-- ===========================
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'user',
  `status` ENUM('pending', 'active', 'inactive', 'suspended') NOT NULL DEFAULT 'pending',
  `email_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `email_verification_token` VARCHAR(255),
  `email_verification_expires` DATETIME,
  `password_reset_token` VARCHAR(255),
  `password_reset_expires` DATETIME,
  `two_factor_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `two_factor_code` VARCHAR(255),
  `two_factor_expires` DATETIME,
  `token_version` INT NOT NULL DEFAULT 0 COMMENT 'Incremented on password change to invalidate all sessions',
  `last_login` DATETIME,
  `date_of_birth` DATE NOT NULL COMMENT 'User date of birth for age verification',
  `age_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `cookie_consent` BOOLEAN NOT NULL DEFAULT FALSE,
  `country_code` VARCHAR(2),
  `preferred_language` ENUM('en', 'el') NOT NULL DEFAULT 'en' COMMENT 'User preferred language',
  `stripe_customer_id` VARCHAR(255) UNIQUE,
  `telegram_user_id` VARCHAR(50) COMMENT 'Telegram user ID for VIP group management',
  `deleted_at` DATETIME,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
  INDEX `idx_username` (`username`),
  INDEX `idx_stripe_customer` (`stripe_customer_id`),
  INDEX `idx_telegram_user` (`telegram_user_id`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`),
  INDEX `idx_email_verification_expires` (`email_verification_expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Categories Table (e.g., Funbet, Hard Bets, Live, etc.)
-- ===========================
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `name_el` VARCHAR(255) COMMENT 'Greek translation of category name',
  `description` TEXT,
  `description_el` TEXT COMMENT 'Greek translation of description',
  `standard_bet` DECIMAL(10,2) NOT NULL COMMENT 'Standard bet amount in EUR - immutable once set',
  `display_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `include_in_statistics` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether to include in public statistics',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_name` (`name`),
  INDEX `idx_display_order` (`display_order`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Packs Table (Free, VIP Silver, VIP Gold, VIP Elite)
-- ===========================
CREATE TABLE IF NOT EXISTS `packs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `description` TEXT,
  `price_monthly` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `display_order` INT NOT NULL DEFAULT 0,
  `is_free` BOOLEAN NOT NULL DEFAULT FALSE,
  `stripe_product_id` VARCHAR(255),
  `stripe_price_id` VARCHAR(255),
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_name` (`name`),
  INDEX `idx_display_order` (`display_order`),
  INDEX `idx_is_free` (`is_free`),
  INDEX `idx_stripe_price` (`stripe_price_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Pack Hierarchy Table (defines pack inheritance)
-- ===========================
CREATE TABLE IF NOT EXISTS `pack_hierarchy` (
  `id` VARCHAR(36) PRIMARY KEY,
  `pack_id` VARCHAR(36) NOT NULL COMMENT 'The pack that includes other packs',
  `includes_pack_id` VARCHAR(36) NOT NULL COMMENT 'The pack that is included',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`includes_pack_id`) REFERENCES `packs`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_pack_inclusion` (`pack_id`, `includes_pack_id`),
  INDEX `idx_pack` (`pack_id`),
  INDEX `idx_includes_pack` (`includes_pack_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Pack Categories Table (links categories to packs)
-- ===========================
CREATE TABLE IF NOT EXISTS `pack_categories` (
  `id` VARCHAR(36) PRIMARY KEY,
  `pack_id` VARCHAR(36) NOT NULL,
  `category_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_pack_category` (`pack_id`, `category_id`),
  INDEX `idx_pack` (`pack_id`),
  INDEX `idx_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Subscriptions Table
-- ===========================
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `pack_id` VARCHAR(36) NOT NULL,
  `previous_pack_id` VARCHAR(36) COMMENT 'Previous pack ID if this was an upgrade (for refund handling)',
  `status` ENUM('ACTIVE', 'CANCELLED', 'PAST_DUE', 'PAUSED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `stripe_subscription_id` VARCHAR(255) UNIQUE,
  `current_period_start` DATETIME,
  `current_period_end` DATETIME,
  `cancel_at_period_end` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_upgrade` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this subscription was created as an upgrade',
  `upgrade_from_subscription_id` VARCHAR(36) COMMENT 'ID of the subscription this upgraded from (for refund handling)',
  `cancelled_at` DATETIME,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON DELETE RESTRICT,
  UNIQUE KEY `unique_user_pack_subscription` (`user_id`, `pack_id`, `stripe_subscription_id`),
  INDEX `idx_user` (`user_id`),
  INDEX `idx_pack` (`pack_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_stripe_subscription` (`stripe_subscription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Bets Table (linked to categories)
-- ===========================
CREATE TABLE IF NOT EXISTS `bets` (
  `id` VARCHAR(36) PRIMARY KEY,
  `category_id` VARCHAR(36) NOT NULL,
  `image_url` VARCHAR(500),
  `odds` VARCHAR(50),
  `match_info` JSON,
  `analysis` TEXT,
  `result` ENUM('IN_PROGRESS', 'WIN', 'LOST', 'CASH_OUT') NOT NULL DEFAULT 'IN_PROGRESS',
  `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `published_at` DATETIME,
  `created_by` VARCHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  INDEX `idx_category` (`category_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_result` (`result`),
  INDEX `idx_published_at` (`published_at`),
  INDEX `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Transactions Table
-- ===========================
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `subscription_id` VARCHAR(36),
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  `stripe_payment_intent_id` VARCHAR(255),
  `stripe_invoice_id` VARCHAR(255),
  `description` TEXT,
  `metadata` JSON,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL,
  INDEX `idx_user` (`user_id`),
  INDEX `idx_subscription` (`subscription_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_stripe_payment` (`stripe_payment_intent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Audit Logs Table
-- ===========================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36),
  `action` VARCHAR(255) NOT NULL,
  `entity_type` VARCHAR(100),
  `entity_id` VARCHAR(36),
  `changes` JSON,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_user` (`user_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_entity` (`entity_type`, `entity_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Security Events Table (Login attempts, password changes, etc.)
-- ===========================
CREATE TABLE IF NOT EXISTS `security_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `event_type` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET', '2FA_SUCCESS', '2FA_FAILED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'ADMIN_ACTION') NOT NULL,
  `user_id` VARCHAR(36),
  `email_or_username` VARCHAR(255) COMMENT 'For failed logins where user may not exist',
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `details` JSON COMMENT 'Additional event details',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_user` (`user_id`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_failed_logins` (`ip_address`, `event_type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Webhook Events Table
-- ===========================
CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `provider` VARCHAR(50) NOT NULL COMMENT 'stripe, paypal, etc',
  `event_id` VARCHAR(255) NOT NULL COMMENT 'External event ID for idempotency',
  `event_type` VARCHAR(100) NOT NULL,
  `payload` JSON NOT NULL,
  `processed` BOOLEAN NOT NULL DEFAULT FALSE,
  `processed_at` DATETIME,
  `error` TEXT,
  `retry_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_provider_event` (`provider`, `event_id`),
  INDEX `idx_processed` (`processed`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Historical Statistics Table (Legacy data before system launch)
-- Stores monthly profit/loss data from before the new betting system
-- Used to display historical performance alongside calculated statistics
-- ===========================
CREATE TABLE IF NOT EXISTS `historical_statistics` (
  `id` VARCHAR(36) PRIMARY KEY,
  `year` INT NOT NULL,
  `month` INT NOT NULL COMMENT '1-12',
  `is_profit` BOOLEAN NOT NULL COMMENT 'TRUE = Profit/ΚΕΡΔΟΣ, FALSE = Loss/ΖΗΜΙΑ',
  `amount` DECIMAL(10,2) NOT NULL COMMENT 'Monthly profit or loss amount in EUR',
  `running_total` DECIMAL(10,2) NOT NULL COMMENT 'Cumulative total (ΣΥΝΟΛΟ)',
  `notes` TEXT COMMENT 'Optional notes about this month',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_year_month` (`year`, `month`),
  INDEX `idx_year` (`year`),
  INDEX `idx_year_month` (`year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================
-- Historical Statistics Seed Data (Legacy data from 2024-2025)
-- Based on Standard Bet stakes: €100 Premium, €50 Premium Live, €30 Parlay, €15 Live, €10 Hard Bets
-- Note: UFC and Funbets are NOT counted in these statistics
-- ===========================
INSERT INTO `historical_statistics` (`id`, `year`, `month`, `is_profit`, `amount`, `running_total`, `notes`) VALUES
-- 2024 Data
(UUID(), 2024, 11, TRUE, 1189.00, 1189.00, 'November 2024'),
(UUID(), 2024, 12, TRUE, 706.00, 1895.00, 'December 2024'),
-- 2025 Data
(UUID(), 2025, 1, TRUE, 1093.00, 1093.00, 'January 2025 - New year reset'),
(UUID(), 2025, 2, TRUE, 409.00, 1502.00, 'February 2025'),
(UUID(), 2025, 3, TRUE, 64.00, 1566.00, 'March 2025'),
(UUID(), 2025, 4, TRUE, 794.00, 2360.00, 'April 2025'),
(UUID(), 2025, 5, FALSE, 183.00, 2177.00, 'May 2025 - Loss month'),
(UUID(), 2025, 6, TRUE, 223.00, 2400.00, 'June 2025'),
(UUID(), 2025, 7, TRUE, 9.00, 2409.00, 'July 2025'),
(UUID(), 2025, 8, TRUE, 1456.00, 3505.00, 'August 2025'),
(UUID(), 2025, 9, TRUE, 1560.00, 5065.00, 'September 2025'),
(UUID(), 2025, 10, TRUE, 601.00, 5666.00, 'October 2025'),
(UUID(), 2025, 11, TRUE, 78.00, 5744.00, 'November 2025'),
(UUID(), 2025, 12, FALSE, 398.00, 5346.00, 'December 2025')
ON DUPLICATE KEY UPDATE 
  `is_profit` = VALUES(`is_profit`),
  `amount` = VALUES(`amount`),
  `running_total` = VALUES(`running_total`),
  `notes` = VALUES(`notes`);


-- ===========================
-- Default Categories Seed Data
-- IMPORTANT: Adjust standard_bet values here before first deployment
-- standard_bet is IMMUTABLE once the category is created!
-- ===========================
INSERT INTO `categories` (`id`, `name`, `name_el`, `description`, `description_el`, `standard_bet`, `display_order`, `is_active`, `include_in_statistics`) VALUES
('cat-funbet', 'Funbet', 'Funbet', 'Deeply Researched Low Stake bets. High Risk, High Reward', 'Στοιχήματα Χαμηλού Πονταρίσματος με Βαθιά Έρευνα. Υψηλό Ρίσκο, Υψηλή Απόδοση', 5.00, 1, TRUE, TRUE),
('cat-hardbets', 'Hard Bets', 'Δύσκολα Bets', 'Risky Bet with Combined Small Odds Selections', 'Ριψοκίνδυνα Στοιχήματα με Συνδυασμένες Χαμηλές Αποδόσεις', 10.00, 2, TRUE, TRUE),
('cat-live', 'Live', 'Live', 'Live in-play Betting Tips', 'Στοιχηματικές Συμβουλές για Ζωντανά Παιχνίδια', 0.00, 3, TRUE, FALSE),
('cat-parlay', 'Parlay', 'Παρολί', 'Safe Combined Games with Our Goal being Around 2.00 Odds', 'Ασφαλή Συνδυαστικά Παιχνίδια με Στόχο Αποδόσεις γύρω στο 2.00', 25.00, 4, TRUE, TRUE),
('cat-ufc', 'UFC', 'UFC', 'UFC Betting Tips', 'Στοιχηματικές Συμβουλές UFC', 0.00, 5, TRUE, FALSE),
('cat-smallinfo', 'Small Info Bets', 'Μικρές Πληροφορίες', 'Smaller Stake Insider Info Games', 'Παιχνίδια με Μικρό Ποντάρισμα και Εσωτερικές Πληροφορίες', 12.00, 6, TRUE, TRUE),
('cat-doublebets', 'Double Bets', 'Διπλασιασμός', 'The Best Possible Picks for A Safe 2.00 Odds Flip after our Super Deep Research', 'Οι Καλύτερες Δυνατές Επιλογές για Ασφαλή Απόδοση 2.00 μετά από Πολύ Βαθιά Έρευνά μας', 50.00, 7, TRUE, TRUE),
('cat-sbt', 'SBT', 'SBT', 'Scanning the Market 24/7 with our Unique Expensive Tools for the Best Possible 2.00 Odds Money Flip on a Live Game. Sports Betting Trading - The Future of Betting', 'Σκανάρουμε την Αγορά 24/7 με τα Μοναδικά Ακριβά Εργαλεία μας για την Καλύτερη Δυνατή Απόδοση 2.00 σε Ζωντανό Παιχνίδι. Sports Betting Trading - Το Μέλλον του Στοιχήματος', 20.00, 8, TRUE, TRUE),
('cat-ufcvip', 'UFC VIP', 'UFC VIP', 'The Best and Most Well Researched Picks for UFC Fight Night with a Goal of the Safest Possible 2.00 Odds', 'Οι Καλύτερες και πιο Καλά Ερευνημένες Επιλογές για τις Βραδιές UFC με Στόχο την πιο Ασφαλή Απόδοση 2.00', 20.00, 9, TRUE, TRUE),
('cat-eliteinfo', 'Elite Info Bets', 'Elite Πληροφορίες', 'The most Unique and Rare Insider Info on the Market', 'Οι πιο Μοναδικές και Σπάνιες Εσωτερικές Πληροφορίες στην Αγορά', 60.00, 10, TRUE, TRUE)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- ===========================
-- Default Packs Seed Data
-- ===========================
INSERT INTO `packs` (`id`, `name`, `description`, `price_monthly`, `currency`, `display_order`, `is_free`, `is_active`) VALUES
('pack-free', 'Free Pack', 'Free betting tips for all users', 0.00, 'EUR', 1, TRUE, TRUE),
('pack-silver', 'VIP Silver', 'Silver tier premium betting tips', 20.00, 'EUR', 2, FALSE, TRUE),
('pack-gold', 'VIP Gold', 'Gold tier premium betting tips with insider info', 50.00, 'EUR', 3, FALSE, TRUE),
('pack-elite', 'VIP Elite', 'Elite tier with exclusive premium tips', 80.00, 'EUR', 4, FALSE, TRUE)
ON DUPLICATE KEY UPDATE `id` = `id`;


-- ===========================
-- Pack Categories (linking packs to categories)
-- ===========================
INSERT INTO `pack_categories` (`id`, `pack_id`, `category_id`) VALUES
-- Free Pack: Funbet, Live, UFC, Hard Bets, Parlay
(UUID(), 'pack-free', 'cat-funbet'),
(UUID(), 'pack-free', 'cat-live'),
(UUID(), 'pack-free', 'cat-ufc'),
(UUID(), 'pack-free', 'cat-hardbets'),
(UUID(), 'pack-free', 'cat-parlay'),
-- VIP Silver: Small Info Bets
(UUID(), 'pack-silver', 'cat-smallinfo'),
-- VIP Gold: Double Bets, SBT, UFC VIP
(UUID(), 'pack-gold', 'cat-doublebets'),
(UUID(), 'pack-gold', 'cat-sbt'),
(UUID(), 'pack-gold', 'cat-ufcvip'),
-- VIP Elite: Elite Info Bets
(UUID(), 'pack-elite', 'cat-eliteinfo')
ON DUPLICATE KEY UPDATE `id` = `id`;


-- ===========================
-- Pack Hierarchy (higher packs include lower packs)
-- ===========================
INSERT INTO `pack_hierarchy` (`id`, `pack_id`, `includes_pack_id`) VALUES
-- VIP Silver includes Free Pack
(UUID(), 'pack-silver', 'pack-free'),
-- VIP Gold includes VIP Silver (and by extension Free Pack)
(UUID(), 'pack-gold', 'pack-silver'),
(UUID(), 'pack-gold', 'pack-free'),
-- VIP Elite includes VIP Gold (and by extension Silver and Free)
(UUID(), 'pack-elite', 'pack-gold'),
(UUID(), 'pack-elite', 'pack-silver'),
(UUID(), 'pack-elite', 'pack-free')
ON DUPLICATE KEY UPDATE `id` = `id`;
