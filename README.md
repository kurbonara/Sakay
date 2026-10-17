# Sakay

**Find your ride. Ask once, help many.**

Sakay is a community commute guide for Metro Manila. Instead of asking “paano pumunta from X to Y?” in a Facebook group and scrolling through hundreds of repeated posts, commuters search one place for jeepney, bus, UV Express, tricycle and train routes. Each route has step-by-step directions, signboards, fares and travel times. When a route is missing, they ask once in a Q&A board that checks for duplicates before posting.

Built with **Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Row-Level Security, Realtime) · Leaflet + OpenStreetMap · Vercel**.

---

## Contents

1. [Features](#features)
2. [Who can do what](#who-can-do-what)
3. [Run it on your computer](#run-it-on-your-computer)
4. [Set up Supabase](#set-up-supabase)
5. [Deploy to Vercel](#deploy-to-vercel)
6. [Day-to-day: changing things](#day-to-day-changing-things)
7. [How the system works](#how-the-system-works)
8. [Testing](#testing)
9. [Project structure](#project-structure)

---

## Features

**Route search and discovery**
- Origin to destination search using landmarks (malls, schools, churches, terminals, stations), with autocomplete and "did you mean…" suggestions.
- **Multi-leg trips:** the database chains rides from different community routes, including short walking transfers such as MRT-3 Cubao to LRT-2 Cubao.
- Interactive map (Leaflet + OpenStreetMap) with pickup (A), drop-off (B) and numbered transfer pins.
- Regular and student/senior/PWD fares (20% discount by default), travel time per leg and in total, and the signboard text for every ride.
- Terminal and station directory with operating hours and a live **Open now / Closed** badge that flips exactly at opening and closing time.

**Community**
- Q&A board with full-text search, tabs (unanswered, answered, has best answer) and **duplicate detection**. The ask form shows similar answered threads and saved routes for the same trip before you post.
- Member-submitted routes go through moderation before they're published.
- Upvotes on answers, a best answer chosen by the asker, and **"Still accurate" / "Outdated" confirmations** on routes.
- Reports for changed fares, rerouted jeeps and closed terminals, plus commute tips and comments.

**Members**
- Profiles with contribution counts, points and badges. Points can't be faked because the database calculates them.
- Saved routes that also work **offline** (stored on the device, plus a service worker).
- Recent searches.
- Filipino / English toggle.

**Admin and moderation**
- Dashboard with live counts.
- Approve or reject routes with a note to the contributor, and edit route data.
- Report queue with a printable view and CSV export.
- Grouping of likely duplicate questions, one-click merge, close, and remove spam.
- Place, terminal and station manager with a map pin.
- Advisories (road closures, fare hikes, strikes) that start and end automatically.
- Analytics: most searched trips, **searches with no route** (missing data), most asked areas, unanswered questions, all exportable as CSV.
- Admin-only member search (masked emails), roles, suspensions, and a full **audit log**.

**Extras:** share a route or search to Facebook or Messenger (link, QR code, preview image), installable PWA, accessibility flags (PWD, senior, heavy bags), print view.

---

## Who can do what

| | Visitor | Member | Moderator | Admin |
|---|---|---|---|---|
| Search routes, read Q&A, terminals, advisories | ✅ | ✅ | ✅ | ✅ |
| Ask, answer, vote, confirm, save, tip, report | | ✅ | ✅ | ✅ |
| Submit routes (reviewed before publishing) | | ✅ | ✅ (auto-published) | ✅ |
| Edit own posts (30-minute window) | | ✅ | ✅ | ✅ |
| Pick best answer | | own questions | any | any |
| Approve or reject routes, edit route data, places, advisories | | | ✅ | ✅ |
| Handle reports, merge, close or remove content, suspend members | | | ✅ | ✅ |
| Analytics and CSV exports | | | ✅ | ✅ |
| Search members, change roles, suspend moderators, audit log | | | | ✅ |

Every rule above is enforced **in the database**, not just hidden in the UI. See [How the system works](#how-the-system-works).

---

## Run it on your computer

You need **Node.js 20 or newer** (`node -v` to check).

```bash
npm install
cp .env.example .env.local     # then fill it in (next section)
npm run dev
```

Open http://localhost:3000. If `.env.local` is missing values, the page tells you exactly which ones and where to put them.

---

## Set up Supabase

### 1. Create the project

1. Go to https://supabase.com/dashboard → **New project**.
2. **Region:** pick **Southeast Asia (Singapore)**, the closest to the Philippines. `vercel.json` is already set to Vercel's Singapore region (`sin1`), so database calls don't cross oceans. If you chose a different Supabase region, change `"regions"` in `vercel.json` to match. For example: Tokyo → `hnd1`, Sydney → `syd1`, Mumbai → `bom1`, US East → `iad1`, Frankfurt → `fra1`.
   - To check later: Dashboard → **Project Settings → General**, where the region is shown under the project details.

### 2. Fill in `.env.local`

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API → Project URL** (looks like `https://abcd1234.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Project Settings → API Keys → Publishable key** (starts with `sb_publishable_`). Older projects can use the **anon public** key from the "Legacy API keys" tab. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; your Vercel address in production |
| `NEXT_PUBLIC_TIME_ZONE` | `Asia/Manila` |

> ⚠️ **Never** put the **secret** / `service_role` key in this app. It bypasses all security rules. Sakay doesn't need it.

### 3. Create the database tables (migrations)

All database changes live in `supabase/migrations/` as timestamped SQL files. There are two ways to apply them.

**Option A: GitHub integration (recommended).** Migrations apply automatically when you push.
1. Push this project to GitHub (commands below).
2. Supabase Dashboard → **Project Settings → Integrations → GitHub → Connect** and pick your repository.
3. Set **Supabase directory** to `supabase` (the folder that contains `migrations/`).
4. Turn on **Deploy to production** and set the production branch to `main`.
5. Every push to `main` now applies any **new** migration files, in filename order.

**Option B: SQL editor (one time, no GitHub).** Open **SQL Editor → New query**, paste each file from `supabase/migrations/` **in order**, and click **Run** for each.

The first migration also creates profiles for any accounts that signed up before it ran, so nobody is left without one.

> 🔒 **Rule:** never edit a migration that has already been pushed. To change the database, add a **new** file such as `supabase/migrations/20261101000000_add_something.sql`.

### 4. Auth settings

Dashboard → **Authentication**:

1. **URL Configuration**
   - **Site URL:** `http://localhost:3000` while developing. Change it to your Vercel address (e.g. `https://sakay.vercel.app`) when you launch.
   - **Redirect URLs** → **Add URL**, and add each of:
     - `http://localhost:3000/auth/confirm`
     - `https://YOUR-APP.vercel.app/auth/confirm`
     - `https://*-YOUR-VERCEL-TEAM.vercel.app/auth/confirm` (optional: Vercel preview deployments)
2. **Turn off "Confirm email" while testing.** Supabase's built-in email sender only allows a few emails per hour.
   **Authentication → Sign In / Providers → Email** → switch **Confirm email** off → **Save**. New sign-ups are then logged in immediately.
3. **Before launch: set up custom SMTP** so confirmation and password-reset emails actually arrive.
   **Authentication → Emails → SMTP Settings** → enable custom SMTP and paste the details from a provider such as Resend, Brevo, Postmark or Amazon SES. Then turn **Confirm email** back on.

The `/auth/confirm` page handles sign-up confirmation and password-reset links (both the `?code=` and `?token_hash=` styles), so the default email templates work as-is.

### 5. Make yourself an admin

Sign up in the app first. Then **SQL Editor → New query**, replace the email, and run:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Refresh the app and an **Admin** link appears in your account menu. From then on you can promote moderators from **Admin → Members**, no SQL needed.

### 6. Realtime

Nothing to click. Migration `…_realtime.sql` adds the tables to the `supabase_realtime` publication. Pages update about a second after a change. Supabase applies each viewer's RLS rules, so people only receive changes they're allowed to see.

---

## Deploy to Vercel

1. https://vercel.com/new → **Import** your GitHub repository. The framework is detected as Next.js.
2. **Environment Variables:** add the same four from `.env.local`, but set `NEXT_PUBLIC_SITE_URL` to your Vercel address, e.g. `https://sakay.vercel.app`.
3. Click **Deploy**.
4. Back in Supabase, set **Site URL** and add the `/auth/confirm` redirect for this address (step 4 above).
5. After changing environment variables in Vercel, go to **Deployments → ⋯ → Redeploy**. `NEXT_PUBLIC_*` values are baked in at build time.

---

## Day-to-day: changing things

You push everything yourself. After a change:

```bash
git add -A
git commit -m "Describe what you changed"
git push
```

- **Vercel** redeploys automatically on every push to `main`.
- **Supabase** applies **new** files in `supabase/migrations/` on push to `main` if the GitHub integration is connected. Code-only changes don't touch the database.

First push of a brand-new repo:

```bash
git init
git add -A
git commit -m "Initial commit: Sakay"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sakay.git
git push -u origin main
```

(Create the empty repository on GitHub first: **github.com → + → New repository**, and don't add a README.)

---

## How the system works

### Data model (Postgres)

- `places`: landmarks, terminals, stations, with coordinates, aliases, vehicle types and opening hours (Asia/Manila wall-clock time).
- `routes` + `route_legs`: a route is an ordered list of legs (mode, from, to, signboard, fare, discounted fare, minutes). Totals are **trigger-maintained**.
- `route_confirmations`, `route_saves`, `route_comments`.
- `questions`, `answers`, `answer_votes`.
- `reports`, `advisories`, `search_logs`, `audit_log`, `profiles`.

### Security: the database is the referee

- **Row-Level Security on every table.** Visitors see published routes, active advisories and public content. Members also see their own pending routes, reports, saves and search history. Staff see everything they moderate.
- **No direct writes.** The `anon` and `authenticated` roles may only `SELECT` (filtered by RLS) and update four harmless profile columns (`username`, `display_name`, `bio`, `home_area`). Everything else goes through `SECURITY DEFINER` functions with `set search_path = ''`, which validate input and check the caller's role.
- **Records that prove something can't be edited:** route approvals (`reviewed_by`), points, vote scores, best answers, confirmation counts. Triggers maintain them, and a guard trigger rejects any attempt to change them.
- **Time rules live in SQL too.** The 30-minute edit window is checked at commit time, so a form opened at 0:29 and sent at 0:31 is refused. Advisories disappear from public reads the moment `ends_at` passes. Rate limits (e.g. 5 questions per hour) are also enforced in SQL.
- **Member search** (`search_users`): admin-only, needs 2+ characters, escapes `%`/`_`, returns at most 8 rows, and masks emails (`ku•••@gmail.com`).
- **Audit log:** sensitive actions (approvals, rejections, merges, role changes, suspensions, report handling, advisories) are logged, **including refused attempts**. Those functions return `{ok:false}` instead of raising an error, so the log entry isn't rolled back.

### Trip finder

`find_trips(origin, destination)` is a recursive SQL query over the legs of all published routes. It allows up to 4 rides plus walking transfers of 500 m or less between nearby stops, adds about 5 minutes of waiting per transfer, and ranks results by fewest transfers, then time, then fare. Origin and destination also match stops within 500 m, so picking "SM North EDSA" finds rides that start at North Avenue station.

### Speed and "everything feels live"

- **Cache Components / Partial Prerendering:** each page's frame (header, skeleton) is static and instant. Data that depends on the signed-in user streams in behind `<Suspense>` boundaries. Every route has a `loading.tsx` shaped like the real page.
- **Realtime:** `<LiveRefresh>` subscribes to the rows a page shows, debounces refreshes (~0.5 s), refreshes exactly when a start/end time passes, and refreshes when you return to the tab.
- **Mutations** run through Server Actions that call the RPCs and then `revalidatePath`, so going back never shows stale data. Buttons disable while working, so they can't be double-triggered.
- Tabs, filters and search boxes only change the query string. They highlight instantly, show a skeleton in the results area and navigate client-side. Re-selecting the current tab does nothing.
- Independent queries run in parallel (`Promise.all`). The user id comes from the verified JWT claims (`getClaims()`).

### Offline

Saving a route also stores a copy on the device. `/offline` and the service worker (`public/sw.js`) show your saved routes without a connection. The service worker only runs in production builds.

---

## Testing

```bash
npm run test:db     # 64 database tests on a real Postgres engine (PGlite)
npm run lint
npm run build
```

`tests/db/` boots PGlite (Postgres compiled to WebAssembly) with a stub of Supabase's `auth` schema, roles and default grants. It applies **every migration in order**, then tests RLS, the RPCs, roles, rate limits, the edit-window boundary (29:50 vs 30:01), advisory end times, LIKE escaping, email masking, audit logging of refused attempts, the trip finder, the profile backfill and the realtime publication. Rerun it after every database change.

When you report a bug, the fix comes with a test that replays your exact steps.

---

## Project structure

```
supabase/migrations/   SQL migrations (schema, RPCs, realtime, sample data)
tests/db/              Database test suite (PGlite)
src/proxy.ts           Session refresh, sign-in redirects, missing-.env.local page
src/app/               Pages (each with loading.tsx), admin area, auth, CSV exports
src/components/        UI (map, search form, filters, live refresh, share, PWA)
src/lib/               Supabase clients, auth, server actions, i18n, formatting
public/sw.js           Offline service worker
vercel.json            Vercel region (keep it next to your Supabase region)
```

### Map data and outside services

- **Place search** covers the whole Philippines. Sakay's own places come first; anything else comes from OpenStreetMap through the free [Photon](https://photon.komoot.io) geocoder. A search from a map place uses its coordinates (`find_trips_at`) and connects to the nearest stops that have routes. When someone submits a route using a map place, it's saved as a new (unverified) Sakay place.
- **Road-following lines** come from the free OpenStreetMap routing server (OSRM). They're stored with each route when it's saved, and cached in the browser for older routes.
- Both are free community services with fair-use limits. If Sakay gets busy, set `NEXT_PUBLIC_GEOCODER_URL` / `NEXT_PUBLIC_ROUTING_URL` to your own servers (see `.env.example`).

### About the sample data

`…_sample_data.sql` adds real Metro Manila landmarks and stations with approximate coordinates, plus 19 **sample routes** so the app isn't empty on day one. Sample routes show a "Sample · please verify" badge. Their fares and times are estimates; the community confirms or reports them, and moderators can edit or archive them under **Admin → Routes**. Editing a sample route removes its badge.
