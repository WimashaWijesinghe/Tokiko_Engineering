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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customers` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(512) NOT NULL,
  `phone` LONGTEXT DEFAULT (''),
  `address` LONGTEXT DEFAULT (''),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `tax_amount` DOUBLE DEFAULT 0,
  `description` LONGTEXT DEFAULT (''),
  UNIQUE KEY uq_invoice_no (`invoice_no`),
  KEY idx_invoices_quotation_id (`quotation_id`),
  KEY idx_invoices_customer_id (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grns` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `grn_no` VARCHAR(191) NOT NULL,
  `supplier_id` BIGINT,
  `supplier_name` LONGTEXT NOT NULL,
  `supplier_phone` LONGTEXT DEFAULT (''),
  `ref_no` LONGTEXT DEFAULT (''),
  `total_amount` DOUBLE DEFAULT 0,
  `paid_amount` DOUBLE DEFAULT 0,
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pos_write_lock (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO pos_write_lock VALUES (1);


START TRANSACTION;
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x73686f705f6e616d65 USING utf8mb4),CONVERT(0x504f532053595354454d USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x73686f705f7461676c696e65 USING utf8mb4),CONVERT(0x5052454d49554d205445434820262052455441494c20534f4c5554494f4e53 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x73686f705f61646472657373 USING utf8mb4),CONVERT(0x4e6f2e203132352c204d61696e205374726565742c20436f6c6f6d626f USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x73686f705f70686f6e65 USING utf8mb4),CONVERT(0x3037372d31323334353637202f203031312d32333435363738 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x73686f705f656d61696c USING utf8mb4),CONVERT(0x696e666f406e65787467656e746563682e6c6b USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x63757272656e6379 USING utf8mb4),CONVERT(0x52732e USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x696e766f6963655f7465726d73 USING utf8mb4),CONVERT(0x476f6f6473206f6e636520736f6c642077696c6c206e6f742062652074616b656e206261636b2e20506c65617365206272696e67207468697320696e766f69636520666f7220616e792077617272616e747920636c61696d732e USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x696e766f6963655f6c61796f75745f7374796c65 USING utf8mb4),CONVERT(0x4d4f4445524e USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x636173686965725f6e616d65 USING utf8mb4),CONVERT('' USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x7265705f6e616d65 USING utf8mb4),CONVERT('' USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x6272616e63685f6c6f636174696f6e USING utf8mb4),CONVERT(0x53484f50202d204b5552554e4547414c4120323030 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x7661745f7265675f6e6f USING utf8mb4),CONVERT(0x3239343030313438342d37303030 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x666f6f7465725f636f70795f6c6162656c USING utf8mb4),CONVERT(0x435553544f4d4552275320434f5059 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x7661745f726174655f70657263656e74 USING utf8mb4),CONVERT(0x3138 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x696e766f6963655f7469746c65 USING utf8mb4),CONVERT(0x54617820496e766f696365 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x7374616d705f74657874 USING utf8mb4),CONVERT(0x4352454449542053414c450a537269204c616e6b612053746174652054726164696e67202847656e2e2920436f722e4c74640a4b7572756e6567616c612053686f77726f6f6d USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x766572696669636174696f6e5f7374616d705f7469746c65 USING utf8mb4),CONVERT(0xe0b6b4e0b6bbe0b793e0b69ae0b78ae0b782e0b78f20e0b69ae0b785e0b78f USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x766572696669636174696f6e5f7374616d705f64657074 USING utf8mb4),CONVERT(0xe0b686e0b6bbe0b69ae0b78ae0b782e0b69a20e0b685e0b682e0b781e0b6ba202f20e0b6b4e0b78ae2808de0b6bbe0b6afe0b6bbe0b78ae0b781e0b6b1e0b78fe0b69ce0b78fe0b6bbe0b6ba USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x6465636c61726174696f6e5f74657874 USING utf8mb4),CONVERT(0x5265636569766564207468652061626f7665206974656d7320696e20676f6f6420636f6e646974696f6e2e USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x73686f775f64697370617463685f76656869636c65 USING utf8mb4),CONVERT(0x31 USING utf8mb4));
INSERT INTO `settings` (`key`,`value`) VALUES (CONVERT(0x7072696e7465725f6e616d65 USING utf8mb4),CONVERT(0x504f535072696e74657220504f533830 USING utf8mb4));
INSERT INTO `items` (`id`,`name`,`buying_price`,`selling_price`,`warranty_months`,`warranty_label`,`stock_qty`,`created_at`,`updated_at`,`description`,`vat_rate`) VALUES (1,CONVERT(0x4b696e6773746f6e204e5632203530304742204e564d6520535344 USING utf8mb4),10500,12500,36,CONVERT(0x33205965617273 USING utf8mb4),8,CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4),CONVERT(0x5043496520342e30204e564d65204d2e3220323238302c20557020746f20333530304d422f732052656164205370656564 USING utf8mb4),0);
INSERT INTO `items` (`id`,`name`,`buying_price`,`selling_price`,`warranty_months`,`warranty_label`,`stock_qty`,`created_at`,`updated_at`,`description`,`vat_rate`) VALUES (2,CONVERT(0x4c6f6769746563682047313032204c6967687473796e632047616d696e67204d6f757365 USING utf8mb4),6200,7500,12,CONVERT(0x312059656172 USING utf8mb4),12,CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4),CONVERT(0x3830303020445049204f70746963616c2053656e736f722c20524742204c6967687473796e632c20362050726f6772616d6d61626c6520427574746f6e73 USING utf8mb4),0);
INSERT INTO `items` (`id`,`name`,`buying_price`,`selling_price`,`warranty_months`,`warranty_label`,`stock_qty`,`created_at`,`updated_at`,`description`,`vat_rate`) VALUES (3,CONVERT(0x48696b766973696f6e20324d5020436f6c6f7256752042756c6c65742043616d657261 USING utf8mb4),7800,9500,24,CONVERT(0x32205965617273 USING utf8mb4),14,CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4),CONVERT(0x323032362d31312d31312031323a33353a3536 USING utf8mb4),CONVERT(0x5b51544e2d303030345d2031303830702046756c6c2048442c2032342f372046756c6c2054696d6520436f6c6f722c2049503637205765617468657270726f6f662c2032306d2044697374616e6365 USING utf8mb4),0);
INSERT INTO `items` (`id`,`name`,`buying_price`,`selling_price`,`warranty_months`,`warranty_label`,`stock_qty`,`created_at`,`updated_at`,`description`,`vat_rate`) VALUES (4,CONVERT(0x436f72736169722056656e6765616e6365204c505820384742204444523420333230304d487a2052414d USING utf8mb4),7000,100000,12,CONVERT(0x312059656172 USING utf8mb4),8,CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4),CONVERT(0x323032362d31312d31312031333a30383a3035 USING utf8mb4),CONVERT(0x5b51544e2d303030335d2038474220283178384742292044445234204452414d20333230304d487a20433136204d656d6f7279204b6974202d20426c61636b USING utf8mb4),0);
INSERT INTO `items` (`id`,`name`,`buying_price`,`selling_price`,`warranty_months`,`warranty_label`,`stock_qty`,`created_at`,`updated_at`,`description`,`vat_rate`) VALUES (5,CONVERT(0x3234222049505320313030487a204672616d656c657373204d6f6e69746f72 USING utf8mb4),28500,33500,36,CONVERT(0x33205965617273 USING utf8mb4),1,CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4),CONVERT(0x323032362d31312d31312031323a33353a3536 USING utf8mb4),CONVERT(0x5b51544e2d303030335d2046756c6c20484420313932307831303830204950532050616e656c2c20313030487a205265667265736820526174652c2048444d49202620564741 USING utf8mb4),0);
INSERT INTO `items` (`id`,`name`,`buying_price`,`selling_price`,`warranty_months`,`warranty_label`,`stock_qty`,`created_at`,`updated_at`,`description`,`vat_rate`) VALUES (6,CONVERT(0x6570736f6e207072696e746572 USING utf8mb4),0,100000,12,CONVERT(0x312059656172 USING utf8mb4),-3,CONVERT(0x323032362d31312d31302031343a33313a3030 USING utf8mb4),CONVERT(0x323032362d31312d31302031353a32373a3539 USING utf8mb4),CONVERT('' USING utf8mb4),0);
INSERT INTO `customers` (`id`,`name`,`phone`,`address`,`created_at`) VALUES (1,CONVERT(0x776968616e6769 USING utf8mb4),CONVERT(0x30373839343536313233 USING utf8mb4),CONVERT(0x6e696b6177657261746979612c6b7572756e6567616c61 USING utf8mb4),CONVERT(0x323032362d31312d31302031343a33313a3030 USING utf8mb4));
INSERT INTO `quotations` (`id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`notes`,`status`,`converted_invoice_id`,`converted_invoice_no`,`created_at`,`subject`,`tax_amount`,`description`) VALUES (1,CONVERT(0x51544e2d30303031 USING utf8mb4),1,CONVERT(0x776968616e6769 USING utf8mb4),CONVERT(0x30373839343536313233 USING utf8mb4),CONVERT(0x6e696b6177657261746979612c6b7572756e6567616c61 USING utf8mb4),300000,0,300000,CONVERT('' USING utf8mb4),CONVERT(0x494e564f49434544 USING utf8mb4),1,CONVERT(0x494e562d30303031 USING utf8mb4),CONVERT(0x323032362d31312d31302031343a33313a3030 USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT('' USING utf8mb4));
INSERT INTO `quotations` (`id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`notes`,`status`,`converted_invoice_id`,`converted_invoice_no`,`created_at`,`subject`,`tax_amount`,`description`) VALUES (2,CONVERT(0x51544e2d30303032 USING utf8mb4),NULL,CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),100500,0,100500,CONVERT('' USING utf8mb4),CONVERT(0x494e564f49434544 USING utf8mb4),2,CONVERT(0x494e562d30303032 USING utf8mb4),CONVERT(0x323032362d31312d31312030393a35313a3539 USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT('' USING utf8mb4));
INSERT INTO `quotations` (`id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`notes`,`status`,`converted_invoice_id`,`converted_invoice_no`,`created_at`,`subject`,`tax_amount`,`description`) VALUES (3,CONVERT(0x51544e2d30303033 USING utf8mb4),NULL,CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),42000,0,42000,CONVERT('' USING utf8mb4),CONVERT(0x494e564f49434544 USING utf8mb4),3,CONVERT(0x494e562d30303033 USING utf8mb4),CONVERT(0x323032362d31312d31312031323a31373a3536 USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT('' USING utf8mb4));
INSERT INTO `quotations` (`id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`notes`,`status`,`converted_invoice_id`,`converted_invoice_no`,`created_at`,`subject`,`tax_amount`,`description`) VALUES (4,CONVERT(0x51544e2d30303034 USING utf8mb4),NULL,CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),18000,0,18000,CONVERT('' USING utf8mb4),CONVERT(0x494e564f49434544 USING utf8mb4),3,CONVERT(0x494e562d30303033 USING utf8mb4),CONVERT(0x323032362d31312d31312031323a33343a3330 USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT('' USING utf8mb4));
INSERT INTO `quotations` (`id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`notes`,`status`,`converted_invoice_id`,`converted_invoice_no`,`created_at`,`subject`,`tax_amount`,`description`) VALUES (5,CONVERT(0x51544e2d30303035 USING utf8mb4),NULL,CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),100000,0,100000,CONVERT('' USING utf8mb4),CONVERT(0x50454e44494e47 USING utf8mb4),NULL,CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31312031333a30383a3035 USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT(0x6161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161 USING utf8mb4));
INSERT INTO `quotation_items` (`id`,`quotation_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (1,1,6,CONVERT(0x6570736f6e207072696e746572 USING utf8mb4),CONVERT(0x5b2231222c2232222c2233225d USING utf8mb4),12,CONVERT(0x312059656172 USING utf8mb4),3,100000,0,300000,CONVERT('' USING utf8mb4),0,0);
INSERT INTO `quotation_items` (`id`,`quotation_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (2,2,5,CONVERT(0x3234222049505320313030487a204672616d656c657373204d6f6e69746f72 USING utf8mb4),CONVERT(0x5b2231222c2232222c2232225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),3,33500,0,100500,CONVERT(0x46756c6c20484420313932307831303830204950532050616e656c2c20313030487a205265667265736820526174652c2048444d49202620564741 USING utf8mb4),0,0);
INSERT INTO `quotation_items` (`id`,`quotation_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (3,3,5,CONVERT(0x3234222049505320313030487a204672616d656c657373204d6f6e69746f72 USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),1,33500,0,33500,CONVERT(0x46756c6c20484420313932307831303830204950532050616e656c2c20313030487a205265667265736820526174652c2048444d49202620564741 USING utf8mb4),0,0);
INSERT INTO `quotation_items` (`id`,`quotation_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (4,3,4,CONVERT(0x436f72736169722056656e6765616e6365204c505820384742204444523420333230304d487a2052414d USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),1,8500,0,8500,CONVERT(0x38474220283178384742292044445234204452414d20333230304d487a20433136204d656d6f7279204b6974202d20426c61636b USING utf8mb4),0,0);
INSERT INTO `quotation_items` (`id`,`quotation_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (5,4,4,CONVERT(0x436f72736169722056656e6765616e6365204c505820384742204444523420333230304d487a2052414d USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),1,8500,0,8500,CONVERT(0x38474220283178384742292044445234204452414d20333230304d487a20433136204d656d6f7279204b6974202d20426c61636b USING utf8mb4),0,0);
INSERT INTO `quotation_items` (`id`,`quotation_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (6,4,3,CONVERT(0x48696b766973696f6e20324d5020436f6c6f7256752042756c6c65742043616d657261 USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),24,CONVERT(0x32205965617273 USING utf8mb4),1,9500,0,9500,CONVERT(0x31303830702046756c6c2048442c2032342f372046756c6c2054696d6520436f6c6f722c2049503637205765617468657270726f6f662c2032306d2044697374616e6365 USING utf8mb4),0,0);
INSERT INTO `quotation_items` (`id`,`quotation_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (7,5,4,CONVERT(0x436f72736169722056656e6765616e6365204c505820384742204444523420333230304d487a2052414d USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),12,CONVERT(0x312059656172 USING utf8mb4),1,100000,0,100000,CONVERT('' USING utf8mb4),0,0);
INSERT INTO `invoices` (`id`,`invoice_no`,`quotation_id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`paid_amount`,`balance_due`,`payment_method`,`payment_status`,`notes`,`created_at`,`subject`,`cheque_no`,`cheque_bank`,`cheque_date`,`payment_ref`,`tax_amount`,`description`) VALUES (1,CONVERT(0x494e562d30303031 USING utf8mb4),1,CONVERT(0x51544e2d30303031 USING utf8mb4),1,CONVERT(0x776968616e6769 USING utf8mb4),CONVERT(0x30373839343536313233 USING utf8mb4),CONVERT(0x6e696b6177657261746979612c6b7572756e6567616c61 USING utf8mb4),300000,0,300000,300000,0,CONVERT(0x43617368 USING utf8mb4),CONVERT(0x50414944 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031353a32373a3539 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT('' USING utf8mb4));
INSERT INTO `invoices` (`id`,`invoice_no`,`quotation_id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`paid_amount`,`balance_due`,`payment_method`,`payment_status`,`notes`,`created_at`,`subject`,`cheque_no`,`cheque_bank`,`cheque_date`,`payment_ref`,`tax_amount`,`description`) VALUES (2,CONVERT(0x494e562d30303032 USING utf8mb4),2,CONVERT(0x51544e2d30303032 USING utf8mb4),NULL,CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),100500,0,100500,100000,500,CONVERT(0x43617368 USING utf8mb4),CONVERT(0x5041525449414c USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31312031323a32323a3432 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT('' USING utf8mb4));
INSERT INTO `invoices` (`id`,`invoice_no`,`quotation_id`,`quote_no`,`customer_id`,`customer_name`,`customer_phone`,`customer_address`,`subtotal`,`discount`,`grand_total`,`paid_amount`,`balance_due`,`payment_method`,`payment_status`,`notes`,`created_at`,`subject`,`cheque_no`,`cheque_bank`,`cheque_date`,`payment_ref`,`tax_amount`,`description`) VALUES (3,CONVERT(0x494e562d30303033 USING utf8mb4),NULL,CONVERT(0x51544e2d303030342c2051544e2d30303033 USING utf8mb4),NULL,CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),60000,0,60000,30000,30000,CONVERT(0x43617368 USING utf8mb4),CONVERT(0x5041525449414c USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31312031323a33353a3536 USING utf8mb4),CONVERT(0x436f6d62696e65642051756f746174696f6e73202851544e2d303030342c2051544e2d3030303329 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),0,CONVERT('' USING utf8mb4));
INSERT INTO `invoice_items` (`id`,`invoice_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`buying_price`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (1,1,6,CONVERT(0x6570736f6e207072696e746572 USING utf8mb4),CONVERT(0x5b2231222c2232222c2233225d USING utf8mb4),12,CONVERT(0x312059656172 USING utf8mb4),3,0,100000,0,300000,CONVERT('' USING utf8mb4),0,0);
INSERT INTO `invoice_items` (`id`,`invoice_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`buying_price`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (2,2,5,CONVERT(0x3234222049505320313030487a204672616d656c657373204d6f6e69746f72 USING utf8mb4),CONVERT(0x5b2231222c2232222c2232225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),3,28500,33500,0,100500,CONVERT(0x46756c6c20484420313932307831303830204950532050616e656c2c20313030487a205265667265736820526174652c2048444d49202620564741 USING utf8mb4),0,0);
INSERT INTO `invoice_items` (`id`,`invoice_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`buying_price`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (3,3,4,CONVERT(0x436f72736169722056656e6765616e6365204c505820384742204444523420333230304d487a2052414d USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),1,7000,8500,0,8500,CONVERT(0x5b51544e2d303030345d2038474220283178384742292044445234204452414d20333230304d487a20433136204d656d6f7279204b6974202d20426c61636b USING utf8mb4),0,0);
INSERT INTO `invoice_items` (`id`,`invoice_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`buying_price`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (4,3,3,CONVERT(0x48696b766973696f6e20324d5020436f6c6f7256752042756c6c65742043616d657261 USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),24,CONVERT(0x32205965617273 USING utf8mb4),1,7800,9500,0,9500,CONVERT(0x5b51544e2d303030345d2031303830702046756c6c2048442c2032342f372046756c6c2054696d6520436f6c6f722c2049503637205765617468657270726f6f662c2032306d2044697374616e6365 USING utf8mb4),0,0);
INSERT INTO `invoice_items` (`id`,`invoice_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`buying_price`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (5,3,5,CONVERT(0x3234222049505320313030487a204672616d656c657373204d6f6e69746f72 USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),1,28500,33500,0,33500,CONVERT(0x5b51544e2d303030335d2046756c6c20484420313932307831303830204950532050616e656c2c20313030487a205265667265736820526174652c2048444d49202620564741 USING utf8mb4),0,0);
INSERT INTO `invoice_items` (`id`,`invoice_id`,`item_id`,`item_name`,`serial_numbers`,`warranty_months`,`warranty_label`,`qty`,`buying_price`,`unit_price`,`item_discount`,`line_total`,`item_description`,`vat_rate`,`vat_amount`) VALUES (6,3,4,CONVERT(0x436f72736169722056656e6765616e6365204c505820384742204444523420333230304d487a2052414d USING utf8mb4),CONVERT(0x5b2231225d USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),1,7000,8500,0,8500,CONVERT(0x5b51544e2d303030335d2038474220283178384742292044445234204452414d20333230304d487a20433136204d656d6f7279204b6974202d20426c61636b USING utf8mb4),0,0);
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (1,1,CONVERT(0x4b696e6773746f6e204e5632203530304742204e564d6520535344 USING utf8mb4),CONVERT(0x4b4e472d3530302d393832333431 USING utf8mb4),CONVERT(0x494e5f53544f434b USING utf8mb4),NULL,CONVERT('' USING utf8mb4),NULL,CONVERT('' USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),NULL,NULL,CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (2,1,CONVERT(0x4b696e6773746f6e204e5632203530304742204e564d6520535344 USING utf8mb4),CONVERT(0x4b4e472d3530302d393832333432 USING utf8mb4),CONVERT(0x494e5f53544f434b USING utf8mb4),NULL,CONVERT('' USING utf8mb4),NULL,CONVERT('' USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),NULL,NULL,CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (3,1,CONVERT(0x4b696e6773746f6e204e5632203530304742204e564d6520535344 USING utf8mb4),CONVERT(0x4b4e472d3530302d393832333433 USING utf8mb4),CONVERT(0x494e5f53544f434b USING utf8mb4),NULL,CONVERT('' USING utf8mb4),NULL,CONVERT('' USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),NULL,NULL,CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (4,3,CONVERT(0x48696b766973696f6e20324d5020436f6c6f7256752042756c6c65742043616d657261 USING utf8mb4),CONVERT(0x48494b2d43562d313130323931 USING utf8mb4),CONVERT(0x494e5f53544f434b USING utf8mb4),NULL,CONVERT('' USING utf8mb4),NULL,CONVERT('' USING utf8mb4),24,CONVERT(0x32205965617273 USING utf8mb4),NULL,NULL,CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (5,3,CONVERT(0x48696b766973696f6e20324d5020436f6c6f7256752042756c6c65742043616d657261 USING utf8mb4),CONVERT(0x48494b2d43562d313130323932 USING utf8mb4),CONVERT(0x494e5f53544f434b USING utf8mb4),NULL,CONVERT('' USING utf8mb4),NULL,CONVERT('' USING utf8mb4),24,CONVERT(0x32205965617273 USING utf8mb4),NULL,NULL,CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (6,3,CONVERT(0x48696b766973696f6e20324d5020436f6c6f7256752042756c6c65742043616d657261 USING utf8mb4),CONVERT(0x48494b2d43562d313130323933 USING utf8mb4),CONVERT(0x494e5f53544f434b USING utf8mb4),NULL,CONVERT('' USING utf8mb4),NULL,CONVERT('' USING utf8mb4),24,CONVERT(0x32205965617273 USING utf8mb4),NULL,NULL,CONVERT('' USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031343a30383a3330 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (7,6,CONVERT(0x6570736f6e207072696e746572 USING utf8mb4),CONVERT(0x31 USING utf8mb4),CONVERT(0x534f4c44 USING utf8mb4),NULL,CONVERT('' USING utf8mb4),3,CONVERT(0x494e562d30303033 USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),CONVERT(0x323032362d31312d3131 USING utf8mb4),CONVERT(0x323032392d31312d3131 USING utf8mb4),CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031353a32373a3539 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (8,6,CONVERT(0x6570736f6e207072696e746572 USING utf8mb4),CONVERT(0x32 USING utf8mb4),CONVERT(0x534f4c44 USING utf8mb4),NULL,CONVERT('' USING utf8mb4),2,CONVERT(0x494e562d30303032 USING utf8mb4),36,CONVERT(0x33205965617273 USING utf8mb4),CONVERT(0x323032362d31312d3131 USING utf8mb4),CONVERT(0x323032392d31312d3131 USING utf8mb4),CONVERT(0x57616c6b2d696e20437573746f6d6572 USING utf8mb4),CONVERT('' USING utf8mb4),CONVERT(0x323032362d31312d31302031353a32373a3539 USING utf8mb4));
INSERT INTO `item_serials` (`id`,`item_id`,`item_name`,`serial_number`,`status`,`grn_id`,`grn_no`,`invoice_id`,`invoice_no`,`warranty_months`,`warranty_label`,`sold_date`,`warranty_expiry`,`customer_name`,`customer_phone`,`created_at`) VALUES (9,6,CONVERT(0x6570736f6e207072696e746572 USING utf8mb4),CONVERT(0x33 USING utf8mb4),CONVERT(0x534f4c44 USING utf8mb4),NULL,CONVERT('' USING utf8mb4),1,CONVERT(0x494e562d30303031 USING utf8mb4),12,CONVERT(0x312059656172 USING utf8mb4),CONVERT(0x323032362d31312d3130 USING utf8mb4),CONVERT(0x323032372d31312d3130 USING utf8mb4),CONVERT(0x776968616e6769 USING utf8mb4),CONVERT(0x30373839343536313233 USING utf8mb4),CONVERT(0x323032362d31312d31302031353a32373a3539 USING utf8mb4));
COMMIT;