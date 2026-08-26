-- Standardize types for consistency across the schema.
-- TEXT -> VARCHAR(36) for user_id (UUID-sized, matches users.id).

ALTER TABLE "professionals" ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(36);
