/*
  Warnings:

  - The primary key for the `professionals` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `professionals` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "professionals_user_id_key";

-- AlterTable
ALTER TABLE "professionals" DROP CONSTRAINT "professionals_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("user_id");
