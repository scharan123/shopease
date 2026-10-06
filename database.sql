CREATE DATABASE IF NOT EXISTS ecommerce;
USE ecommerce;

-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: ecommerce
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cart`
--

DROP TABLE IF EXISTS `cart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_cart` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `cart_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cart_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart`
--

LOCK TABLES `cart` WRITE;
/*!40000 ALTER TABLE `cart` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `slug` varchar(50) NOT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `display_order` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Clothing','clothing','clothing',1),(2,'Accessories','accessories','accessories',2),(3,'Vegetables','vegetables','vegetables',3),(4,'Electronics','electronics','electronics',4),(5,'Home & Kitchen','home-kitchen','home-kitchen',5),(6,'Sports','sports','sports',6),(7,'Beauty','beauty','beauty',7);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (4,4,57,2,24.99);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  `shipping_address` text NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (4,7,49.98,'pending','charan, hydeabd, hyderabd, Telangana 500084, IN','cod','2026-08-26 09:50:55','2026-08-26 09:50:55');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `rating` decimal(3,1) NOT NULL DEFAULT '0.0',
  `discount` decimal(5,2) NOT NULL DEFAULT '0.00',
  `specification` text,
  `highlights` text,
  `delivery` text,
  `image_url` varchar(500) DEFAULT NULL,
  `stock` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `category` varchar(50) DEFAULT 'general',
  `category_id` int DEFAULT NULL,
  `featured` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'Wireless Headphones','High-quality wireless headphones with noise cancellation',149.99,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',25,'2026-08-26 06:16:08','electronics',0),(2,'Smart Watch','Feature-rich smartwatch with health monitoring',299.99,'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=400&fit=crop',14,'2026-08-26 06:16:08','electronics',0),(3,'Laptop Stand','Ergonomic aluminum laptop stand for better posture',49.99,'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop',50,'2026-08-26 06:16:08','electronics',0),(4,'Mechanical Keyboard','RGB mechanical keyboard with blue switches',129.99,'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop',30,'2026-08-26 06:16:08','electronics',0),(5,'USB-C Hub','7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader',39.99,'https://images.unsplash.com/photo-1591290619762-da5ec1d5e7c3?w=400&h=400&fit=crop',40,'2026-08-26 06:16:08','electronics',0),(6,'Portable Charger','20000mAh power bank with fast charging',59.99,'https://images.unsplash.com/photo-1609592424823-3a0c3d4d4d4d?w=400&h=400&fit=crop',35,'2026-08-26 06:16:08','electronics',0),(7,'Webcam HD','1080p webcam with built-in microphone',79.99,'https://images.unsplash.com/photo-1587829741301-bc67f26c270f?w=400&h=400&fit=crop',20,'2026-08-26 06:16:08','electronics',0),(8,'Bluetooth Speaker','Waterproof portable Bluetooth speaker',89.99,'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop',25,'2026-08-26 06:16:08','electronics',0),(9,'Classic Cotton T-Shirt','Premium 100% organic cotton t-shirt with a relaxed fit. Perfect for everyday wear.',29.99,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',50,'2026-08-26 06:39:07','clothing',0),(10,'Slim Fit Denim Jeans','Modern slim-fit jeans with stretch comfort. Classic 5-pocket styling.',79.99,'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop',35,'2026-08-26 06:39:07','clothing',1),(11,'Wool Blend Sweater','Cozy wool-blend sweater with ribbed cuffs and hem. Ideal for layering.',89.99,'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop',25,'2026-08-26 06:39:07','clothing',0),(12,'Lightweight Bomber Jacket','Water-resistant bomber jacket with multiple pockets. Contemporary style.',129.99,'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',20,'2026-08-26 06:39:07','clothing',0),(13,'Minimalist Leather Wallet','Handcrafted genuine leather wallet with RFID blocking. 8 card slots.',49.99,'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=400&fit=crop',40,'2026-08-26 06:39:07','accessories',0),(14,'Stainless Steel Watch','Sleek analog watch with sapphire crystal and 50m water resistance.',199.99,'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=400&fit=crop',15,'2026-08-26 06:39:07','accessories',1),(15,'Silk Scarf Collection','Luxurious 100% mulberry silk scarf. Multiple patterns available.',39.99,'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&h=400&fit=crop',30,'2026-08-26 06:39:07','accessories',0),(16,'Organic Mixed Vegetables Box','Fresh seasonal organic vegetables delivered weekly. 8-10 varieties.',34.99,'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop',100,'2026-08-26 06:39:07','vegetables',0),(17,'Fresh Herb Garden Kit','Grow your own herbs indoors. Includes basil, mint, rosemary, thyme pots.',24.99,'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop',60,'2026-08-26 06:39:07','vegetables',0),(18,'Premium Avocado Pack (6ct)','Ripe and ready-to-eat Hass avocados. Perfect for toast and salads.',12.99,'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&h=400&fit=crop',80,'2026-08-26 06:39:07','vegetables',0),(19,'Wireless Noise-Canceling Headphones','Industry-leading ANC with 30hr battery. Premium sound quality.',299.99,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',25,'2026-08-26 06:39:07','electronics',1),(20,'Ultra-Portable Laptop Stand','Ergonomic aluminum stand with adjustable angles. Folds flat.',49.99,'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop',50,'2026-08-26 06:39:07','electronics',0),(21,'Mechanical RGB Keyboard','Hot-swappable switches, per-key RGB, aluminum frame. Gasket mount.',179.99,'https://images.unsplash.com/photo-1511467687858-23d96c32e49f?w=400&h=400&fit=crop',20,'2026-08-26 06:39:07','electronics',0),(22,'4K UltraWide Monitor 34\"','3440x1440, 144Hz, HDR400, USB-C 90W PD. Perfect for productivity.',599.99,'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop',10,'2026-08-26 06:39:07','electronics',0),(24,'Smart Air Purifier','HEPA H13 filter, covers 540 sq ft, app-controlled, whisper quiet.',189.99,'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=400&fit=crop',12,'2026-08-26 06:39:07','home-kitchen',0),(25,'Minimalist Table Lamp','Dimmable warm LED, touch control, matte ceramic base. 3 color temps.',54.99,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop',25,'2026-08-26 06:39:07','home-kitchen',0),(26,'Pro Yoga Mat with Alignment Lines','6mm thick, non-slip, eco-friendly TPE. Includes carrying strap.',39.99,'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop',45,'2026-08-26 06:39:07','sports',0),(27,'Adjustable Dumbbell Set (5-50lb)','Space-saving design, 10 weight settings. Durable steel construction.',299.99,'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&h=400&fit=crop',8,'2026-08-26 06:39:07','sports',0),(28,'Insulated Water Bottle 32oz','Double-wall vacuum insulated, keeps cold 24hrs/hot 12hrs. BPA-free.',29.99,'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop',59,'2026-08-26 06:39:07','sports',0),(29,'Vitamin C Serum 30ml','20% Vitamin C + Hyaluronic Acid + Vitamin E. Brightens & firms.',34.99,'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=400&fit=crop',40,'2026-08-26 06:39:07','beauty',0),(31,'Organic Skincare Gift Set','Cleanser, toner, serum, moisturizer. All natural, cruelty-free.',79.99,'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&h=400&fit=crop',15,'2026-08-26 06:39:07','beauty',0),(32,'Formal Blazer','Tailored slim-fit blazer for office and events. Premium polyester blend.',249.99,'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',17,'2026-08-26 08:42:38','clothing',0),(33,'Casual Linen Shirt','Breathable linen shirt perfect for summer. Relaxed collar.',59.99,'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=400&fit=crop',40,'2026-08-26 08:42:38','clothing',0),(34,'Denim Shorts','Comfortable mid-rise denim shorts with stretch.',39.99,'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=400&fit=crop',33,'2026-08-26 08:42:38','clothing',0),(35,'Knit Beanie','Soft acrylic beanie to keep you warm. Unisex style.',19.99,'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=400&h=400&fit=crop',55,'2026-08-26 08:42:38','clothing',0),(36,'Leather Belt','Genuine leather belt with premium buckle. Adjustable.',29.99,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',38,'2026-08-26 08:42:38','accessories',0),(37,'Aviator Sunglasses','Classic polarized aviators with UV400 protection.',89.99,'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&h=400&fit=crop',22,'2026-08-26 08:42:38','accessories',0),(38,'Canvas Tote Bag','Eco-friendly heavy-duty canvas tote for daily use.',24.99,'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&h=400&fit=crop',47,'2026-08-26 08:42:38','accessories',0),(39,'Smart Ring','Fitness & sleep tracking ring with titanium body.',179.99,'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop',12,'2026-08-26 08:42:38','accessories',0),(40,'Organic Banana Bunch','Naturally ripened bananas, rich in potassium.',2.99,'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=400&fit=crop',120,'2026-08-26 08:42:38','vegetables',0),(42,'Green Spinach','Tender spinach leaves, washed and ready to cook.',3.29,'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=400&fit=crop',75,'2026-08-26 08:42:38','vegetables',0),(43,'Baby Potatoes','Creamy baby potatoes ideal for roasting.',5.99,'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=400&fit=crop',65,'2026-08-26 08:42:38','vegetables',0),(44,'Wireless Earbuds','Compact earbuds with active noise cancellation.',129.99,'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop',28,'2026-08-26 08:42:38','electronics',0),(45,'Smartphone Gimbal','3-axis stabilizer for smooth mobile videos.',99.99,'https://images.unsplash.com/photo-1617005082833-1eb58ec74950?w=400&h=400&fit=crop',16,'2026-08-26 08:42:38','electronics',0),(46,'Portable SSD 1TB','Fast external SSD, USB-C, 1050MB/s read.',119.99,'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&h=400&fit=crop',22,'2026-08-26 08:42:38','electronics',0),(47,'Smart LED Bulb','16M colors, Wi-Fi controlled, works with Alexa.',14.99,'https://images.unsplash.com/photo-1550985548-3c8f0f1547a0?w=400&h=400&fit=crop',60,'2026-08-26 08:42:38','electronics',0),(48,'Bamboo Cutting Board','Sustainable bamboo board with juice groove.',19.99,'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=400&h=400&fit=crop',44,'2026-08-26 08:42:38','home-kitchen',0),(50,'Ceramic Dinner Set','12-piece stoneware set, microwave safe.',79.99,'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=400&h=400&fit=crop',26,'2026-08-26 08:42:38','home-kitchen',0),(52,'Resistance Band Set','5 stackable bands with handles and anchors.',29.99,'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=400&fit=crop',50,'2026-08-26 08:42:38','sports',0),(53,'Skipping Rope','Speed rope with ball bearings for cardio training.',12.99,'https://images.unsplash.com/photo-1596815064285-45ed8a9c355c?w=400&h=400&fit=crop',70,'2026-08-26 08:42:38','sports',0),(54,'Foam Roller','High-density foam roller for muscle recovery.',22.99,'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',38,'2026-08-26 08:42:38','sports',0),(55,'Cricket Bat','English willow bat for professional play.',159.99,'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=400&h=400&fit=crop',11,'2026-08-26 08:42:38','sports',0),(56,'Matte Lipstick','Long-lasting velvet matte lipstick, 6 shades.',19.99,'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&h=400&fit=crop',42,'2026-08-26 08:42:38','beauty',0),(57,'Hair Serum','Argan oil serum for frizz-free shiny hair.',24.99,'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=400&fit=crop',31,'2026-08-26 08:42:38','beauty',0),(58,'Facial Roller','Jade roller & gua sha for glowing skin.',16.99,'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=400&fit=crop',28,'2026-08-26 08:42:38','beauty',0),(59,'Perfume Mist','Fresh floral body mist, 100ml long-lasting.',34.99,'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=400&fit=crop',19,'2026-08-26 08:42:38','beauty',0);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (7,'charan','charan@gmail.com','$2a$10$zfJWLIpHtBNi4pv169XP7usuS33oW.UmgsTrTBfjjgTcEk4tYxTZK','2026-08-26 09:47:29');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wishlist`
--

DROP TABLE IF EXISTS `wishlist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wishlist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlist` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `wishlist_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wishlist_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wishlist`
--

LOCK TABLES `wishlist` WRITE;
/*!40000 ALTER TABLE `wishlist` DISABLE KEYS */;
/*!40000 ALTER TABLE `wishlist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_reviews`
--

DROP TABLE IF EXISTS `product_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `rating` tinyint NOT NULL,
  `comment` text,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_user_product` (`user_id`, `product_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_pr_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `link` varchar(500) DEFAULT NULL,
  `data_json` json DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `email` varchar(100) NOT NULL,
  `otp_hash` char(64) NOT NULL,
  `status` enum('pending','verified','used','expired') NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_password_resets_email_status` (`email`,`status`),
  KEY `idx_password_resets_user` (`user_id`),
  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-26 15:33:43

