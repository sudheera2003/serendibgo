-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('tourist', 'provider', 'vendor', 'admin') NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `password_hash` VARCHAR(100) NOT NULL,
    `preferred_currency` VARCHAR(3) NOT NULL DEFAULT 'LKR',
    `preferred_language` VARCHAR(5) NOT NULL DEFAULT 'en',
    `is_email_verified` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_profiles` (
    `provider_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `provider_type` ENUM('guide', 'tour_operator', 'vehicle_owner') NOT NULL,
    `business_name` VARCHAR(150) NOT NULL,
    `licence_no` VARCHAR(60) NULL,
    `description` TEXT NULL,
    `verification_status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `rejection_reason` VARCHAR(255) NULL,
    `verified_by` INTEGER NULL,
    `verified_at` DATETIME(3) NULL,
    `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `review_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `provider_profiles_user_id_key`(`user_id`),
    INDEX `provider_profiles_verification_status_idx`(`verification_status`),
    PRIMARY KEY (`provider_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_profiles` (
    `vendor_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `shop_name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `address` VARCHAR(255) NULL,
    `district` VARCHAR(60) NULL,
    `verification_status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `rejection_reason` VARCHAR(255) NULL,
    `verified_by` INTEGER NULL,
    `verified_at` DATETIME(3) NULL,
    `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `review_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendor_profiles_user_id_key`(`user_id`),
    INDEX `vendor_profiles_verification_status_idx`(`verification_status`),
    PRIMARY KEY (`vendor_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_documents` (
    `document_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `doc_type` VARCHAR(60) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destinations` (
    `destination_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `province` VARCHAR(40) NOT NULL,
    `district` VARCHAR(40) NOT NULL,
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(500) NULL,
    `entry_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `review_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `destinations_name_idx`(`name`),
    INDEX `destinations_category_idx`(`category`),
    PRIMARY KEY (`destination_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trips` (
    `trip_id` INTEGER NOT NULL AUTO_INCREMENT,
    `tourist_id` INTEGER NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `start_lat` DECIMAL(9, 6) NULL,
    `start_lng` DECIMAL(9, 6) NULL,
    `start_label` VARCHAR(120) NULL,
    `total_distance_km` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_duration_min` INTEGER NOT NULL DEFAULT 0,
    `estimated_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `distance_source` VARCHAR(20) NOT NULL DEFAULT 'estimate',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`trip_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_stops` (
    `stop_id` INTEGER NOT NULL AUTO_INCREMENT,
    `trip_id` INTEGER NOT NULL,
    `destination_id` INTEGER NOT NULL,
    `stop_order` INTEGER NOT NULL,
    `leg_distance_km` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `leg_duration_min` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `trip_stops_trip_id_stop_order_key`(`trip_id`, `stop_order`),
    PRIMARY KEY (`stop_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `distance_cache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `origin_key` VARCHAR(40) NOT NULL,
    `dest_key` VARCHAR(40) NOT NULL,
    `distance_km` DECIMAL(10, 2) NOT NULL,
    `duration_min` INTEGER NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `distance_cache_origin_key_dest_key_key`(`origin_key`, `dest_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tour_packages` (
    `package_id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `duration_days` INTEGER NOT NULL,
    `price_per_person` DECIMAL(12, 2) NOT NULL,
    `max_group_size` INTEGER NOT NULL,
    `inclusions` JSON NOT NULL,
    `exclusions` JSON NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `cancellation_policy` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `review_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`package_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_destinations` (
    `package_id` INTEGER NOT NULL,
    `destination_id` INTEGER NOT NULL,
    `day_no` INTEGER NOT NULL,

    PRIMARY KEY (`package_id`, `destination_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `vehicle_id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER NOT NULL,
    `vehicle_type` VARCHAR(30) NOT NULL,
    `make_model` VARCHAR(80) NOT NULL,
    `seats` INTEGER NOT NULL,
    `with_driver` BOOLEAN NOT NULL,
    `price_per_day` DECIMAL(12, 2) NOT NULL,
    `price_per_km` DECIMAL(12, 2) NOT NULL,
    `driver_fee_per_day` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `base_location` VARCHAR(80) NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `review_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vehicles_vehicle_type_idx`(`vehicle_type`),
    PRIMARY KEY (`vehicle_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `booking_id` INTEGER NOT NULL AUTO_INCREMENT,
    `tourist_id` INTEGER NOT NULL,
    `booking_type` ENUM('package', 'vehicle') NOT NULL,
    `package_id` INTEGER NULL,
    `vehicle_id` INTEGER NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `num_persons` INTEGER NOT NULL DEFAULT 1,
    `estimated_km` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `price_breakdown` JSON NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'accepted', 'confirmed', 'declined', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bookings_vehicle_id_start_date_end_date_idx`(`vehicle_id`, `start_date`, `end_date`),
    INDEX `bookings_package_id_start_date_idx`(`package_id`, `start_date`),
    PRIMARY KEY (`booking_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_categories` (
    `category_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `product_categories_name_key`(`name`),
    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `product_id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendor_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `stock_qty` INTEGER NOT NULL,
    `image_urls` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `review_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `products_name_idx`(`name`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `order_id` INTEGER NOT NULL AUTO_INCREMENT,
    `tourist_id` INTEGER NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `delivery_type` ENUM('hotel', 'pickup') NOT NULL,
    `hotel_name` VARCHAR(150) NULL,
    `delivery_address` VARCHAR(255) NULL,
    `status` ENUM('pending_payment', 'processing', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending_payment',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `order_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `item_status` ENUM('pending', 'packed', 'dispatched', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_items_vendor_id_item_status_idx`(`vendor_id`, `item_status`),
    PRIMARY KEY (`order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `payment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_id` INTEGER NULL,
    `order_id` INTEGER NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'LKR',
    `gateway_ref` VARCHAR(60) NOT NULL,
    `method` VARCHAR(30) NULL,
    `status` ENUM('pending', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_gateway_ref_key`(`gateway_ref`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destination_checkins` (
    `checkin_id` INTEGER NOT NULL AUTO_INCREMENT,
    `tourist_id` INTEGER NOT NULL,
    `destination_id` INTEGER NOT NULL,
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `distance_m` INTEGER NOT NULL,
    `checked_in_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`checkin_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `review_id` INTEGER NOT NULL AUTO_INCREMENT,
    `tourist_id` INTEGER NOT NULL,
    `target_type` ENUM('package', 'vehicle', 'product', 'destination') NOT NULL,
    `target_id` INTEGER NOT NULL,
    `booking_id` INTEGER NULL,
    `order_item_id` INTEGER NULL,
    `checkin_id` INTEGER NULL,
    `rating` TINYINT NOT NULL,
    `comment` TEXT NULL,
    `photo_urls` JSON NULL,
    `status` ENUM('visible', 'hidden', 'reported') NOT NULL DEFAULT 'visible',
    `report_reason` VARCHAR(255) NULL,
    `provider_reply` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reviews_booking_id_key`(`booking_id`),
    UNIQUE INDEX `reviews_order_item_id_key`(`order_item_id`),
    UNIQUE INDEX `reviews_checkin_id_key`(`checkin_id`),
    INDEX `reviews_target_type_target_id_status_idx`(`target_type`, `target_id`, `status`),
    PRIMARY KEY (`review_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `reference_type` VARCHAR(40) NULL,
    `reference_id` INTEGER NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_is_read_idx`(`user_id`, `is_read`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_tokens` (
    `token_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `expo_push_token` VARCHAR(200) NOT NULL,
    `platform` VARCHAR(10) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `device_tokens_expo_push_token_key`(`expo_push_token`),
    PRIMARY KEY (`token_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `complaints` (
    `complaint_id` INTEGER NOT NULL AUTO_INCREMENT,
    `tourist_id` INTEGER NOT NULL,
    `target_type` VARCHAR(30) NOT NULL,
    `target_id` INTEGER NULL,
    `subject` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('open', 'in_progress', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
    `resolved_by` INTEGER NULL,
    `resolution_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`complaint_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `token_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(100) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    PRIMARY KEY (`token_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_otps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `purpose` ENUM('verify_email', 'reset_password') NOT NULL,
    `code_hash` VARCHAR(100) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_otps_user_id_purpose_idx`(`user_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exchange_rates` (
    `currency_code` VARCHAR(3) NOT NULL,
    `rate_to_lkr` DECIMAL(14, 6) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`currency_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `actor_id` INTEGER NOT NULL,
    `action` VARCHAR(60) NOT NULL,
    `entity_type` VARCHAR(40) NOT NULL,
    `entity_id` INTEGER NULL,
    `details` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `provider_profiles` ADD CONSTRAINT `provider_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_profiles` ADD CONSTRAINT `provider_profiles_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_profiles` ADD CONSTRAINT `vendor_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_profiles` ADD CONSTRAINT `vendor_profiles_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_documents` ADD CONSTRAINT `verification_documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `trips_tourist_id_fkey` FOREIGN KEY (`tourist_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_stops` ADD CONSTRAINT `trip_stops_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`trip_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_stops` ADD CONSTRAINT `trip_stops_destination_id_fkey` FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`destination_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tour_packages` ADD CONSTRAINT `tour_packages_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `provider_profiles`(`provider_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_destinations` ADD CONSTRAINT `package_destinations_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `tour_packages`(`package_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_destinations` ADD CONSTRAINT `package_destinations_destination_id_fkey` FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`destination_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `provider_profiles`(`provider_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_tourist_id_fkey` FOREIGN KEY (`tourist_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `tour_packages`(`package_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`vehicle_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendor_profiles`(`vendor_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_tourist_id_fkey` FOREIGN KEY (`tourist_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendor_profiles`(`vendor_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`booking_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destination_checkins` ADD CONSTRAINT `destination_checkins_tourist_id_fkey` FOREIGN KEY (`tourist_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destination_checkins` ADD CONSTRAINT `destination_checkins_destination_id_fkey` FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`destination_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_tourist_id_fkey` FOREIGN KEY (`tourist_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`booking_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`order_item_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_checkin_id_fkey` FOREIGN KEY (`checkin_id`) REFERENCES `destination_checkins`(`checkin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_tokens` ADD CONSTRAINT `device_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_tourist_id_fkey` FOREIGN KEY (`tourist_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_resolved_by_fkey` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_otps` ADD CONSTRAINT `email_otps_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business rules from the proposal (Section 4.6)
ALTER TABLE `bookings` ADD CONSTRAINT `chk_booking_target` CHECK (
  (`booking_type` = 'package' AND `package_id` IS NOT NULL AND `vehicle_id` IS NULL) OR
  (`booking_type` = 'vehicle' AND `vehicle_id` IS NOT NULL AND `package_id` IS NULL)
);
ALTER TABLE `bookings` ADD CONSTRAINT `chk_booking_dates` CHECK (`end_date` >= `start_date`);
ALTER TABLE `payments` ADD CONSTRAINT `chk_payment_target` CHECK (
  (`booking_id` IS NOT NULL AND `order_id` IS NULL) OR (`booking_id` IS NULL AND `order_id` IS NOT NULL)
);
ALTER TABLE `reviews` ADD CONSTRAINT `chk_review_source` CHECK (
  (`booking_id` IS NOT NULL) + (`order_item_id` IS NOT NULL) + (`checkin_id` IS NOT NULL) = 1
);
ALTER TABLE `reviews` ADD CONSTRAINT `chk_review_rating` CHECK (`rating` BETWEEN 1 AND 5);
ALTER TABLE `products` ADD CONSTRAINT `chk_product_stock` CHECK (`stock_qty` >= 0);
ALTER TABLE `order_items` ADD CONSTRAINT `chk_item_qty` CHECK (`quantity` > 0);
