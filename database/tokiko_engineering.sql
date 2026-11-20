-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 19, 2026 at 06:34 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tokiko_engineering`
--

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` bigint(20) NOT NULL,
  `name` varchar(512) NOT NULL,
  `phone` longtext DEFAULT '',
  `address` longtext DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `name`, `phone`, `address`, `created_at`) VALUES
(1, 'wihangi', '0789456123', 'nikaweratiya,kurunegala', '2026-11-10 14:31:00'),
(2, 'wijesinghe', '0784563219', 'kuliyapitiya', '2026-11-18 12:26:38');

-- --------------------------------------------------------

--
-- Table structure for table `grns`
--

CREATE TABLE `grns` (
  `id` bigint(20) NOT NULL,
  `grn_no` varchar(191) NOT NULL,
  `supplier_id` bigint(20) DEFAULT NULL,
  `supplier_name` longtext NOT NULL,
  `supplier_phone` longtext DEFAULT '',
  `ref_no` longtext DEFAULT '',
  `total_amount` double DEFAULT 0,
  `paid_amount` double DEFAULT 0,
  `notes` longtext DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `grns`
--

INSERT INTO `grns` (`id`, `grn_no`, `supplier_id`, `supplier_name`, `supplier_phone`, `ref_no`, `total_amount`, `paid_amount`, `notes`, `created_at`) VALUES
(4, 'GRN-0001', 4, 'General Supplier', '', '', 57000, 57000, '', '2026-11-17 15:07:07'),
(5, 'GRN-0005', 5, 'singer', '0115489653', '', 28500, 20000, '', '2026-11-17 15:37:31');

-- --------------------------------------------------------

--
-- Table structure for table `grn_items`
--

CREATE TABLE `grn_items` (
  `id` bigint(20) NOT NULL,
  `grn_id` bigint(20) NOT NULL,
  `item_id` bigint(20) DEFAULT NULL,
  `item_name` longtext NOT NULL,
  `serial_numbers` longtext DEFAULT '[]',
  `warranty_months` bigint(20) DEFAULT 0,
  `warranty_label` longtext DEFAULT 'No Warranty',
  `qty` bigint(20) DEFAULT 1,
  `buying_price` double DEFAULT 0,
  `selling_price` double DEFAULT 0,
  `line_total` double DEFAULT 0,
  `item_description` longtext DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `grn_items`
--

INSERT INTO `grn_items` (`id`, `grn_id`, `item_id`, `item_name`, `serial_numbers`, `warranty_months`, `warranty_label`, `qty`, `buying_price`, `selling_price`, `line_total`, `item_description`) VALUES
(4, 4, 5, '24\" IPS 100Hz Frameless Monitor', '[\"10\",\"11\"]', 36, '3 Years', 2, 28500, 33500, 57000, ''),
(5, 5, 5, '24\" IPS 100Hz Frameless Monitor', '[\"13\"]', 36, '3 Years', 1, 28500, 33500, 28500, '');

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` bigint(20) NOT NULL,
  `invoice_no` varchar(191) NOT NULL,
  `quotation_id` bigint(20) DEFAULT NULL,
  `quote_no` varchar(191) DEFAULT '',
  `customer_id` bigint(20) DEFAULT NULL,
  `customer_name` longtext NOT NULL,
  `customer_phone` longtext DEFAULT '',
  `customer_address` longtext DEFAULT '',
  `subtotal` double DEFAULT 0,
  `discount` double DEFAULT 0,
  `grand_total` double DEFAULT 0,
  `paid_amount` double DEFAULT 0,
  `balance_due` double DEFAULT 0,
  `payment_method` longtext DEFAULT 'Cash',
  `payment_status` longtext DEFAULT 'PAID',
  `notes` longtext DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp(),
  `subject` longtext DEFAULT '',
  `cheque_no` longtext DEFAULT '',
  `cheque_bank` longtext DEFAULT '',
  `cheque_date` longtext DEFAULT '',
  `payment_ref` longtext DEFAULT '',
  `tax_amount` double DEFAULT 0,
  `description` longtext DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoices`
--

INSERT INTO `invoices` (`id`, `invoice_no`, `quotation_id`, `quote_no`, `customer_id`, `customer_name`, `customer_phone`, `customer_address`, `subtotal`, `discount`, `grand_total`, `paid_amount`, `balance_due`, `payment_method`, `payment_status`, `notes`, `created_at`, `subject`, `cheque_no`, `cheque_bank`, `cheque_date`, `payment_ref`, `tax_amount`, `description`) VALUES
(1, 'INV-0001', 1, 'QTN-0001', 1, 'wihangi', '0789456123', 'nikaweratiya,kurunegala', 300000, 0, 300000, 300000, 0, 'Cash', 'PAID', '', '2026-11-10 15:27:59', '', '', '', '', '', 0, ''),
(2, 'INV-0002', 2, 'QTN-0002', NULL, 'Walk-in Customer', '', '', 100500, 0, 100500, 100000, 500, 'Cash', 'PARTIAL', '', '2026-11-11 12:22:42', '', '', '', '', '', 0, ''),
(3, 'INV-0003', NULL, 'QTN-0004, QTN-0003', NULL, 'Walk-in Customer', '', '', 60000, 0, 60000, 30000, 30000, 'Cash', 'PARTIAL', '', '2026-11-11 12:35:56', 'Combined Quotations (QTN-0004, QTN-0003)', '', '', '', '', 0, ''),
(4, 'INV-0004', NULL, '', 2, 'wijesinghe', '0784563219', 'kuliyapitiya', 100000, 0, 100000, 100000, 0, 'Cash', 'PAID', '', '2026-11-18 12:26:38', '', '', '', '', '', 0, '');

-- --------------------------------------------------------

--
-- Table structure for table `invoice_items`
--

CREATE TABLE `invoice_items` (
  `id` bigint(20) NOT NULL,
  `invoice_id` bigint(20) NOT NULL,
  `item_id` bigint(20) DEFAULT NULL,
  `item_name` longtext NOT NULL,
  `serial_numbers` longtext DEFAULT '[]',
  `warranty_months` bigint(20) DEFAULT 0,
  `warranty_label` longtext DEFAULT 'No Warranty',
  `qty` bigint(20) DEFAULT 1,
  `buying_price` double DEFAULT 0,
  `unit_price` double DEFAULT 0,
  `item_discount` double DEFAULT 0,
  `line_total` double DEFAULT 0,
  `item_description` longtext DEFAULT '',
  `vat_rate` double DEFAULT 0,
  `vat_amount` double DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoice_items`
--

INSERT INTO `invoice_items` (`id`, `invoice_id`, `item_id`, `item_name`, `serial_numbers`, `warranty_months`, `warranty_label`, `qty`, `buying_price`, `unit_price`, `item_discount`, `line_total`, `item_description`, `vat_rate`, `vat_amount`) VALUES
(1, 1, 6, 'epson printer', '[\"1\",\"2\",\"3\"]', 12, '1 Year', 3, 0, 100000, 0, 300000, '', 0, 0),
(2, 2, 5, '24\" IPS 100Hz Frameless Monitor', '[\"1\",\"2\",\"2\"]', 36, '3 Years', 3, 28500, 33500, 0, 100500, 'Full HD 1920x1080 IPS Panel, 100Hz Refresh Rate, HDMI & VGA', 0, 0),
(3, 3, 4, 'Corsair Vengeance LPX 8GB DDR4 3200MHz RAM', '[\"1\"]', 36, '3 Years', 1, 7000, 8500, 0, 8500, '[QTN-0004] 8GB (1x8GB) DDR4 DRAM 3200MHz C16 Memory Kit - Black', 0, 0),
(4, 3, 3, 'Hikvision 2MP ColorVu Bullet Camera', '[\"1\"]', 24, '2 Years', 1, 7800, 9500, 0, 9500, '[QTN-0004] 1080p Full HD, 24/7 Full Time Color, IP67 Weatherproof, 20m Distance', 0, 0),
(5, 3, 5, '24\" IPS 100Hz Frameless Monitor', '[\"1\"]', 36, '3 Years', 1, 28500, 33500, 0, 33500, '[QTN-0003] Full HD 1920x1080 IPS Panel, 100Hz Refresh Rate, HDMI & VGA', 0, 0),
(6, 3, 4, 'Corsair Vengeance LPX 8GB DDR4 3200MHz RAM', '[\"1\"]', 36, '3 Years', 1, 7000, 8500, 0, 8500, '[QTN-0003] 8GB (1x8GB) DDR4 DRAM 3200MHz C16 Memory Kit - Black', 0, 0),
(7, 4, 5, '24\" IPS 100Hz Frameless Monitor', '[\"24I-261118-7WWF\"]', 12, '1 Year', 1, 28500, 100000, 0, 100000, '', 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `items`
--

CREATE TABLE `items` (
  `id` bigint(20) NOT NULL,
  `name` varchar(512) NOT NULL,
  `buying_price` double DEFAULT 0,
  `selling_price` double DEFAULT 0,
  `warranty_months` bigint(20) DEFAULT 12,
  `warranty_label` longtext DEFAULT '1 Year',
  `stock_qty` bigint(20) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  `description` longtext DEFAULT '',
  `vat_rate` double DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `items`
--

INSERT INTO `items` (`id`, `name`, `buying_price`, `selling_price`, `warranty_months`, `warranty_label`, `stock_qty`, `created_at`, `updated_at`, `description`, `vat_rate`) VALUES
(1, 'Kingston NV2 500GB NVMe SSD', 10500, 12500, 36, '3 Years', 8, '2026-11-10 14:08:30', '2026-11-10 14:08:30', 'PCIe 4.0 NVMe M.2 2280, Up to 3500MB/s Read Speed', 0),
(2, 'Logitech G102 Lightsync Gaming Mouse', 6200, 7500, 12, '1 Year', 12, '2026-11-10 14:08:30', '2026-11-10 14:08:30', '8000 DPI Optical Sensor, RGB Lightsync, 6 Programmable Buttons', 0),
(3, 'Hikvision 2MP ColorVu Bullet Camera', 7800, 9500, 24, '2 Years', 14, '2026-11-10 14:08:30', '2026-11-11 12:35:56', '[QTN-0004] 1080p Full HD, 24/7 Full Time Color, IP67 Weatherproof, 20m Distance', 0),
(4, 'Corsair Vengeance LPX 8GB DDR4 3200MHz RAM', 7000, 100000, 12, '1 Year', 8, '2026-11-10 14:08:30', '2026-11-12 16:37:07', '[QTN-0003] 8GB (1x8GB) DDR4 DRAM 3200MHz C16 Memory Kit - Black', 0),
(5, '24\" IPS 100Hz Frameless Monitor', 28500, 100000, 12, '1 Year', 3, '2026-11-10 14:08:30', '2026-11-18 12:26:38', '[QTN-0003] Full HD 1920x1080 IPS Panel, 100Hz Refresh Rate, HDMI & VGA', 0),
(6, 'epson printer', 0, 100000, 12, '1 Year', -3, '2026-11-10 14:31:00', '2026-11-10 15:27:59', '', 0);

-- --------------------------------------------------------

--
-- Table structure for table `item_serials`
--

CREATE TABLE `item_serials` (
  `id` bigint(20) NOT NULL,
  `item_id` bigint(20) DEFAULT NULL,
  `item_name` longtext NOT NULL,
  `serial_number` varchar(512) NOT NULL,
  `status` longtext DEFAULT 'IN_STOCK',
  `grn_id` bigint(20) DEFAULT NULL,
  `grn_no` varchar(191) DEFAULT '',
  `invoice_id` bigint(20) DEFAULT NULL,
  `invoice_no` varchar(191) DEFAULT '',
  `warranty_months` bigint(20) DEFAULT 0,
  `warranty_label` longtext DEFAULT 'No Warranty',
  `sold_date` longtext DEFAULT NULL,
  `warranty_expiry` longtext DEFAULT NULL,
  `customer_name` longtext DEFAULT '',
  `customer_phone` longtext DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `item_serials`
--

INSERT INTO `item_serials` (`id`, `item_id`, `item_name`, `serial_number`, `status`, `grn_id`, `grn_no`, `invoice_id`, `invoice_no`, `warranty_months`, `warranty_label`, `sold_date`, `warranty_expiry`, `customer_name`, `customer_phone`, `created_at`) VALUES
(1, 1, 'Kingston NV2 500GB NVMe SSD', 'KNG-500-982341', 'IN_STOCK', NULL, '', NULL, '', 36, '3 Years', NULL, NULL, '', '', '2026-11-10 14:08:30'),
(2, 1, 'Kingston NV2 500GB NVMe SSD', 'KNG-500-982342', 'IN_STOCK', NULL, '', NULL, '', 36, '3 Years', NULL, NULL, '', '', '2026-11-10 14:08:30'),
(3, 1, 'Kingston NV2 500GB NVMe SSD', 'KNG-500-982343', 'IN_STOCK', NULL, '', NULL, '', 36, '3 Years', NULL, NULL, '', '', '2026-11-10 14:08:30'),
(4, 3, 'Hikvision 2MP ColorVu Bullet Camera', 'HIK-CV-110291', 'IN_STOCK', NULL, '', NULL, '', 24, '2 Years', NULL, NULL, '', '', '2026-11-10 14:08:30'),
(5, 3, 'Hikvision 2MP ColorVu Bullet Camera', 'HIK-CV-110292', 'IN_STOCK', NULL, '', NULL, '', 24, '2 Years', NULL, NULL, '', '', '2026-11-10 14:08:30'),
(6, 3, 'Hikvision 2MP ColorVu Bullet Camera', 'HIK-CV-110293', 'IN_STOCK', NULL, '', NULL, '', 24, '2 Years', NULL, NULL, '', '', '2026-11-10 14:08:30'),
(7, 6, 'epson printer', '1', 'SOLD', NULL, '', 3, 'INV-0003', 36, '3 Years', '2026-11-11', '2029-11-11', 'Walk-in Customer', '', '2026-11-10 15:27:59'),
(8, 6, 'epson printer', '2', 'SOLD', NULL, '', 2, 'INV-0002', 36, '3 Years', '2026-11-11', '2029-11-11', 'Walk-in Customer', '', '2026-11-10 15:27:59'),
(9, 6, 'epson printer', '3', 'SOLD', NULL, '', 1, 'INV-0001', 12, '1 Year', '2026-11-10', '2027-11-10', 'wihangi', '0789456123', '2026-11-10 15:27:59'),
(10, 5, '24\" IPS 100Hz Frameless Monitor', '10', 'IN_STOCK', 4, 'GRN-0001', NULL, '', 36, '3 Years', NULL, NULL, '', '', '2026-11-17 15:07:07'),
(11, 5, '24\" IPS 100Hz Frameless Monitor', '11', 'IN_STOCK', 4, 'GRN-0001', NULL, '', 36, '3 Years', NULL, NULL, '', '', '2026-11-17 15:07:07'),
(12, 5, '24\" IPS 100Hz Frameless Monitor', '13', 'IN_STOCK', 5, 'GRN-0005', NULL, '', 36, '3 Years', NULL, NULL, '', '', '2026-11-17 15:37:31'),
(13, 5, '24\" IPS 100Hz Frameless Monitor', '24I-261118-7WWF', 'SOLD', NULL, '', 4, 'INV-0004', 12, '1 Year', '2026-11-18', '2027-11-18', 'wijesinghe', '0784563219', '2026-11-18 12:26:38');

-- --------------------------------------------------------

--
-- Table structure for table `pos_write_lock`
--

CREATE TABLE `pos_write_lock` (
  `id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pos_write_lock`
--

INSERT INTO `pos_write_lock` (`id`) VALUES
(1);

-- --------------------------------------------------------

--
-- Table structure for table `quotations`
--

CREATE TABLE `quotations` (
  `id` bigint(20) NOT NULL,
  `quote_no` varchar(191) NOT NULL,
  `customer_id` bigint(20) DEFAULT NULL,
  `customer_name` longtext NOT NULL,
  `customer_phone` longtext DEFAULT '',
  `customer_address` longtext DEFAULT '',
  `subtotal` double DEFAULT 0,
  `discount` double DEFAULT 0,
  `grand_total` double DEFAULT 0,
  `notes` longtext DEFAULT '',
  `status` longtext DEFAULT 'PENDING',
  `converted_invoice_id` bigint(20) DEFAULT NULL,
  `converted_invoice_no` longtext DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp(),
  `subject` longtext DEFAULT '',
  `tax_amount` double DEFAULT 0,
  `description` longtext DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `quotations`
--

INSERT INTO `quotations` (`id`, `quote_no`, `customer_id`, `customer_name`, `customer_phone`, `customer_address`, `subtotal`, `discount`, `grand_total`, `notes`, `status`, `converted_invoice_id`, `converted_invoice_no`, `created_at`, `subject`, `tax_amount`, `description`) VALUES
(1, 'QTN-0001', 1, 'wihangi', '0789456123', 'nikaweratiya,kurunegala', 300000, 0, 300000, '', 'INVOICED', 1, 'INV-0001', '2026-11-10 14:31:00', '', 0, ''),
(2, 'QTN-0002', NULL, 'Walk-in Customer', '', '', 100500, 0, 100500, '', 'INVOICED', 2, 'INV-0002', '2026-11-11 09:51:59', '', 0, ''),
(3, 'QTN-0003', NULL, 'Walk-in Customer', '', '', 42000, 0, 42000, '', 'INVOICED', 3, 'INV-0003', '2026-11-11 12:17:56', '', 0, ''),
(4, 'QTN-0004', NULL, 'Walk-in Customer', '', '', 18000, 0, 18000, '', 'INVOICED', 3, 'INV-0003', '2026-11-11 12:34:30', '', 0, ''),
(5, 'QTN-0005', NULL, 'Walk-in Customer', '', '', 100000, 0, 100000, '', 'PENDING', NULL, '', '2026-11-11 13:08:05', '', 0, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
(6, 'QTN-0006', 1, 'wihangi', '0789456123', 'nikaweratiya,kurunegala', 100000, 0, 100000, '', 'PENDING', NULL, '', '2026-11-12 16:37:07', '', 0, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

-- --------------------------------------------------------

--
-- Table structure for table `quotation_items`
--

CREATE TABLE `quotation_items` (
  `id` bigint(20) NOT NULL,
  `quotation_id` bigint(20) NOT NULL,
  `item_id` bigint(20) DEFAULT NULL,
  `item_name` longtext NOT NULL,
  `serial_numbers` longtext DEFAULT '[]',
  `warranty_months` bigint(20) DEFAULT 0,
  `warranty_label` longtext DEFAULT 'No Warranty',
  `qty` bigint(20) DEFAULT 1,
  `unit_price` double DEFAULT 0,
  `item_discount` double DEFAULT 0,
  `line_total` double DEFAULT 0,
  `item_description` longtext DEFAULT '',
  `vat_rate` double DEFAULT 0,
  `vat_amount` double DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `quotation_items`
--

INSERT INTO `quotation_items` (`id`, `quotation_id`, `item_id`, `item_name`, `serial_numbers`, `warranty_months`, `warranty_label`, `qty`, `unit_price`, `item_discount`, `line_total`, `item_description`, `vat_rate`, `vat_amount`) VALUES
(1, 1, 6, 'epson printer', '[\"1\",\"2\",\"3\"]', 12, '1 Year', 3, 100000, 0, 300000, '', 0, 0),
(2, 2, 5, '24\" IPS 100Hz Frameless Monitor', '[\"1\",\"2\",\"2\"]', 36, '3 Years', 3, 33500, 0, 100500, 'Full HD 1920x1080 IPS Panel, 100Hz Refresh Rate, HDMI & VGA', 0, 0),
(3, 3, 5, '24\" IPS 100Hz Frameless Monitor', '[\"1\"]', 36, '3 Years', 1, 33500, 0, 33500, 'Full HD 1920x1080 IPS Panel, 100Hz Refresh Rate, HDMI & VGA', 0, 0),
(4, 3, 4, 'Corsair Vengeance LPX 8GB DDR4 3200MHz RAM', '[\"1\"]', 36, '3 Years', 1, 8500, 0, 8500, '8GB (1x8GB) DDR4 DRAM 3200MHz C16 Memory Kit - Black', 0, 0),
(5, 4, 4, 'Corsair Vengeance LPX 8GB DDR4 3200MHz RAM', '[\"1\"]', 36, '3 Years', 1, 8500, 0, 8500, '8GB (1x8GB) DDR4 DRAM 3200MHz C16 Memory Kit - Black', 0, 0),
(6, 4, 3, 'Hikvision 2MP ColorVu Bullet Camera', '[\"1\"]', 24, '2 Years', 1, 9500, 0, 9500, '1080p Full HD, 24/7 Full Time Color, IP67 Weatherproof, 20m Distance', 0, 0),
(7, 5, 4, 'Corsair Vengeance LPX 8GB DDR4 3200MHz RAM', '[\"1\"]', 12, '1 Year', 1, 100000, 0, 100000, '', 0, 0),
(8, 6, 4, 'Corsair Vengeance LPX 8GB DDR4 3200MHz RAM', '[\"1\"]', 12, '1 Year', 1, 100000, 0, 100000, '[QTN-0003] 8GB (1x8GB) DDR4 DRAM 3200MHz C16 Memory Kit - Black', 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `key` varchar(191) NOT NULL,
  `value` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`key`, `value`) VALUES
('branch_location', 'Tokiko Engineering (Pvt)Ltd'),
('cashier_name', 'ADMIN'),
('currency', 'Rs.'),
('declaration_text', 'Received the above items in good condition.'),
('footer_copy_label', 'CUSTOMER\'S COPY'),
('invoice_layout_style', 'MODERN'),
('invoice_terms', 'Goods once sold will not be taken back. Please bring this invoice for any warranty claims.'),
('invoice_title', 'INVOICE'),
('printer_name', ''),
('rep_name', 'wihangi'),
('shop_address', '464/B, IDH Road, Gothatuwa.'),
('shop_email', 'tokikoengineering@gmail.com');
INSERT INTO `settings` (`key`, `value`) VALUES
('shop_logo', 'data:image/png;base64,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joobBySxr7/+WokA4/riiy/00ksvRV/e5+v7XA8dOtRSNlLRvykaCqI2Ct9EUjy2ikk4SBYsaOJamPxVHacLn2uHHTYsts0OGlSpssiV8Z0JRwVC4JRqlmZzHJefEARBpK62b99eF13UVwMG3G8m1NoS3z3u5LEGDvPjAPRlysCSg8FsbNyO9sb5oKZOvVhPP/2j+vS5yIx3fMqnViWROdOvXz9vDEPMzHh9eDtXRz8cpQyP2bH0qK644rRIgl2HlyNSlitOInRMVY4x2Mgmg2XR5oIkP2sWWtqmqQo7jZ9EnmdJdjP3jWedVEFCYSNdQVDI301+gqZq1ZlOTMVklys7O1uoTTC/X3/9VePGjYsYIIwP+Pbbb/Xll1+KLxF98MEHeuON5zV58seuD0nlTccDDPca7suFBxzfrkWLPnHZwbrttjt1xx1358Gdd96re+55Wffe+0oexO8femi4HnpoVAT33/+F3n9/lpnsJq6vhiE5hJGUGwTpJm1y+bK5/+STT7RkybaubD1DusD52YlmsjsoMzMzXaF86bVt62zcuK7ToJWjlCEnwjll1lpORHVu27ZtJIWecUYPM8g9deihS2y//MJSH4z2MfeQOYNnfr6vU4WmTtzB0Nu+gr09f77wXMOD7qQyCjDYV155RU899aIdXUe41sMNtQzpwicWRB637Xlz9erVy9oJfUxXNn06R+E4kiiBezo/QkMz2VA//fST0JZijrJWaSrl5MGKyBRV8c0FaVCsKMkbbbSRJwmSYE6KLtfRDz/8otdff99S5Bt69tnBeuCBZ9S//5O6++4BeXD77Y/oqqvu0oUX3mp16TGNHj3SdQ039DPg8LjR8U25cIPje8xkp2ngwAl+boiuvfajPLj99i8tpSz0JF+UD154YZk++WRTDR++jWFbDRvWUd9/v48Z2umur7mhYAjDHEuzYcGM1ZSCivn9999b+oERpGL88YaHWW2eF73lhYQaTy0sRjraYAOOg80qpNia3VAK6UihWTvuuKM975fprrvusv2yk3bb7QdtuOG1atDgLtWu/ZznIz8oONF1/GkA39mOmaOo0tm+RqJnc13XZctW7vnuu+90882365dfYJbXu63CpMCp3tSutvMyJ/qqFqYRP1CqwDzg5Q5pjp//zZAq1PR8byv6GDu9AvNPPfelaTYTBBHTD4KKMS/iGJct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');
INSERT INTO `settings` (`key`, `value`) VALUES
('shop_name', 'Tokiko Engineering (Pvt)Ltd'),
('shop_phone', '070-6383800/0113-483800'),
('shop_tagline', 'All Kind of Vehicles, Machineries Spare Parts & General Hardware Item Distributers. Providing All Engineering Services Related to Machineries and Vehicles.'),
('shop_website', 'www.tokikoengineering.lk '),
('show_dispatch_vehicle', '1'),
('stamp_text', ''),
('vat_rate_percent', '0'),
('vat_reg_no', ''),
('verification_stamp_dept', 'ආරක්ෂක අංශය / ප්‍රදර්ශනාගාරය'),
('verification_stamp_title', 'පරීක්ෂා කළා');

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` bigint(20) NOT NULL,
  `name` varchar(512) NOT NULL,
  `phone` longtext DEFAULT '',
  `company` longtext DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `name`, `phone`, `company`, `created_at`) VALUES
(4, 'General Supplier', '', '', '2026-11-17 15:07:07'),
(5, 'singer', '0115489653', '', '2026-11-17 15:37:31');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `grns`
--
ALTER TABLE `grns`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_grn_no` (`grn_no`),
  ADD KEY `idx_grns_supplier_id` (`supplier_id`);

--
-- Indexes for table `grn_items`
--
ALTER TABLE `grn_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_grn_items_grn_id` (`grn_id`),
  ADD KEY `idx_grn_items_item_id` (`item_id`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_invoice_no` (`invoice_no`),
  ADD KEY `idx_invoices_quotation_id` (`quotation_id`),
  ADD KEY `idx_invoices_customer_id` (`customer_id`);

--
-- Indexes for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_invoice_items_invoice_id` (`invoice_id`),
  ADD KEY `idx_invoice_items_item_id` (`item_id`);

--
-- Indexes for table `items`
--
ALTER TABLE `items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_item_name` (`name`);

--
-- Indexes for table `item_serials`
--
ALTER TABLE `item_serials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_serial` (`serial_number`),
  ADD KEY `idx_item_serials_item_id` (`item_id`),
  ADD KEY `idx_item_serials_grn_id` (`grn_id`),
  ADD KEY `idx_item_serials_invoice_id` (`invoice_id`);

--
-- Indexes for table `pos_write_lock`
--
ALTER TABLE `pos_write_lock`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `quotations`
--
ALTER TABLE `quotations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_quote_no` (`quote_no`),
  ADD KEY `idx_quotations_customer_id` (`customer_id`),
  ADD KEY `idx_quotations_converted_invoice_id` (`converted_invoice_id`);

--
-- Indexes for table `quotation_items`
--
ALTER TABLE `quotation_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_quotation_items_quotation_id` (`quotation_id`),
  ADD KEY `idx_quotation_items_item_id` (`item_id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `grns`
--
ALTER TABLE `grns`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `grn_items`
--
ALTER TABLE `grn_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `invoice_items`
--
ALTER TABLE `invoice_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `items`
--
ALTER TABLE `items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `item_serials`
--
ALTER TABLE `item_serials`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `quotations`
--
ALTER TABLE `quotations`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `quotation_items`
--
ALTER TABLE `quotation_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `grn_items`
--
ALTER TABLE `grn_items`
  ADD CONSTRAINT `fk_grn_items_parent` FOREIGN KEY (`grn_id`) REFERENCES `grns` (`id`);

--
-- Constraints for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD CONSTRAINT `fk_invoice_items_parent` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`);

--
-- Constraints for table `quotation_items`
--
ALTER TABLE `quotation_items`
  ADD CONSTRAINT `fk_quotation_items_parent` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
