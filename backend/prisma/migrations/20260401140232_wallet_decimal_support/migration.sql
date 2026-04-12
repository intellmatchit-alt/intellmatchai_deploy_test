-- AlterTable: Convert wallet balance and transaction amounts from INT to DECIMAL(10,2)
ALTER TABLE `wallets` MODIFY COLUMN `balance` DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE `wallet_transactions` MODIFY COLUMN `amount` DECIMAL(10,2) NOT NULL;
ALTER TABLE `wallet_transactions` MODIFY COLUMN `balance` DECIMAL(10,2) NOT NULL;
