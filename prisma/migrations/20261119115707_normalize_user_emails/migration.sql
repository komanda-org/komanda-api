-- O login compara o e-mail em minúsculas, mas o cadastro de profissional
-- gravava o e-mail como digitado. Normaliza os registros antigos.
--
-- Se dois usuários colidirem após normalizar (ex.: "Ana@x.com" e "ana@x.com"),
-- a restrição UNIQUE quebraria no meio do UPDATE; falhamos antes, com uma
-- mensagem clara, para a colisão ser resolvida manualmente.
DO $$
DECLARE
  duplicated TEXT;
BEGIN
  SELECT string_agg(normalized, ', ') INTO duplicated
  FROM (
    SELECT LOWER(TRIM(email)) AS normalized
    FROM users
    GROUP BY 1
    HAVING COUNT(*) > 1
  ) d;

  IF duplicated IS NOT NULL THEN
    RAISE EXCEPTION 'E-mails duplicados após normalizar: %', duplicated;
  END IF;
END $$;

UPDATE users
SET email = LOWER(TRIM(email))
WHERE email <> LOWER(TRIM(email));
