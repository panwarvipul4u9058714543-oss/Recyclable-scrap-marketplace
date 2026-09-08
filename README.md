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
4. Nearby discovery with material/quantity/distance/availability filters and role-specific screens.

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
