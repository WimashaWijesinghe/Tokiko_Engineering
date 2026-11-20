-- Import into a NEW EMPTY database. No DROP/TRUNCATE or automatic overwrite.
SET NAMES utf8mb4;
SET time_zone = '+05:30';

CREATE TABLE `settings` (
  `key` VARCHAR(191) NOT NULL PRIMARY KEY,
  `value` LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(512) NOT NULL,
  `buying_price` DOUBLE DEFAULT 0,
  `selling_price` DOUBLE DEFAULT 0,
  `warranty_months` BIGINT DEFAULT 12,
  `warranty_label` LONGTEXT DEFAULT ('1 Year'),
  `stock_qty` BIGINT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `description` LONGTEXT DEFAULT (''),
  `vat_rate` DOUBLE DEFAULT 0,
  UNIQUE KEY uq_item_name (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customers` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(512) NOT NULL,
  `phone` LONGTEXT DEFAULT (''),
  `address` LONGTEXT DEFAULT (''),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `suppliers` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(512) NOT NULL,
  `phone` LONGTEXT DEFAULT (''),
  `company` LONGTEXT DEFAULT (''),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `quotations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `quote_no` VARCHAR(191) NOT NULL,
  `customer_id` BIGINT,
  `customer_name` LONGTEXT NOT NULL,
  `customer_phone` LONGTEXT DEFAULT (''),
  `customer_address` LONGTEXT DEFAULT (''),
  `subtotal` DOUBLE DEFAULT 0,
  `discount` DOUBLE DEFAULT 0,
  `grand_total` DOUBLE DEFAULT 0,
  `notes` LONGTEXT DEFAULT (''),
  `status` LONGTEXT DEFAULT ('PENDING'),
  `converted_invoice_id` BIGINT,
  `converted_invoice_no` LONGTEXT DEFAULT (''),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `subject` LONGTEXT DEFAULT (''),
  `tax_amount` DOUBLE DEFAULT 0,
  `description` LONGTEXT DEFAULT (''),
  UNIQUE KEY uq_quote_no (`quote_no`),
  KEY idx_quotations_customer_id (`customer_id`),
  KEY idx_quotations_converted_invoice_id (`converted_invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `quotation_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `quotation_id` BIGINT NOT NULL,
  `item_id` BIGINT,
  `item_name` LONGTEXT NOT NULL,
  `serial_numbers` LONGTEXT DEFAULT ('[]'),
  `warranty_months` BIGINT DEFAULT 0,
  `warranty_label` LONGTEXT DEFAULT ('No Warranty'),
  `qty` BIGINT DEFAULT 1,
  `unit_price` DOUBLE DEFAULT 0,
  `item_discount` DOUBLE DEFAULT 0,
  `line_total` DOUBLE DEFAULT 0,
  `item_description` LONGTEXT DEFAULT (''),
  `vat_rate` DOUBLE DEFAULT 0,
  `vat_amount` DOUBLE DEFAULT 0,
  KEY idx_quotation_items_quotation_id (`quotation_id`),
  KEY idx_quotation_items_item_id (`item_id`),
  CONSTRAINT fk_quotation_items_parent FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoices` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `invoice_no` VARCHAR(191) NOT NULL,
  `quotation_id` BIGINT,
  `quote_no` VARCHAR(191) DEFAULT (''),
  `customer_id` BIGINT,
  `customer_name` LONGTEXT NOT NULL,
  `customer_phone` LONGTEXT DEFAULT (''),
  `customer_address` LONGTEXT DEFAULT (''),
  `subtotal` DOUBLE DEFAULT 0,
  `discount` DOUBLE DEFAULT 0,
  `grand_total` DOUBLE DEFAULT 0,
  `paid_amount` DOUBLE DEFAULT 0,
  `balance_due` DOUBLE DEFAULT 0,
  `payment_method` LONGTEXT DEFAULT ('Cash'),
  `payment_status` LONGTEXT DEFAULT ('PAID'),
  `notes` LONGTEXT DEFAULT (''),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `subject` LONGTEXT DEFAULT (''),
  `cheque_no` LONGTEXT DEFAULT (''),
  `cheque_bank` LONGTEXT DEFAULT (''),
  `cheque_date` LONGTEXT DEFAULT (''),
  `payment_ref` LONGTEXT DEFAULT (''),
  `vehicle_no` VARCHAR(191) DEFAULT '',
  `tax_amount` DOUBLE DEFAULT 0,
  `description` LONGTEXT DEFAULT (''),
  UNIQUE KEY uq_invoice_no (`invoice_no`),
  KEY idx_invoices_quotation_id (`quotation_id`),
  KEY idx_invoices_customer_id (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoice_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` BIGINT NOT NULL,
  `item_id` BIGINT,
  `item_name` LONGTEXT NOT NULL,
  `serial_numbers` LONGTEXT DEFAULT ('[]'),
  `warranty_months` BIGINT DEFAULT 0,
  `warranty_label` LONGTEXT DEFAULT ('No Warranty'),
  `qty` BIGINT DEFAULT 1,
  `buying_price` DOUBLE DEFAULT 0,
  `unit_price` DOUBLE DEFAULT 0,
  `item_discount` DOUBLE DEFAULT 0,
  `line_total` DOUBLE DEFAULT 0,
  `item_description` LONGTEXT DEFAULT (''),
  `vat_rate` DOUBLE DEFAULT 0,
  `vat_amount` DOUBLE DEFAULT 0,
  KEY idx_invoice_items_invoice_id (`invoice_id`),
  KEY idx_invoice_items_item_id (`item_id`),
  CONSTRAINT fk_invoice_items_parent FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grns` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `grn_no` VARCHAR(191) NOT NULL,
  `supplier_id` BIGINT,
  `supplier_name` LONGTEXT NOT NULL,
  `supplier_phone` LONGTEXT DEFAULT (''),
  `ref_no` LONGTEXT DEFAULT (''),
  `total_amount` DOUBLE DEFAULT 0,
  `paid_amount` DOUBLE DEFAULT 0,
  `payment_method` LONGTEXT DEFAULT ('Cash'),
  `cheque_no` LONGTEXT DEFAULT (''),
  `cheque_bank` LONGTEXT DEFAULT (''),
  `cheque_date` LONGTEXT DEFAULT (''),
  `cheque_reminder_date` LONGTEXT DEFAULT (''),
  `payment_ref` LONGTEXT DEFAULT (''),
  `notes` LONGTEXT DEFAULT (''),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grn_no (`grn_no`),
  KEY idx_grns_supplier_id (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grn_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `grn_id` BIGINT NOT NULL,
  `item_id` BIGINT,
  `item_name` LONGTEXT NOT NULL,
  `serial_numbers` LONGTEXT DEFAULT ('[]'),
  `warranty_months` BIGINT DEFAULT 0,
  `warranty_label` LONGTEXT DEFAULT ('No Warranty'),
  `qty` BIGINT DEFAULT 1,
  `buying_price` DOUBLE DEFAULT 0,
  `selling_price` DOUBLE DEFAULT 0,
  `line_total` DOUBLE DEFAULT 0,
  `item_description` LONGTEXT DEFAULT (''),
  KEY idx_grn_items_grn_id (`grn_id`),
  KEY idx_grn_items_item_id (`item_id`),
  CONSTRAINT fk_grn_items_parent FOREIGN KEY (`grn_id`) REFERENCES `grns` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `item_serials` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `item_id` BIGINT,
  `item_name` LONGTEXT NOT NULL,
  `serial_number` VARCHAR(512) NOT NULL,
  `status` LONGTEXT DEFAULT ('IN_STOCK'),
  `grn_id` BIGINT,
  `grn_no` VARCHAR(191) DEFAULT (''),
  `invoice_id` BIGINT,
  `invoice_no` VARCHAR(191) DEFAULT (''),
  `warranty_months` BIGINT DEFAULT 0,
  `warranty_label` LONGTEXT DEFAULT ('No Warranty'),
  `sold_date` LONGTEXT,
  `warranty_expiry` LONGTEXT,
  `customer_name` LONGTEXT DEFAULT (''),
  `customer_phone` LONGTEXT DEFAULT (''),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_serial (`serial_number`),
  KEY idx_item_serials_item_id (`item_id`),
  KEY idx_item_serials_grn_id (`grn_id`),
  KEY idx_item_serials_invoice_id (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pos_write_lock (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO pos_write_lock VALUES (1);
