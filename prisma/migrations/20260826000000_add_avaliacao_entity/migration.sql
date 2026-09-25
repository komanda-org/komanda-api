-- Repair drift: 20260707192834 created "Job" (quoted-cap) but schema maps Job to "jobs".
-- Dev DB already has "jobs" (via db push); shadow DB has "Job". Rename when present so FK below works on both.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Job') THEN
    ALTER TABLE "Job" RENAME TO "jobs";
  END IF;
  -- Drift: Job.id was UUID in old migration, schema expects VARCHAR(36). Dev already VARCHAR, shadow still UUID.
  BEGIN
    ALTER TABLE "jobs" ALTER COLUMN "id" TYPE VARCHAR(36) USING "id"::text;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" VARCHAR(36) NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "avaliador_role" "Role" NOT NULL,
    "professionalId" VARCHAR(36) NOT NULL,
    "restaurantId" VARCHAR(36) NOT NULL,
    "jobId" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_professionalId_restaurantId_jobId_avaliador_role_key" ON "avaliacoes"("professionalId", "restaurantId", "jobId", "avaliador_role");

-- CreateIndex
CREATE INDEX "avaliacoes_professionalId_idx" ON "avaliacoes"("professionalId");

-- CreateIndex
CREATE INDEX "avaliacoes_restaurantId_idx" ON "avaliacoes"("restaurantId");

-- CreateIndex
CREATE INDEX "avaliacoes_jobId_idx" ON "avaliacoes"("jobId");

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
