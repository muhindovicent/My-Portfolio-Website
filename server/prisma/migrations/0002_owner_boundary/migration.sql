BEGIN;
-- Fails closed if legacy data contains multiple administrators. Never choose an owner implicitly.
CREATE UNIQUE INDEX "Administrator_single_owner" ON "Administrator" ((1));
ALTER TABLE "Administrator" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
-- Invalidate legacy sessions, reset tokens and factors (the old API could disclose them).
DELETE FROM "Session";
DELETE FROM "BackupCode";
DELETE FROM "PasswordResetToken";
DELETE FROM "MfaSecret";
ALTER TABLE "MfaSecret" RENAME COLUMN "secret" TO "ciphertext";
ALTER TABLE "MfaSecret" ADD COLUMN "lastStep" INTEGER NOT NULL DEFAULT -1;
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken" ("tokenHash");
COMMIT;
