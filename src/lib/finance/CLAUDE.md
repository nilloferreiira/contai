# src/lib/finance

Pure domain logic — no database or ORM import allowed here. Every function is a
plain input→output transformation, unit-tested in `src/tests/`.

- `date.ts` / `money.ts` — primitives used by everything else.
- `invoice.ts` — closing/due-day math for a card cycle.
- `installments.ts` — splits a purchase into N occurrences; anchors each
  to purchase-month + i, NEVER to the due date (see spec section 6).
- `recurrence.ts` — generates recurring occurrences; compares calendar
  dates via `toISODate`, inclusive of the start day.
- `merchants.ts` — normalizes merchant names for dedup matching.
- `parser.ts` — deterministic natural-language expense parser.
- `dashboard.ts` — read-side aggregations over occurrences.
