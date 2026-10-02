# SetBGet

**set become and get**

SetBGet is a job and exam preparation platform with a monochrome frontend and Express/Mongoose REST API.

## Requirements

- Node.js 20 or newer
- MongoDB 7+ (MongoDB Atlas is recommended; Atlas Search is used for job text search)
- External credentials only for features you enable: Google OAuth, Twilio, Cloudinary, SMTP

## Configure and run

```sh
npm install
```

For local development, create `.env` with `NODE_ENV=development`, `MONGODB_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`. Use two distinct random secrets of at least 32 characters. `backend/.env.example` is the local backend template; `.env.example` documents the production backend shape. Never commit `.env`.

```sh
npm run dev
# or
npm start
```

The Express app serves the root-level frontend locally and on the retained Render fallback at `http://localhost:3000/`. The split frontend may instead be built and served on port 5500; configure the backend `CLIENT_ORIGINS=http://localhost:5500` and frontend `PUBLIC_API_BASE_URL=http://localhost:3000/api` for that setup.

## Vercel deployment preparation

The frontend stays plain HTML/CSS/JavaScript. Vercel now uses two project roots: `frontend/` for the static frontend and `backend/` for the Express API Function and Cron configuration. See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for exact project settings, environment variables, provider setup, and preview strategy. The root project files and Render configuration remain as a temporary combined-app fallback.

Do not import the repository root as the new Vercel project. Create one project per subdirectory and keep all credentials in the backend project only. The migration has not been deployed and Render remains available as the backup.

Vercel Cron uses UTC and invokes production deployments only. Recruitment runs daily at 03:00 UTC; the reminder, deadline-notice, and expiry tasks retain their existing intervals. Hobby permits at most one run per day for each cron job, so the 15-minute reminder requires a plan that supports more frequent schedules. Vercel sends `Authorization: Bearer $CRON_SECRET`; the application fails closed if the secret is missing or invalid. Configure the secret in the backend project.

Resource files continue to allow PDF and image formats up to 15 MB. The admin uploader requests a short-lived signed Cloudinary upload, sends the file directly to Cloudinary, then asks Express to verify the signed asset and save its metadata. This avoids Vercel Function's 4.5 MB request-body limit. No uploaded file is persisted on the Vercel filesystem.

Before switching production traffic, configure MongoDB Atlas Network Access for the Vercel Function's outbound connectivity, and ensure the database user has the privileges needed for application collections, Atlas Search, rate-limit counters, and scheduled-task locks. Vercel egress IPs are dynamic unless Static IPs or Secure Compute are configured; use the appropriate Vercel connectivity option if Atlas requires IP allowlisting. Static IPs are available on Pro/Enterprise, while Secure Compute is Enterprise. Do not open Atlas to all addresses solely to avoid configuring egress access.

Set `CLIENT_ORIGINS` to the exact allowed frontend HTTPS origin(s) and `GOOGLE_CALLBACK_URL` to the backend origin plus `/api/auth/google/callback`. Keep the existing Render origin and callback registered in Google Cloud during the backup period. Set Gmail App Password SMTP values and Cloudinary API values only in the Vercel backend environment. The repository is prepared for deployment but has not been deployed or connected to these providers.

Seed/update boards, jobs, communities, preparation resources, eligible global notifications, and FAQs from the current `data.json`:

```sh
npm run seed
```

Seeding uses stable upserts. The supplied job dates are demo values: new job records enter `PENDING_REVIEW` and are not publicly searchable until a human verifies and publishes them. Seed notices tied to those jobs are imported as unpublished admin notices and are never issued to users automatically. The initial UPSC, SSC, RRB, West Bengal Police, WBCS, BPSC, and CIL source records are inactive. Only official URLs already provided in the project are recorded; WBCS/BPSC/CIL records have no invented URLs. Configure a verified source adapter before enabling scheduled fetches.

Configure development bootstrap identities with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` / optional `SUPER_ADMIN_NAME`, `ADMIN_EMAIL` / `ADMIN_PASSWORD` / optional `ADMIN_NAME` and `ADMIN_MOBILE`, and `AUTHOR_EMAIL` / `AUTHOR_PASSWORD` / optional `AUTHOR_NAME` and `AUTHOR_MOBILE` in the root `.env`. Run `npm run seed` from the project root. Only these explicitly configured identities are reconciled; ordinary users are never touched. Passwords are bcrypt-hashed and never printed. Changing a configured bootstrap password in `.env` and rerunning the seed resets that account's password and invalidates its sessions. The configured email also determines that bootstrap account's intended role. Keep these bootstrap variables for development/test use, not production.

Bootstrap passwords must contain 12 to 128 characters. `AUTHOR_EMAIL` must end in `.local` or `.test`; mobile numbers, when set, use E.164 format. The bootstrap reconciler uses the existing User model and bcrypt settings, increments `authTokenVersion` and clears the stored refresh token when a configured password or role changes, and preserves unrelated profile fields. Duplicate email assignments across bootstrap roles fail preflight. Bootstrap accounts are limited to `NODE_ENV=development` or `test`.

Run the bootstrap unit suite with `npm test`.

## Authentication and roles

Email/password accounts use bcrypt password hashes, single-use expiring verification/reset tokens, short-lived access JWT cookies, and rotating refresh JWT cookies. Google OAuth uses Passport and the Express callback. Phone sign-in is presented as Coming Soon; phone login, OTP, and phone-password endpoints return `503` in production. No Twilio configuration is required to run the application. Cookies are HTTP-only, API-host scoped, Secure in production, and use `SameSite=None` for separate frontend/API origins.

Roles are `USER`, `AUTHOR`, `ADMIN`, and `SUPER_ADMIN`; registration always assigns `USER`. Authors can manage their own drafts/resources and submit jobs for review. Admins moderate and publish. Only Super Admin can assign or remove elevated admin roles. The backend checks ownership and roles independently of the frontend.

## Main API

Responses use `{success:true,data:...}` and paginated collections add a `pagination` object. Errors use `{success:false,error:{code,message}}`.

- `GET /api/health`, `GET /api/bootstrap` — health and public home-page data
- `POST /api/auth/register`, `/login`, `/login/phone`, `/logout`, `/refresh`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`, `/send-otp`, `/verify-otp`
- `GET/PATCH/DELETE /api/users/me`; notification preferences at `/api/users/me/notification-preferences`
- `GET /api/jobs?q=&board=&category=&qualification=&location=&tag=&deadlineBefore=&deadlineAfter=&page=&limit=`; job detail accepts id or slug
- `POST/PATCH/DELETE /api/jobs`; `POST /api/jobs/:id/submit-review`
- `GET /api/boards`, `/api/boards/:slug`
- `/api/saved-jobs`, `/api/applications`, `/api/notifications`
- `/api/communities`, `/api/communities/:id/join`, community post/comment routes, reactions and reports
- `/api/resources` and authenticated `POST /api/resources/upload` (multipart `file`, `title`, `type`)
- `/api/faqs`
- `/api/admin/dashboard`, `/users`, `/reports`, `/notifications`, `/jobs/pending`, `/discoveries`, `/sources`
- Admin review routes include approve, publish, reject, unpublish, source CRUD, and asynchronous `POST /api/admin/sources/fetch-all` / `:id/fetch`
- Admin global notices: `POST /api/notifications/global`

See route files under `backend/src/routes` for request body shapes and protections.

## Boards

- Public pages are available at `/boards/:slug`; their API is `GET /api/boards/:slug?page=&limit=` (legacy Board IDs are also accepted by the API). It returns only active public Board fields, published jobs for the Board, upcoming published jobs, and active Board-linked preparation resources. Jobs and boards use the existing `Job.board` ObjectId reference.
- Public Board discovery/search is `GET /api/boards?q=&page=&limit=`. The Admin editor/list uses authenticated `GET/POST /api/admin/boards`, `GET/PATCH /api/admin/boards/:id`; only ADMIN and SUPER_ADMIN may access those routes. Deactivation is an `active:false` patch. The legacy `DELETE /api/boards/:id` is also a protected soft deactivation.
- Job lists support server-side Board filtering through the existing `GET /api/jobs?board=<slug-or-id>&page=&limit=` endpoint. An unknown slug matches no jobs.
- Homepage board filter labels map an RRB Board to “Railway” and any Police-named/category Board to “Police”; the underlying request still filters by that Board’s database slug. All other filters use the Board name and slug directly.
- The seed uses existing Board entries from `data.json`, plus the West Bengal Police Board without an official URL. Seeded Boards remain inactive unless a record explicitly marks them active; an admin can verify information and activate them. The seed does not manufacture URLs or Board descriptions.

## Database and Atlas Search

Mongoose models/indexes live in `backend/src/models/index.js`. Job text search uses the named Atlas Search index `jobs_search` over title, organization, boardName, tags, category, qualification, location, and description; status is indexed for filtering. On startup the server requests index creation where the Atlas account supports it. Otherwise create the index in Atlas using the definition in `backend/src/config/atlasSearch.js`. Search returns `503 SEARCH_NOT_CONFIGURED` when the Atlas Search index is absent; it does not silently fall back to a collection-wide regex scan.

## Recruitment discovery

The scheduler uses `RECRUITMENT_CRON` (default `0 3 * * *`, once per day), a 15-minute reminder cycle, daily deadline notices, and daily expiry updates. Fetching runs asynchronously. Each active source uses an adapter with `fetch`, `parse`, and `normalize`; unsupported RSS/static HTML/PDF/JavaScript source types report a source-specific failure and do not crash other sources. The first API adapter accepts JSON arrays or `{items: [...]}` from HTTPS endpoints only. It checks host consistency, fingerprints discoveries, checks official URLs/source IDs/title-organization-deadline duplicates, and creates `JobDiscovery` review records. Discovered content is never auto-published. Initial official source adapters for UPSC, SSC, RRB, West Bengal Police, WBCS, BPSC, and CIL still need individual verified parser implementations; no scraper is claimed to work for those sites yet.

## Optional providers

- SMTP: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- Optional legacy development SMS provider settings (not required; phone authentication is disabled in production): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_FROM_NUMBER`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

SMS/email delivery honors account notification preferences. File uploads enforce a 15 MB limit and allow PDF or image MIME types before Cloudinary upload.

### Google OAuth deployment

For split-origin local development, use a Google OAuth Web application client with authorized JavaScript origin `http://localhost:5500` and redirect URI `http://localhost:3000/api/auth/google/callback`. Set `CLIENT_ORIGINS` to the actual browser origin and `GOOGLE_CALLBACK_URL` to the exact backend callback URI registered with Google. Production requires the real HTTPS frontend origin and backend callback URI; do not reuse localhost or add an unselected production domain to configuration.

For the current Render backup, keep its existing authorized JavaScript origin and exact callback URI registered until Vercel production is verified. For Vercel, register the frontend authorized JavaScript origin and the API backend callback `<api-vercel-origin>/api/auth/google/callback`, then set `CLIENT_ORIGINS` and `GOOGLE_CALLBACK_URL` in the backend environment. Keep OAuth secrets server-side. The application pages are available at `/privacy`, `/terms`, `/about`, and `/contact` on the frontend origin.

When an owned custom SetBGet domain is selected later, register its exact HTTPS frontend origin and separately register the API callback URI (for example, `https://<api-host>/api/auth/google/callback`). Update `CLIENT_ORIGINS` and `GOOGLE_CALLBACK_URL` to match, and add the URLs to Google only after those domains are controlled and configured.

For a public launch, use a production Google Cloud project/client, set the OAuth audience to **External**, and complete app branding with the actual SetBGet name and operator-approved support/developer contact addresses. The application source requests only `profile` and `email` (basic sign-in identity scopes); it does not request Gmail, Drive, or other Google API access. Completing this documentation and serving the public pages does not publish the consent screen, verify a domain, or establish Google approval. Complete the required Google Cloud configuration and any branding review in the Console.

The source code cannot publish the consent screen or prove that a Google project is public/verified. In Cloud Console, publish the External app and complete any branding review, use production-only HTTPS origins/redirect URI, then test sign-in with a non-test Google account. Keep OAuth client secrets only in the backend environment.

## Current limits

- Live database, OAuth, SMTP, and Cloudinary behavior depends on valid deployment credentials and reachable provider services; verify each against the target environment before release.
- The existing frontend now loads public home data from `/api/bootstrap` when that API is available and falls back to `data.json`. Authenticated workflows have REST endpoints and cookie support; the page does not yet expose a complete profile, notification center, community composer, or admin dashboard UI.
- Source-specific scrapers, queue infrastructure, downloadable resource catalog entries, and a full automated test suite are not included. Source discovery remains safely inactive until configured.
