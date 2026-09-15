# packages/domain (`@contai/domain`)

Pure business logic — no database, tRPC, or Next.js dependency. Every
function is a plain input→output transformation. Implementation lives in
`src/`, tests live in `tests/` mirroring `src/`'s structure (e.g.
`src/date.ts` is tested by `tests/date.test.ts`). Importable by
`packages/api` (server) and, later, an RN app directly.

- `date.ts` / `money.ts` — primitives used by everything else. `toISODate`/
  `fromISODate` are a matched pair — the only sanctioned way to move a
  calendar date in or out of a `Date`. Every `Date` in this package is built
  via `new Date(y, m, d)` and read via local getters, which round-trips
  correctly in any host timezone; `new Date(someString)` does NOT, since a
  date-only string parses as UTC per spec. A caller-supplied `YYYY-MM-DD`
  string must go through `fromISODate`, never the bare `Date` constructor —
  this exact mistake in `packages/api`'s `expenses-service.ts` was a real,
  shipped timezone bug (see git history around `fromISODate`'s introduction).
- `invoice.ts` — closing/due-day math for a card cycle.
- `installments.ts` — splits a purchase into N occurrences; anchors each
  to purchase-month + i, NEVER to the due date (see spec section 6).
- `recurrence.ts` — generates recurring occurrences; compares calendar
  dates via `toISODate`, inclusive of the start day.
- `merchants.ts` — normalizes merchant names for dedup matching.
- `parser.ts` — deterministic natural-language expense parser.
- `dashboard.ts` — read-side aggregations over occurrences.
- `schemas/` — zod schemas shared between forms (`apps/web`) and
  API validation (`packages/api`) — `auth-schema.ts` (sign-in/sign-up,
  password requirements), `expense-schema.ts` (`createExpenseInputSchema`,
  used by both the tRPC `expenses` router and the client-side expense form),
  `card-schema.ts` (`cardInputSchema`/`updateCardInputSchema`, used by the
  tRPC `cards` router and the client-side card form), and `category-schema.ts`
  (`categoryInputSchema`/`updateCategoryInputSchema`, used by the tRPC
  `categories` router and the client-side category form; also
  `DEFAULT_CATEGORIES`, the seeded category names re-created by
  `listCategories` on every call — re-exported from
  `categories-service.ts` for server-side importers, but the client-side
  `/ajustes` page imports it from here directly so it can hide the delete
  button for those rows) — each lives here,
  not in `packages/api`, so client components never need to import a runtime
  value from `@contai/api`, which transitively pulls in
  `better-auth`/`@contai/db`.
