-- Chat privado: a conversa passa a ser VAGA + PROFISSIONAL (antes era só a
-- vaga, e 2 aprovados na mesma vaga liam as mensagens um do outro).

-- a) coluna nova, ainda opcional, para preencher o histórico
ALTER TABLE "messages" ADD COLUMN "professional_id" VARCHAR(36);

-- b1) mensagem enviada por profissional: a conversa é dele
UPDATE "messages" AS m
SET "professional_id" = m."sender_id"
FROM "professionals" AS p
WHERE p."user_id" = m."sender_id";

-- b2) mensagem enviada pelo restaurante: uma cópia para cada profissional
-- APROVADO na vaga (com 1 aprovado, vira 1 cópia; com 2+, cada um fica com a
-- sua, que já via antes). Mantém sender, conteúdo e created_at.
INSERT INTO "messages" ("id", "job_id", "sender_id", "professional_id", "content", "created_at")
SELECT gen_random_uuid()::text, m."job_id", m."sender_id", c."professionalId", m."content", m."created_at"
FROM "messages" AS m
JOIN "candidaturas" AS c
  ON c."jobId" = m."job_id"
 AND c."status" = 'APROVADA'
WHERE m."professional_id" IS NULL;

-- b3) sobram as originais do restaurante (já copiadas) e as órfãs (vaga sem
-- aprovado): nenhuma pertence a uma conversa válida
DELETE FROM "messages" WHERE "professional_id" IS NULL;

-- c) obrigatória, com FK e índices da conversa
ALTER TABLE "messages" ALTER COLUMN "professional_id" SET NOT NULL;

DROP INDEX "messages_job_id_created_at_idx";

CREATE INDEX "messages_job_id_professional_id_created_at_idx" ON "messages"("job_id", "professional_id", "created_at");

CREATE INDEX "messages_professional_id_idx" ON "messages"("professional_id");

ALTER TABLE "messages" ADD CONSTRAINT "messages_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
