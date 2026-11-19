# Render: Phase 3B

## Portfolio Studio

The authenticated admin UI is served by the same Node service at `/admin` (login at `/admin/login`). It is a dependency-free SPA in `server/public/studio/` that reads live data from `/api/admin/dashboard`, `/api/admin/dashboard/notifications`, `/api/admin/dashboard/search` and the existing CRUD endpoints. Statistics and activity are read from the database; the UI contains no placeholder metrics.

`vercel.mjs` proxies `/api/(.*)`, `/admin` and `/admin/(.*)` to `RENDER_API_ORIGIN` with the shared `x-origin-secret`. Set `RENDER_API_ORIGIN` to the Render service's exact `https://….onrender.com` origin and set the same `ORIGIN_SECRET` on both services. Without `RENDER_API_ORIGIN` Vercel serves only the static portfolio and no admin routes are exposed. Keep `/admin` behind HTTPS: the session cookie is `Secure; HttpOnly; SameSite=Lax` and host-only. Never point the browser directly at the Render origin for Studio pages.

## Same-origin routing

Vercel project root = repository root, framework = Other, no build command, output = `dist`. `vercel.mjs` enables an external rewrite **only** when `RENDER_API_ORIGIN` is set to your owned Render service's exact `https://….onrender.com` origin. With no upstream it serves the static portfolio. Configure the same high-entropy `ORIGIN_SECRET` (at least 32 characters) as a private environment variable on both services. Never expose it to frontend code. Use separate preview services, databases and keys; do not give untrusted PR previews access to production settings.

The browser uses relative `/api/...` URLs on the portfolio origin. Vercel forwards the path, method, body, cookies and `X-CSRF-Token`, overwriting `x-origin-secret`. Render rejects direct production API requests without that secret; `/health` remains public. Set Render `CORS_ORIGIN` to the exact **Vercel** HTTPS origin. The host-only `Secure; HttpOnly; SameSite=Lax` cookie belongs to the browser-facing origin; do not set a Render cookie domain or redirect clients to Render. API responses are `private, no-store`; do not add CDN cache rules. Keep authentication, MFA, CSRF and rate limits active behind the proxy. See [Vercel external rewrites and origin restriction](https://vercel.com/docs/rewrites#restricting-your-origin-to-vercel-traffic).

Before enabling real traffic, use a trusted preview paired with a disposable backend to verify the cookie stays on the preview origin, `/api/admin/auth/csrf-token` is not cached, a missing CSRF token fails, and a direct Render API request returns 403. Rate limits are process-local; the immediate proxy address may be shared. Validate client attribution against the actual proxy chain before relying on per-IP limits; do not blindly trust arbitrary forwarding headers.

## Render compute options

| Setting | Free (testing/demo) | Paid (checked-in Blueprint) |
|---|---|---|
| Service | Node web service, Free, one instance | Node web service, Starter, one instance |
| Root / build | `server` / `npm ci --include=dev && npm run build` | Same |
| Migration | No pre-deploy command. From a trusted local/CI checkout of the release, run `npm run prisma:migrate` against the demo DB **before** manually deploying | `npm run prisma:migrate` in the pre-deploy step |
| Start / health | `npm start` / `/health` | Same |
| Operations | Cold start after 15 minutes idle; no shell, one-off jobs or persistent disk. Run owner CLI from a trusted machine | No free-tier idle spin-down; use trusted local shell or paid service shell for maintenance |

Both options use the external TLS PostgreSQL database and stable secrets below. Use manual deploys; do not put owner credentials in build/start commands. Render's free Postgres expires after 30 days and has no backups; it is not durable production storage. The Free web service has workspace quotas, and in-memory throttles reset on restart. See [Render Free limitations](https://render.com/docs/free) and [pre-deploy commands](https://render.com/docs/deploys#pre-deploy-command).

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
