/*
  Warnings:

  - You are about to drop the column `createdAt` on the `candidaturas` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `candidaturas` table. All the data in the column will be lost.
  - You are about to drop the column `contractType` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `restaurantId` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `jobs` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `candidaturas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contract_type` to the `jobs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `restaurant_id` to the `jobs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `jobs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "DenunciaStatus" AS ENUM ('PENDENTE');

-- CreateEnum
CREATE TYPE "DenunciaTargetType" AS ENUM ('PERFIL', 'VAGA', 'MENSAGEM');

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "Job_restaurantId_fkey";

-- DropIndex
DROP INDEX "Job_restaurantId_idx";

-- AlterTable
ALTER TABLE "candidaturas" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "jobs" RENAME CONSTRAINT "Job_pkey" TO "jobs_pkey";

-- AlterTable
ALTER TABLE "jobs"
DROP COLUMN "contractType",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "restaurantId",
DROP COLUMN "updatedAt",
ADD COLUMN     "contract_type" "ContractType" NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "restaurant_id" VARCHAR(36) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "denuncias" (
    "id" VARCHAR(36) NOT NULL,
    "author_id" VARCHAR(36) NOT NULL,
    "target_type" "DenunciaTargetType" NOT NULL,
    "target_id" VARCHAR(36) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DenunciaStatus" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denuncias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "denuncias_author_id_idx" ON "denuncias"("author_id");

-- CreateIndex
CREATE INDEX "jobs_restaurant_id_idx" ON "jobs"("restaurant_id");

-- CreateIndex
CREATE INDEX "jobs_title_idx" ON "jobs" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "jobs_description_idx" ON "jobs" USING GIN ("description" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Job_status_idx" RENAME TO "jobs_status_idx";
