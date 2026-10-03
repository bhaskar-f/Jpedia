# SetBGet: separate Vercel frontend and API

The repository keeps the existing root-level combined app as a local/Render migration fallback. Create two Vercel projects from the same repository and set their **Root Directory** to the folders below. Neither project is deployed by this preparation.

```text
Browser → Vercel static frontend → HTTPS → Vercel Express API → MongoDB Atlas / Google / Gmail / Cloudinary
```

## Project 1: Frontend

- Root Directory: `frontend`
- Framework Preset: Other (static HTML/CSS/JavaScript)
- Build Command: `npm run build`
- Output Directory: `public`
- Install Command: default `npm install` (there are no frontend runtime dependencies)
- Environment variable: `PUBLIC_API_BASE_URL` only. Set to `https://<api-project-domain>/api` in Production. Set an API Preview deployment URL in Preview; do not copy the production URL into Preview unless that fallback is deliberate.
- `frontend/build.js` embeds this public URL in `public/api-config.js`. It validates the URL and exposes no backend environment values.
- `frontend/vercel.json` serves existing assets and sends application paths to `index.html`; `/api` paths are excluded.

Local frontend: `cd frontend && npm run build` then serve `frontend/public` with any static server on port 5500. With no environment override, the build's API URL is `http://localhost:3000/api`.

## Project 2: Backend/API

- Vercel project name: `setbget-api`
- Root Directory: `backend`
- Framework Preset: Other
- Build Command: leave empty (no compile step)
- Install Command: default `npm install`
- The Function entrypoint is `backend/api/[...path].js`; it initializes the cached MongoDB connection and Atlas Search index once per warm instance, then passes every `/api/*` request to the existing Express app.
- Local server: `npm run dev` from the repository root uses the root `.env` and starts the combined Express/frontend experience on port 3000. If running the backend package directly with `cd backend && npm install && npm run dev`, copy `backend/.env.example` to `backend/.env` first. For separate frontend/backend local origins, run the root backend command and serve `frontend/public` on `http://localhost:5500`.
- Select the Vercel Function region after checking the actual MongoDB Atlas cluster region in Atlas. Place the API function in the closest supported Vercel region to that cluster; this repository does not infer or hardcode the Atlas region because the cluster location is account-specific. The frontend stays globally served by Vercel's CDN.

### Backend environment variables (Vercel only)

Set Production values in the API project, not the frontend project:

- `NODE_ENV=production`
- `CLIENT_ORIGINS=https://<frontend-production-domain>`; comma-separate only exact approved frontend origins. Add exact Preview frontend origins in the Preview environment separately.
- `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`
- `MONGODB_URI`
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (distinct random values, at least 32 characters)
- `ACCESS_TOKEN_TTL=15m`, `REFRESH_TOKEN_DAYS=30`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL=https://<api-domain>/api/auth/google/callback`
- `EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=587`, `EMAIL_SECURE=false`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `CRON_SECRET` (random value of at least 16 characters; Vercel Cron sends it as a bearer token)
- `RECRUITMENT_CRON` only controls the optional local `node-cron` schedule. Vercel production schedules are in `backend/vercel.json`.

No actual credentials belong in either example file. Do not configure secret variables in the frontend project. `backend/.env.example` has development placeholders; root `.env.example` describes the backend production shape.

## CORS, cookies, and sessions

`CLIENT_ORIGINS` is an explicit comma-separated allowlist; requests without an `Origin` (for example server-to-server health checks) are accepted, while browser origins not on the list are rejected. CORS enables credentials and never uses `*`. Use exact origin values without paths or trailing slashes.

Access and refresh cookies remain HTTP-only and scoped to the API host because no `Domain` is set. `SameSite=None; Secure` supports credentialed requests across separate deployment origins and custom domains. Frontend requests include credentials; JWTs remain out of browser storage. The API must return credentialed CORS headers for each approved frontend origin.

Google OAuth callback and password/email links are backend-owned flows: Google returns to the API callback; the callback sets session cookies and redirects to the first configured frontend origin. Email verification and reset links use that same frontend origin. Google does not need an authorized JavaScript origin for this server-side OAuth flow, but register the frontend origin as instructed for the OAuth client configuration if Google Cloud's client setup requests it.

## Provider setup

1. **Google Cloud:** Add the frontend production origin under Authorized JavaScript origins if required by the OAuth client and add the API URL plus `/api/auth/google/callback` under Authorized redirect URIs. The redirect URI must never use the frontend host. Configure Preview callback URIs only if using a separate Preview Google OAuth client.
2. **MongoDB Atlas:** Allow the Vercel API's outbound connectivity using the access policy appropriate for the selected Atlas tier/account. Confirm database user permissions and TLS. Choose the Function region near the actual cluster region; do not guess from the application's users' location.
3. **Gmail:** Use a Gmail App Password with 2-Step Verification enabled. Keep SMTP values only in backend project settings.
4. **Cloudinary:** Set the cloud name, API key, and API secret only in backend settings. Uploads remain on Cloudinary; Vercel's function filesystem is not persistent storage.

## Preview strategy

Vercel Preview frontend builds must receive `PUBLIC_API_BASE_URL` pointing to a non-production API Preview deployment. Backend Preview must have `CLIENT_ORIGINS` set to the exact preview frontend origin(s). Preview deployments use distinct Vercel hostnames; register each URL explicitly (or use a controlled preview domain) instead of accepting arbitrary `*.vercel.app` origins. Production values remain separately scoped to Production. If a dedicated backend Preview environment is not configured, preview frontend builds should fail the release checklist rather than silently target Production.

Google callback validation accepts a valid HTTPS callback on the backend host and enforces `/api/auth/google/callback`; preview OAuth should use a separate Google client and callback registration. MongoDB, Gmail, and Cloudinary credentials should be scoped to Preview only when preview workflows need them.

## Cron and recruitment

Vercel Cron is configured on the backend project only. All four jobs run once daily, which fits Vercel Hobby: recruitment at `0 3 * * *` (03:00 UTC), application reminders at `41 2 * * *` (02:41 UTC), deadline notifications at `11 2 * * *` (02:11 UTC), and job expiration at `17 1 * * *` (01:17 UTC). Vercel Hobby runs a daily cron within its scheduled hour, so the actual invocation time can vary by up to 59 minutes. Cron routes require the configured bearer secret and coordinate work with a MongoDB lease lock to avoid duplicate concurrent execution. Recruitment continues through source fetch, normalization, duplicate checks, and pending review records; discoveries are not auto-published. `node-cron` starts only in the local/Render server process and is disabled when `VERCEL=1`.

Application reminders cannot run every 15 minutes on Vercel Hobby: schedules more frequent than once daily are rejected at deployment. The existing backend reminder task and service remain in place and are invoked once per day. Each run selects every unsent application reminder with `reminderDate <= now`, sends the existing website/email/SMS notifications, and records `reminderSentAt`; reminders remain automatic but can arrive nearly 25 hours after becoming due. Local `node-cron` continues to check reminders every 15 minutes. A true 15-minute server-side schedule requires a plan or separate scheduling service with that capability; no such service is added here.

## Local setup

1. Copy `backend/.env.example` to the repository root `.env` when starting from the repository root (or to `backend/.env` when starting from `backend/`), fill local MongoDB and any provider settings, and ensure JWT secrets are distinct.
2. From the repository root run `npm install && npm run dev` for the combined local app on port 3000 (or separately serve the built static frontend on port 5500).
3. For split-origin browser testing, use `PUBLIC_API_BASE_URL=http://localhost:3000/api` when building the frontend and keep `CLIENT_ORIGINS=http://localhost:5500` on the backend. Register the exact local Google callback `http://localhost:3000/api/auth/google/callback` when testing OAuth locally.
4. Backend health check: `GET https://<api-domain>/api/health`.

## Migration and remaining operator actions

Render configuration and the root-level combined deployment are retained as a temporary fallback. No database contents or schemas are migrated or reset here. No production Vercel settings, Google settings, Atlas networking, Gmail credentials, Cloudinary settings, or live secrets were changed.

After this preparation, create/import the two projects with the roots above, add environment variables to the matching Vercel environments, configure provider callback/network access, choose the API region based on the real Atlas cluster, and deploy when ready. Keep Render until the separate projects and all authentication, upload, email, and cron workflows have been verified.
