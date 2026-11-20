-- Regra nova: encerrar a vaga recusa as candidaturas que ainda estavam
-- pendentes. Aplica a mesma regra às vagas que já foram encerradas antes dela.
-- Só dados; o schema não muda.
UPDATE "candidaturas" AS c
SET "status" = 'REJEITADA', "updated_at" = NOW()
FROM "jobs" AS j
WHERE j."id" = c."jobId"
  AND j."status" = 'ENCERRADA'
  AND c."status" = 'PENDENTE';
