-- CreateEnum
CREATE TYPE "WorkModel" AS ENUM ('CLT', 'PJ', 'FREELANCER', 'TEMPORARIO');

-- CreateEnum
CREATE TYPE "Mobility" AS ENUM ('LOCAL', 'REGIONAL', 'NACIONAL', 'INTERNACIONAL');

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "city" TEXT,
ADD COLUMN     "mobility" "Mobility",
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "state" VARCHAR(2),
ADD COLUMN     "work_models" "WorkModel"[] DEFAULT ARRAY[]::"WorkModel"[];

-- CreateTable
CREATE TABLE "professional_experiences" (
    "id" VARCHAR(36) NOT NULL,
    "professional_id" VARCHAR(36) NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professional_experiences_professional_id_idx" ON "professional_experiences"("professional_id");

-- AddForeignKey
ALTER TABLE "professional_experiences" ADD CONSTRAINT "professional_experiences_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
