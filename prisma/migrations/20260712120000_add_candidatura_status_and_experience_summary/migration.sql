-- CreateEnum
CREATE TYPE "CandidaturaStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- AlterTable
ALTER TABLE "candidaturas" ADD COLUMN "status" "CandidaturaStatus" NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN "experience_summary" TEXT;

-- CreateIndex
CREATE INDEX "candidaturas_jobId_status_idx" ON "candidaturas"("jobId", "status");
