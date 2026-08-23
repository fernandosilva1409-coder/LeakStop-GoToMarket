# LeakStop — Test Plan

Living checklist of functional flows to verify manually. No automated test
suite exists yet — this is the substitute until one does. Update this file
whenever you test a flow or ship a feature that touches one: check the box
and note the version. Leave a flow unchecked if it hasn't actually been
clicked through since the last change that could plausibly affect it — an
unchecked box is honest signal, a stale checked one isn't.

For calculation-engine correctness/performance at scale (`lib/calculations.js`,
`lib/weatherAnalytics.js`), recreate the temporary stress-test pattern instead
of a manual pass: a local-only `pages/api/_dev_stress_test.js` (delete before
committing) generating large synthetic datasets with deliberately messy edge
cases, run against the real functions via `npm run dev` + `curl`. See git log
around v0.14.1 for the exact approach.

## Auth & account
- [ ] Signup (new restaurant, each of the 5 languages)
- [ ] Login / logout
- [ ] Forgot password / reset password

## Menu
- [ ] Add / edit / delete a dish
- [ ] CSV import (valid file, malformed rows, duplicate dish names)
- [ ] Dish with no recipe (excluded from cost calc)

## Purchases
- [ ] Add / edit / delete a purchase
- [ ] CSV import
- [ ] Monthly trend chart (not reverified since the v0.15.0 useAnalysis rewrite)
- [ ] Pagination (20/page)

## Sales
- [x] Add / edit / delete a sale — v0.15.0
- [ ] CSV import
- [x] Monthly trend chart — v0.15.0
- [ ] Pagination

## Overhead
- [ ] Edit values; even vs. prepTime distribution method

## Dashboard
- [x] Overview / Waste / Profitability tabs — v0.15.0
- [x] Date range filter (30/90/365/all) — v0.15.0
- [ ] Waste chart metric (cost/qty) + count (5/10/all) toggle — shipped v0.11.0, not reverified since the v0.15.0 caching rewrite
- [ ] Revenue-by-category pie chart — shipped v0.11.0, not reverified since v0.15.0
- [x] Cache invalidation on sale add/delete (add → number changes immediately, delete → reverts) — v0.15.0

## Recommendations
- [ ] Matrix summary donut + Star/Plowhorse/Puzzle/Dog cards — not reverified since v0.15.0
- [ ] Category pill filter
- [ ] Waste/shortage alerts, small-category and no-recipe sections

## Categories (Settings)
- [ ] Toggle category exclusion; confirm Dashboard/Recommendations reflect it, sales/waste tracking unaffected

## Weather
- [x] Location save + geocoding — v0.13.0
- [x] Weather cache purge on location change (Lisboa → Figueira da Foz) — v0.14.1
- [x] Historical condition/temperature charts + date range filter — v0.12.0
- [x] Dish sensitivity list — v0.10.0
- [x] 7-day forecast + temperature-band fallback for rare conditions — v0.12.0
- [x] AI weekly proposal (cached, correct weekday attribution) — v0.13.0

## Chat with Your Data
- [x] Tool calls + inline chart rendering — v0.15.0 (now backed by the shared analysis cache)
- [x] Pin a chat answer to Analytics — v0.9.0
- [ ] Clear conversation — ⚠️ triggers a native `confirm()` dialog that hangs a browser-automation tab; only test manually, never via automation
- [x] Top 5/10/All filter on wide bar charts — v0.12.0

## Analytics
- [x] Pinned widgets render correctly — v0.15.0 (verified via Chat → Pin flow)
- [ ] Delete a pinned widget

## Settings
- [x] Language / currency save — verified during landing/dashboard i18n passes
- [ ] Version history link

## Subscription (Stripe)
- [ ] Checkout flow
- [ ] Manage subscription (billing portal)

## Landing page
- [x] All 5 languages render; tour section includes Chat and Weather — v0.14.0

## Performance / data integrity
- [x] Stress test: 800k sales / 200k purchases rows, no crash, no anomalies (4 random seeds) — v0.14.1
- [x] Duplicate dish names don't double-count sold units — v0.14.1
- [x] Large restaurant's raw rows never ship to the browser (server-cached analysis) — v0.15.0
