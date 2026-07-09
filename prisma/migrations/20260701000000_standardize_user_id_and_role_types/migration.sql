-- Standardize types for consistency across the schema.
-- TEXT -> VARCHAR(36) for user_id (UUID-sized, matches users.id and jobs.id).
-- TEXT -> VARCHAR(120) for jobs.role (job role name; should fit in 120 chars).

ALTER TABLE "professionals" ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(36);
ALTER TABLE "jobs" ALTER COLUMN "role" SET DATA TYPE VARCHAR(120);

-- description remains TEXT (intentionally unbounded; job descriptions can be long).
