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
