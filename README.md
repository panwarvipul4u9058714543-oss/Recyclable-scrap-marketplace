# Recyclable-scrap-marketplace

OLX-style marketplace connecting households, kabadiwalas, scrap dealers, businesses and recyclers for recyclable scrap.

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Prisma** ORM with **SQLite** (local/dev database)
- **Vitest** + Testing Library for unit/component tests
- **Playwright** for end-to-end tests
- **ESLint** (`next/core-web-vitals`)

## Getting started

```bash
npm install
cp .env.example .env      # DATABASE_URL for SQLite
npm run db:generate       # generate the Prisma client
npm run db:push           # create the SQLite schema
npm run dev               # http://localhost:3000
```

## Scripts

| Script              | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start the dev server                        |
| `npm run build`     | Production build                            |
| `npm run start`     | Serve the production build                  |
| `npm run typecheck` | `tsc --noEmit`                              |
| `npm run lint`      | ESLint                                      |
| `npm run test`      | Unit/component tests (Vitest)               |
| `npm run test:e2e`  | End-to-end tests (Playwright)               |
| `npm run db:push`   | Apply the Prisma schema to the database     |
| `npm run db:seed`   | Seed the database                           |

## Testing notes

- Unit tests live in `tests/**/*.test.{ts,tsx}` and run in a jsdom environment.
- E2E tests live in `tests/e2e/**` and build + serve the app automatically.
- If Playwright's managed browser is not installed (e.g. in a sandbox where a
  Chromium is provided separately), point it at that binary:

  ```bash
  PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
  ```

## Roadmap

Tracked in [issue #2](https://github.com/panwarvipul4u9058714543-oss/Recyclable-scrap-marketplace/issues/2). Built in steps:

1. **Project scaffolding** ✅ — Next.js + TS + Prisma/SQLite + Vitest/Playwright.
2. **Accounts, roles (multi-role) and phone verification** ✅ — registration with
   mocked OTP verification, multi-role selection, sessions, role-aware dashboard.
3. **Scrap listings** ✅ — households/businesses create, edit, pause and close
   listings with a fixed material category, photos, an estimated quantity range,
   approximate locality, availability and seller type, plus "ordinary recyclable
   scrap only" category warnings.
4. **Nearby discovery** ✅ — collectors, dealers and recyclers browse active
   listings from a chosen search location and filter by material, minimum
   quantity (in a matching unit), maximum distance and availability. The
   dashboard shows role-specific CTAs (sellers see listing management,
   collector-type roles see nearby discovery).

Issue [#3](https://github.com/panwarvipul4u9058714543-oss/Recyclable-scrap-marketplace/issues/3)
extends the marketplace with the buyer–seller connection lifecycle. Built in
steps:

1. **Interest & buyer selection** ✅ — collectors express interest on nearby
   listings; sellers see the list of interested buyers on their own listing
   card and pick one, creating a `Connection` in `RESERVED` state. Both sides
   see the resulting connection at `/connections`.
2. **Reservation lifecycle, chat and mutual contact reveal** ✅ — selection
   reserves the listing for a fixed TTL (3 days); either party can cancel and
   an expired reservation transitions to `EXPIRED` on the next read.
   Cancelled / expired reservations reopen the listing so the seller can pick
   again. Matched parties chat on `/connections/[id]`, and exact phone
   numbers + pickup coordinates become visible only after both parties tap
   *Reveal my contact*.
3. **Outcome recording** ✅ — either party can mark a reservation
   `COMPLETED` or `FAILED` from the connection page. The flow captures the
   optional actual quantity picked up, final price agreed and (for failure)
   a short reason, kept separately from the listing's original estimate.
   A completed or failed connection reopens the listing for a new selection.

Issue [#4](https://github.com/panwarvipul4u9058714543-oss/Recyclable-scrap-marketplace/issues/4)
adds trust, privacy and moderation. Built in steps:

1. **Prohibited & restricted materials** ✅ — the listing service and form
   reject titles/descriptions naming prohibited items (biomedical, chemicals,
   solvents, paints, pesticides, gas cylinders, aerosols, unknown liquids,
   sludge, asbestos, radioactive, explosive, hazardous or stolen material)
   with a targeted error. Restricted categories such as **e-waste and
   batteries** show an additional verification notice on top of the standard
   safety warning.
2. **Profiles — identity, organisation, service area and reputation** ✅ —
   every user has an editable profile at `/profile` with a display name and
   short bio; collector-type roles (collector / dealer / recycler) can add a
   **service area**, **travel radius** and the **materials they accept**;
   business, dealer and recycler roles can add an **organisation name** and
   **registration / licence ID** for role-appropriate verification. Reputation
   is aggregated from completed / failed / cancelled connections and shown on
   the user's own profile and on their **public profile page** at
   `/u/[id]`, which never exposes phone numbers or exact addresses. Connection
   pages link to each counterparty's public profile.
3. **Reports, blocks and ratings** ✅ — signed-in users can **report** a
   listing (from `/nearby`) or another user (from their public profile) with
   a reason and optional details; reports are stored `OPEN` for operator
   review. Users can **block** another user from the public profile; blocks
   are symmetric at the interaction gates — the blocker's listings and the
   blocked user's listings disappear from each other's `/nearby`, and
   interest, buyer selection and chat are refused with a `blocked` error.
   After a **COMPLETED** or **FAILED** connection, either party can submit a
   1–5 **rating** with an optional comment; the counterparty's public
   profile shows the average and count alongside their reputation summary.
4. **Operator moderation and account suspension** ✅ — operators (users
   with the `isAdmin` flag) get a `/moderation` queue that lists every
   `OPEN` report with target context (listing title, reporter phone), and
   can **resolve** or **dismiss** each report with an optional review note.
   From the same queue an operator can **suspend** the reported account
   with a short reason. A suspended user can still browse the marketplace
   but every write path (create/edit a listing, express interest, chat,
   report, block, rate, edit profile) refuses with a `suspended` (403)
   domain error, and their `ACTIVE` listings drop out of `/nearby`
   discovery. Suspended users are redirected from their dashboard to a
   `/suspended` notice that shows the operator's reason; the account can
   be reinstated from the same moderation queue.

Issue [#5](https://github.com/panwarvipul4u9058714543-oss/Recyclable-scrap-marketplace/issues/5)
adds collector route mode — matching listings along a trip the collector is
already making, so travel is not wasted. Built in steps:

1. **Route model and matching service** ✅ — a collector-type user opens a
   `Route` with an origin, destination and travel window plus filters
   (accepted materials, max detour, minimum quantity + unit). At most one
   `ACTIVE` route per collector; starting a new route ends any prior active
   one. `findMatchingListings` ranks candidates by *practical detour*
   (`distance(origin→listing) + distance(listing→dest) − distance(origin→dest)`,
   clamped to zero) and applies the same visibility rules as `/nearby`:
   `ACTIVE` listings only, seller not suspended, no blocks either way, no
   self-listings. Exposed at `GET`/`POST /api/routes`,
   `DELETE /api/routes/[id]`, `GET /api/routes/[id]/matches`.
2. **Route mode UI + connection lifecycle** ✅ — a collector-type user opens
   `/route`, fills in origin, destination, travel window, accepted materials,
   maximum detour and (optionally) a minimum quantity + unit, and submits
   once to see matching listings ranked by detour. Each match has an
   *I&apos;m interested* button that reuses the existing express-interest API
   — a match therefore feeds straight into the existing reservation, chat and
   contact-reveal flow. The page carries a prominent *set your route before
   you drive, review matches after you park* safety notice and is
   deliberately submit-once (no live tracker while driving). Dashboard now
   shows a *Plan a route* CTA for collector, dealer and recycler roles.
Issue [#6](https://github.com/panwarvipul4u9058714543-oss/Recyclable-scrap-marketplace/issues/6)
adds the dealer / recycler bulk marketplace. Built in steps:

1. **Bulk requirement model, search and publish UI** ✅ — dealers,
   businesses and recyclers publish a `BulkRequirement` at `/bulk`
   (material, minimum quantity + unit, region, optional quality notes and
   deadline). Small collectors and dealers browse open requirements on
   `/bulk/browse` with filters for material, region substring, buyer type
   and how much they can supply. Each result carries a **buyer verification
   badge** (organisation name, registration ID, roles, reputation summary)
   so a supplier can gauge risk before contact. `/nearby`-style visibility
   rules apply: ACTIVE only, no suspended buyers, no requirements from
   either side of a block, no own-requirements, expired deadlines hidden.
2. **Supplier response lifecycle** ✅ — a supplier submits a
   `BulkResponse` (offered quantity + unit + optional notes) on a
   requirement's detail page. The buyer sees pending responses and picks
   one, which transitions that response to `SELECTED` and opens the same
   shape of flow used for household connections: in-app chat, mutual
   contact-reveal (masks phones until both parties reveal), and outcome
   recording (COMPLETED / FAILED with optional actual quantity, final
   price, failure reason). Only one response per requirement can be
   `SELECTED` at a time. Either party may cancel a `SELECTED` match; a
   supplier can withdraw a `PENDING` response.
3. **Saved supply searches with match alerts** ✅ — bulk buyers save
   named supply searches (material, minimum supplier quantity + unit,
   region substring) on `/bulk` and receive an alert row per matching new
   listing. `fanOutSavedSearchesForNewListing` runs on the listing-create
   path alongside the route fan-out and is idempotent per
   `(savedSearchId, listingId)`. Each search has an **Alerts on** toggle
   so buyers can pause a search without deleting it. Alerts render on
   `/bulk` with a **NEW badge**, unseen count and *Mark as seen* button.
   Exposed at `GET`/`POST /api/saved-searches`,
   `PATCH`/`DELETE /api/saved-searches/[id]`,
   `GET /api/saved-search-alerts` and
   `POST /api/saved-search-alerts/[id]/seen`.

Issue [#7](https://github.com/panwarvipul4u9058714543-oss/Recyclable-scrap-marketplace/issues/7)
adds marketplace analytics and operational metrics. Built in steps:

1. **AnalyticsEvent schema + recording seams** ✅ — every state-changing
   service call emits one `AnalyticsEvent` row via `recordEvent`
   (`src/lib/analytics/events.ts`), best-effort and never allowed to fail
   the surrounding business write. The event set distinguishes downloads
   (registrations), listings, listing views, leads (interests),
   reservations, mutual reveals, outcomes (completed / failed / cancelled),
   route activity (started + match-notified), bulk activity (requirement +
   response lifecycle) and saved-search alerts. `channel` splits
   `HOUSEHOLD`, `ROUTE` and `BULK` so route mode and the bulk marketplace
   can be measured separately from household discovery. `material`,
   `locality` and `actorRole` are denormalised so cohort queries stay
   index-fast.
2. **KPI aggregation + admin analytics UI** ✅ — `getKpiSummary`,
   `getKpiChannelBreakdown`, `getSupplyDemandDensity` and `getRepeatUsage`
   derive headline metrics from the recorded events: totals for
   registrations / listings / views / leads / reservations /
   completions / failures; rates for completion, pickup-failure and
   no-show; median response time from reservation to outcome; complaints
   (from the `Report` table); repeat completers. `/admin/analytics`
   renders the tiles + tables, admin-gated (a non-admin gets a 404).
   `GET /api/admin/analytics/kpis` serves the same numbers to tooling.
3. **KPI documentation + pilot-target comparison** ✅ — the KPI catalog
   lives in [`docs/analytics-kpis.md`](docs/analytics-kpis.md), naming
   every event and every metric definition. The pilot targets live in
   `src/lib/analytics/pilot-targets.ts` and the admin page surfaces the
   comparison as **met / missed / unknown** for each metric, so the
   platform's initial success review can compare results with the pilot
   targets.

3. **Route match notifications with per-user preferences** ✅ — when a new
   listing is created, `fanOutForNewListing` inserts a `RouteNotification`
   for every collector whose `ACTIVE` route matches that specific listing
   under the same filter rules (materials, minQuantity + unit, maxDetour) and
   visibility rules (blocks either way, no self-listings, opted-out
   collectors excluded). Unique on `(collectorId, listingId)` so repeat
   fan-outs are no-ops. Collectors see a *Recent route matches* section on
   `/route` with a NEW badge, unseen count and *Mark as seen* button, and
   can toggle the `notifyOnRouteMatch` preference from a *Notification
   preferences* section on `/profile`. Exposed at
   `GET /api/route-notifications`,
   `POST /api/route-notifications/[id]/seen` and
   `PATCH /api/preferences/notifications`.

### Buyer–seller connections

- A collector taps *I'm interested* on a nearby listing (`/nearby`) to record
  an `Interest`; withdrawing removes it.
- The seller sees interested buyers on their own listing card at `/listings`
  and taps *Select* to pick one. Selection creates a `Connection` in
  `RESERVED` state with an expiry ~3 days out; a listing may hold at most one
  non-terminal connection at a time.
- Both parties see the connection at `/connections`, split into *Buyers you
  selected* and *Listings that selected you*, and open `/connections/[id]`
  for the chat, contact-reveal, and cancel controls.
- **Mutual contact reveal:** exact phones and pickup coordinates are hidden
  until both parties tap *Reveal my contact*. Until then each side sees only
  the last four digits of the other's phone.
- **Cancel / expire:** either party can cancel a reservation; an unattended
  reservation auto-transitions to `EXPIRED` on the next read. Either
  outcome reopens the listing on `/nearby` and unblocks a new selection.
- **Complete / fail:** either party can mark the reservation `COMPLETED` or
  `FAILED` and optionally record the actual quantity picked up, final price
  agreed and a short failure reason. Values are stored alongside the
  connection, kept separate from the listing's original quantity range.

### Nearby discovery

Collectors, dealers and recyclers browse listings from `/nearby`:

- Set a search location (latitude/longitude, or "Use my location") and pick any
  combination of **material**, **availability**, **minimum quantity + unit** and
  **maximum distance**. Results are the other sellers' `ACTIVE` listings
  sorted by great-circle distance from the search origin.
- Distance is computed with the Haversine formula (`src/lib/discovery/discovery.ts`);
  filtering happens in the application since SQLite has no spatial functions.
- The dashboard tailors its CTAs to each user's roles — sellers see listing
  management, collector-type roles see nearby discovery. A user with both
  seller and collector roles sees both.

### Scrap listings

Sellers (households and businesses) manage listings from `/listings`:

- Each listing has a fixed **material category** drawn from a set of ordinary
  recyclable materials (`src/lib/materials.ts`), **photos** (URLs), an estimated
  **quantity range** with a unit, an approximate **locality**, **availability**
  and the **seller type** the user is listing in.
- The create/edit form always shows the *ordinary recyclable scrap only* notice
  (prohibited/hazardous items) and a category-specific safety warning.
- Listings move through `ACTIVE → PAUSED` (and back) and can be `CLOSED` once;
  closed listings can no longer be edited or reopened.

### Phone verification (mocked)

Verification codes are generated and hashed server-side but delivered via a mock
SMS sender that logs to the console. To exercise the flow without a real SMS
provider, set `RSM_EXPOSE_OTP=1` (dev/test only — see `.env.example`) and the
one-time code is returned in the API response and shown on the register screen.
