-- AlterTable
ALTER TABLE `trips` ADD COLUMN `avoid_highways` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `route_geometry` JSON NULL;
