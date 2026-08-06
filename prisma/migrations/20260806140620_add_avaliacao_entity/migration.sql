-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" VARCHAR(36) NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "professionalId" VARCHAR(36) NOT NULL,
    "restaurantId" VARCHAR(36) NOT NULL,
    "jobId" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avaliacoes_professionalId_idx" ON "avaliacoes"("professionalId");

-- CreateIndex
CREATE INDEX "avaliacoes_restaurantId_idx" ON "avaliacoes"("restaurantId");

-- CreateIndex
CREATE INDEX "avaliacoes_jobId_idx" ON "avaliacoes"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_professionalId_restaurantId_jobId_key" ON "avaliacoes"("professionalId", "restaurantId", "jobId");

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
