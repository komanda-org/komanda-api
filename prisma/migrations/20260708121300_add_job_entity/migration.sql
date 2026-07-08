-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CLT','PJ','FREELANCER','ESTAGIO');
CREATE TYPE "JobStatus" AS ENUM ('ABERTA','PAUSADA','ENCERRADA');
-- CreateTable
CREATE TABLE "Job" (
    "id" VARCHAR(36) NOT NULL,
    "restaurantId" VARCHAR(36) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "salary" DECIMAL(10,2),
    "contractType" "ContractType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'ABERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Job_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "Restaurant"("userId") ON DELETE CASCADE
);
-- CreateIndex
CREATE INDEX "Job_restaurantId_idx" ON "Job"("restaurantId");
CREATE INDEX "Job_status_idx" ON "Job"("status");
