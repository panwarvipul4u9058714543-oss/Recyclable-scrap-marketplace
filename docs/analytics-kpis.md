# Marketplace analytics — KPI catalog

This document is the source of truth for what each operational KPI means and
which analytics event(s) it reads from. The definitions are shared by the
KPI aggregation service (`src/lib/analytics/kpis.ts`), the admin analytics
page (`/admin/analytics`) and the pilot-target comparison
(`src/lib/analytics/pilot-targets.ts`).

## Event model

Every state-changing seam records one row into the `AnalyticsEvent` table via
`recordEvent()` in `src/lib/analytics/events.ts`. Recording is best-effort:
`recordEvent` swallows its own failures so a failing insert only loses the
row, never the underlying business action.

Each row carries:

| Field         | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `type`        | Event name — one of `ANALYTICS_EVENT_TYPES`.                   |
| `channel`     | `HOUSEHOLD`, `ROUTE`, `BULK` or `GENERAL`.                     |
| `actorId`     | The user who initiated the action, when known.                 |
| `actorRole`   | The actor's role (household, collector, dealer, …) if known.   |
| `subjectType` | The primary domain row the event concerns (LISTING, …).        |
| `subjectId`   | Id of that row.                                                |
| `material`    | Denormalised material category for cohort queries.             |
| `locality`    | Denormalised locality label for density queries.               |
| `metadata`    | JSON blob for anything else (failure reason, outcome numbers). |
| `createdAt`   | Insert time — rows are never updated.                          |

## Event taxonomy

| Event                          | Channel      | Emitted from                              |
| ------------------------------ | ------------ | ----------------------------------------- |
| `USER_REGISTERED`              | `GENERAL`    | `getOrCreateUserByPhone` on first sight   |
| `LISTING_CREATED`              | `HOUSEHOLD`  | `createListing`                           |
| `LISTING_VIEWED`               | `HOUSEHOLD`  | one per listing returned by `discoverNearby` |
| `INTEREST_EXPRESSED`           | `HOUSEHOLD` or `ROUTE` | `expressInterest`; channel is `ROUTE` if the collector already has a route-match notification for that listing |
| `CONNECTION_RESERVED`          | `HOUSEHOLD`  | `selectBuyer`                             |
| `CONNECTION_CANCELLED`         | `HOUSEHOLD`  | `cancelConnection`                        |
| `MUTUAL_REVEAL_COMPLETED`      | `HOUSEHOLD`  | `revealContact` on the second reveal      |
| `CONNECTION_COMPLETED`         | `HOUSEHOLD`  | `markCompleted` (`metadata.responseSeconds` set) |
| `CONNECTION_FAILED`            | `HOUSEHOLD`  | `markFailed` (`metadata.failureReason` set) |
| `ROUTE_STARTED`                | `ROUTE`      | `startRoute`                              |
| `ROUTE_MATCH_NOTIFIED`         | `ROUTE`      | per new row created by `fanOutForNewListing` |
| `BULK_REQUIREMENT_CREATED`     | `BULK`       | `createBulkRequirement`                   |
| `BULK_RESPONSE_CREATED`        | `BULK`       | `respondToBulkRequirement` (first row only — idempotent replays don't emit) |
| `BULK_RESPONSE_SELECTED`       | `BULK`       | `selectBulkResponse`                      |
| `BULK_RESPONSE_CANCELLED`      | `BULK`       | `cancelBulkResponse`                      |
| `BULK_MUTUAL_REVEAL_COMPLETED` | `BULK`       | `revealBulkContact` on the second reveal  |
| `BULK_RESPONSE_COMPLETED`      | `BULK`       | `markBulkCompleted` (`metadata.responseSeconds` set) |
| `BULK_RESPONSE_FAILED`         | `BULK`       | `markBulkFailed` (`metadata.failureReason` set) |
| `SAVED_SEARCH_ALERT_CREATED`   | `BULK`       | per new row created by `fanOutSavedSearchesForNewListing` |
| `PROMOTION_PURCHASED`          | `GENERAL`    | `purchasePromotion` (`metadata.tier`, `metadata.priceCents`, `metadata.listingId`) |
| `PROMOTION_ACTIVATED`          | `GENERAL`    | `purchasePromotion` on the same call — promotion starts immediately |
| `PROMOTION_CANCELLED`          | `GENERAL`    | `cancelPromotion` |
| `PROMOTION_EXPIRED`            | `GENERAL`    | `expirePromotions` — one per row swept past its `endsAt` |
| `PROMOTED_LISTING_VIEWED`      | `HOUSEHOLD`  | `discoverNearby` — additional event when a returned listing is currently promoted |
| `SUBSCRIPTION_STARTED`         | `GENERAL`    | `subscribe` (`metadata.plan`, `metadata.priceCents`) |
| `SUBSCRIPTION_CANCELLED`       | `GENERAL`    | `cancelSubscription` |
| `AD_PLACEMENT_CREATED`         | `GENERAL`    | `createAdPlacement` |
| `AD_PLACEMENT_IMPRESSION`      | `GENERAL`    | `recordAdImpression` — one per placement mount on a surface page |
| `AD_PLACEMENT_CLICK`           | `GENERAL`    | `recordAdClick` — one per user click on the placement's CTA |

## The five distinct hops

Issue #7 requires the analytics to distinguish a **download**, **listing**,
**lead**, **connection** and **completed transaction**. Each maps to a
different event so the funnel is observable end-to-end:

| Concept           | Event(s) counted                             |
| ----------------- | -------------------------------------------- |
| Download          | `USER_REGISTERED` (the platform never sees an install, so the registration is the closest boundary event). |
| Listing           | `LISTING_CREATED`                            |
| Lead              | `INTEREST_EXPRESSED`                         |
| Connection        | `CONNECTION_RESERVED` + `BULK_RESPONSE_SELECTED` |
| Completed transaction | `CONNECTION_COMPLETED` + `BULK_RESPONSE_COMPLETED` |

## KPI definitions

All KPIs live in `src/lib/analytics/kpis.ts`. Rates are `null` when the
denominator is zero so the UI can render `—` rather than misleading `0%`.

### Summary (`getKpiSummary`)

| KPI                     | Definition                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| `totalRegistrations`    | Count of `USER_REGISTERED`.                                               |
| `totalListings`         | Count of `LISTING_CREATED`.                                               |
| `totalListingViews`     | Count of `LISTING_VIEWED`.                                                |
| `totalInterests`        | Count of `INTEREST_EXPRESSED`.                                            |
| `totalReservations`     | Count of `CONNECTION_RESERVED` + `BULK_RESPONSE_SELECTED`.                |
| `totalCompletions`      | Count of `CONNECTION_COMPLETED` + `BULK_RESPONSE_COMPLETED`.              |
| `totalFailures`         | Count of `CONNECTION_FAILED` + `BULK_RESPONSE_FAILED`.                    |
| `completionRate`        | `completions / (completions + failures)`; `null` if denominator is 0.     |
| `pickupFailureRate`     | `failures / (completions + failures)`; `null` if denominator is 0.        |
| `noShowRate`            | Fraction of terminal outcomes whose `metadata.failureReason` matches `/no.?show/i`. |
| `medianResponseSeconds` | Median of `metadata.responseSeconds` across completions + failures.       |
| `complaintsCount`       | Count of `Report` rows (moderation queue) — not read from events.         |
| `repeatCompleters`      | Distinct `actorId` values with ≥ 2 completion events (any channel).       |

### Channel breakdown (`getKpiChannelBreakdown`)

For each `channel` in `HOUSEHOLD | ROUTE | BULK | GENERAL`, returns
`{ listings, interests, reservations, completions, failures, completionRate }`.
Same numerators/denominators as above, scoped to that channel via the row's
`channel` field. This is how the acceptance criterion **“route-mode and
bulk-marketplace activity can be measured separately from household
discovery”** is satisfied.

### Supply / demand density (`getSupplyDemandDensity`)

Returns `byLocality`, `byMaterial` and `byRole` — each is a list of
`{ key, supply, demand }` rows.

- `supply` counts `LISTING_CREATED` grouped by the key.
- `demand` counts `INTEREST_EXPRESSED + BULK_REQUIREMENT_CREATED` grouped
  by the key.
- `key` comes from `locality`, `material` and `actorRole` respectively.
- Rows are sorted by `supply + demand` descending so the busiest cell
  surfaces first.

### Monetisation KPIs (`getMonetisationKpis`)

Aggregates exposure, activation and usage of paid features from issue #8:

- `activePromotions`, `activeSubscriptions`, `activeAdPlacements` — count of
  the currently-in-flight domain rows (source of truth: `Promotion`,
  `PremiumSubscription`, `AdPlacement`).
- `totalPromotionsPurchased/Cancelled/Expired` — lifecycle events in-window.
- `totalSubscriptionsStarted/Cancelled` — subscription lifecycle in-window.
- `adImpressions`, `adClicks`, `adClickThroughRate` — sponsored-panel
  activation on the surfaces that render `AdPanel`.
- `promotionRevenueCentsDeclared`, `subscriptionRevenueCentsDeclared` —
  sum of `metadata.priceCents` on the purchase events; declared only, since
  no real currency is charged in this initial release.

Because everything monetisation-related is gated by `MONETISATION_ENABLED`,
turning the flag off simply stops new events; the KPIs stay readable and
freeze naturally.

### Repeat usage (`getRepeatUsage`)

For each role that has any completions, returns
`{ role, distinctCompleters, onceCount, repeatCount }`:

- `distinctCompleters` — number of unique users with ≥ 1 completion.
- `onceCount` — users with exactly 1 completion.
- `repeatCount` — users with ≥ 2 completions.

## Pilot-target comparison

`src/lib/analytics/pilot-targets.ts` defines the numbers the platform's
initial success review compares against. Every target has a direction
(`at_or_above` or `at_or_below`) and produces one of:

- `met` — the actual meets the target.
- `missed` — the actual is on the wrong side of the target.
- `unknown` — the actual is `null` (typically no outcomes yet).

Update the targets in that file when the pilot's goals change; the admin
analytics page re-renders the comparison on every request.

## Testing

- Unit tests live under `tests/analytics/`:
  `events.test.ts` covers the recording API,
  `wiring.test.ts` covers every service hook,
  `kpis.test.ts` covers the aggregation math,
  `pilot-targets.test.ts` covers the comparison verdicts.
- The `/admin/analytics` surface is exercised end-to-end by
  `tests/e2e/admin-analytics.spec.ts` — seed marketplace activity, then
  sign in as an admin and check the KPI page renders the derived numbers.
