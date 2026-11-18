# Render: Phase 3B

Use the repository-root `render.yaml`: Node web service, Starter, one instance (rate-limit counters are process-local), root `server`, build `npm ci --include=dev && npm run build`, pre-deploy `npm run prisma:migrate`, start `npm start`, health check `/health`. Render supplies `PORT`. Keep the existing static portfolio service. Route admin traffic over HTTPS on the same site as the API for cookie-based requests.

Set `DATABASE_URL` to the **direct TLS** Neon PostgreSQL connection for this service. Set `ENCRYPTION_KEY` to 32 random bytes encoded as 64 hex characters (keep a protected backup), `CORS_ORIGIN` to the exact HTTPS frontend origin without a trailing slash. Render generates `SESSION_SECRET`; the Blueprint sets `NODE_ENV=production` and `NODE_VERSION=22.16.0`. Neither owner credentials nor JWT keys belong in runtime settings.

**Before upgrading:** take a Neon branch/backup and stop old writers. On an existing unmigrated Phase 3 DB, compare it with `0001_phase3` first. Only if it matches, baseline with `npx prisma migrate resolve --applied 0001_phase3`; never baseline an empty or divergent database. The second migration deliberately invalidates old sessions, reset tokens, backup codes and potentially disclosed TOTP seeds. Multiple owners cause a transactional failure; reconcile the intended owner offline before retrying. Portfolio records remain intact.

**Provision from a trusted operator shell** using the built release and the same database/key. Set temporary `OWNER_EMAIL`, `OWNER_PASSWORD` (at least 12 characters, at most 72 UTF-8 bytes), and `OWNER_TOTP_SEED` (a new cryptographically random uppercase Base32 string, 32–64 characters, entered in the owner's authenticator). Use a private directory outside the repo:

```
npm run owner -- provision /private/path/backup-codes.json
```

For the single existing owner immediately after upgrading, use `enroll-legacy` instead, with the matching email, a **new password** and new seed. Neither command replaces an already enrolled factor. Output files must not exist; save backup codes offline and unset the three owner variables. No credentials are printed by the CLI.

**Recovery:** after establishing the owner's identity out of band, the operator runs `npm run owner -- issue-reset /private/path/reset.json`. Deliver the file's token through a private verified channel, then remove the file. It expires in 15 minutes. From a CSRF-initialized client, POST `{token,password}` to `/api/admin/auth/recovery/verify`. Success invalidates pending and verified sessions and leaves MFA mandatory. There is no public token issuance or secret retrieval endpoint.

**Client flow:** get `/api/admin/auth/csrf-token`, retain the HTTP-only cookie, and send `X-CSRF-Token` on every mutation. POST `/api/admin/auth/login` returns 202 with a rotated CSRF token. Finish at `/login/mfa` or `/login/backup-code` under the same auth prefix; use the newly rotated token for logout or CMS writes. A password-only session cannot read portfolio management data.
