# j-info platform

A narrow, monochrome job and exam preparation frontend with a layered Express/Mongoose REST API.

## Requirements

- Node.js 20 or newer
- MongoDB 7+ (MongoDB Atlas is recommended; Atlas Search is used for job text search)
- External credentials only for features you enable: Google OAuth, Twilio, Cloudinary, SMTP

## Configure and run

```sh
npm install
cp .env.example .env
```

Set `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and the client origin in `.env`. Use two distinct random secrets of at least 32 characters. The server fails early if either JWT secret is missing and rejects example secret placeholders in production. Optional integrations stay disabled until their credentials are configured. Never commit `.env`.

```sh
npm run dev
# or
npm start
```

The Express app serves the existing frontend at `http://localhost:3000/` and APIs under `/api`. If running the frontend separately (for example, VS Code Live Server), add its exact origin to comma-separated `CLIENT_ORIGIN` and use same-site localhost hostnames for cookie authentication.

Seed/update boards, jobs, communities, preparation resources, eligible global notifications, and FAQs from the current `data.json`:

```sh
npm run seed
```

Seeding uses stable upserts. The supplied job dates are demo values: new job records enter `PENDING_REVIEW` and are not publicly searchable until a human verifies and publishes them. Seed notices tied to those jobs are imported as unpublished admin notices and are never issued to users automatically. The initial UPSC, SSC, RRB, West Bengal Police, WBCS, BPSC, and CIL source records are inactive. Only official URLs already provided in the project are recorded; WBCS/BPSC/CIL records have no invented URLs. Configure a verified source adapter before enabling scheduled fetches.

Configure development bootstrap identities with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` / optional `SUPER_ADMIN_NAME`, `ADMIN_EMAIL` / `ADMIN_PASSWORD` / optional `ADMIN_NAME` and `ADMIN_MOBILE`, and `AUTHOR_EMAIL` / `AUTHOR_PASSWORD` / optional `AUTHOR_NAME` and `AUTHOR_MOBILE` in the root `.env`. Run `npm run seed` from the project root. Only these explicitly configured identities are reconciled; ordinary users are never touched. Passwords are bcrypt-hashed and never printed. Changing a configured bootstrap password in `.env` and rerunning the seed resets that account's password and invalidates its sessions. The configured email also determines that bootstrap account's intended role. Keep these bootstrap variables for development/test use, not production.

Bootstrap passwords must contain 12 to 128 characters. `AUTHOR_EMAIL` must end in `.local` or `.test`; mobile numbers, when set, use E.164 format. The bootstrap reconciler uses the existing User model and bcrypt settings, increments `authTokenVersion` and clears the stored refresh token when a configured password or role changes, and preserves unrelated profile fields. Duplicate email assignments across bootstrap roles fail preflight. Bootstrap accounts are limited to `NODE_ENV=development` or `test`.

Run the bootstrap unit suite with `npm test`.

## Authentication and roles

Email/password accounts use bcrypt password hashes, single-use expiring verification/reset tokens, short-lived access JWT cookies, and rotating refresh JWT cookies. Google OAuth uses Passport and the Express callback. Phone sign-in is presented as Coming Soon; phone login, OTP, and phone-password endpoints return `503` in production. No Twilio configuration is required to run the application. Cookies are HTTP-only, SameSite=Lax, and Secure when `COOKIE_SECURE=true`.

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

For local development, use a Google OAuth Web application client with JavaScript origin `http://localhost:3000` and redirect URI `http://localhost:3000/api/auth/google/callback`. Set `CLIENT_ORIGIN` to the actual browser origin and `GOOGLE_CALLBACK_URL` to the exact callback URI registered with Google. Production requires the real HTTPS frontend origin and backend callback URI; do not reuse localhost or add an unselected production domain to configuration.

For a public launch, use a production Google Cloud project/client, set the OAuth audience to **External**, complete app branding with the actual J-Info/Jpedia name, support and developer contact addresses, and add only domains the team owns. Google requires a publicly reachable home page and verified domains; add the actual Privacy Policy and Terms URLs when those pages/domains exist. Do not invent these URLs. The current OAuth request is limited to `profile` and `email` (Google sign-in identity scopes); it does not request Gmail, Drive, or other API access. Google documents basic identity scopes as available to all users when published, while branding/domain requirements still apply. If scopes are added later, review their classification and complete Google verification before production when required.

The source code cannot publish the consent screen or prove that a Google project is public/verified. In Cloud Console, publish the External app and complete any branding review, use production-only HTTPS origins/redirect URI, then test sign-in with a non-test Google account. Keep OAuth client secrets only in the backend environment.

## Current limits

- Live database, OAuth, SMTP, and Cloudinary behavior depends on valid deployment credentials and reachable provider services; verify each against the target environment before release.
- The existing frontend now loads public home data from `/api/bootstrap` when that API is available and falls back to `data.json`. Authenticated workflows have REST endpoints and cookie support; the page does not yet expose a complete profile, notification center, community composer, or admin dashboard UI.
- Source-specific scrapers, queue infrastructure, downloadable resource catalog entries, and a full automated test suite are not included. Source discovery remains safely inactive until configured.
