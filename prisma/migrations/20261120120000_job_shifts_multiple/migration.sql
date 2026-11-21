-- Turno da vaga deixa de ser texto livre único e vira lista de valores fixos
-- (MANHA, TARDE, NOITE, INTEGRAL). MADRUGADA sai e vira INTEGRAL.

-- CreateEnum
CREATE TYPE "JobShift" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'INTEGRAL');

-- AddColumn
ALTER TABLE "jobs" ADD COLUMN "shifts" "JobShift"[] NOT NULL DEFAULT ARRAY[]::"JobShift"[];

-- Copia o turno antigo. Texto já era gravado em maiúsculas pelo DTO; o que
-- não for um turno conhecido fica como "não informado" (lista vazia).
UPDATE "jobs"
SET "shifts" = CASE upper(trim("shift"))
  WHEN 'MANHA' THEN ARRAY['MANHA']::"JobShift"[]
  WHEN 'MANHÃ' THEN ARRAY['MANHA']::"JobShift"[]
  WHEN 'TARDE' THEN ARRAY['TARDE']::"JobShift"[]
  WHEN 'NOITE' THEN ARRAY['NOITE']::"JobShift"[]
  WHEN 'INTEGRAL' THEN ARRAY['INTEGRAL']::"JobShift"[]
  WHEN 'MADRUGADA' THEN ARRAY['INTEGRAL']::"JobShift"[]
  ELSE ARRAY[]::"JobShift"[]
END
WHERE "shift" IS NOT NULL;

-- DropColumn
ALTER TABLE "jobs" DROP COLUMN "shift";
