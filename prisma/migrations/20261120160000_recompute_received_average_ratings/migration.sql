-- Correção: a média gravada misturava as notas que a pessoa RECEBEU com as
-- notas que ela mesma DEU ao outro lado. Recalcula todas só com as recebidas.
-- Só dados; o schema não muda. Sem avaliações recebidas, a média fica NULL.
UPDATE "professionals" AS p
SET "averageRating" = (
  SELECT AVG(a."rating")::double precision
  FROM "avaliacoes" AS a
  WHERE a."professionalId" = p."user_id"
    AND a."avaliador_role" = 'RESTAURANTE'
);

UPDATE "restaurants" AS r
SET "averageRating" = (
  SELECT AVG(a."rating")::double precision
  FROM "avaliacoes" AS a
  WHERE a."restaurantId" = r."user_id"
    AND a."avaliador_role" = 'PROFISSIONAL'
);
