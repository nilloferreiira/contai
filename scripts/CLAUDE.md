# scripts

Standalone Node scripts run via `tsx`. Not part of the Next.js app bundle
and never imported by app code.

- `seed.ts` — the `pnpm db:seed <userId>` command; loads one user's
  financial history into the database.
- `seed-data/` — typed fixture data (e.g. `finance-profile.ts`) consumed
  by the scripts.

Scripts reuse the same `@contai/domain` functions and `@contai/db` schema
the app uses, rather than hand-duplicating logic. Every insert is scoped
to the CLI-supplied `targetUserId` (multi-tenant isolation, same as the
app's API layer) and must respect the same idempotency guards the app
relies on.
