-- CreateTable
CREATE TABLE "candidaturas" (
    "id" VARCHAR(36) NOT NULL,
    "jobId" VARCHAR(36) NOT NULL,
    "professionalId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidaturas_jobId_professionalId_key" ON "candidaturas"("jobId", "professionalId");

-- CreateIndex
CREATE INDEX "candidaturas_jobId_idx" ON "candidaturas"("jobId");

-- CreateIndex
CREATE INDEX "candidaturas_professionalId_idx" ON "candidaturas"("professionalId");
