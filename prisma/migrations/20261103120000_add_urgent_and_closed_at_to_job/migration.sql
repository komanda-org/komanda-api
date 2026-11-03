-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false;
