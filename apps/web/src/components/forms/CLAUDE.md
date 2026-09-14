# src/components/forms

react-hook-form + zod forms. Each form resolves against the same zod schema
its tRPC procedure validates with (imported from `@contai/domain`, never
redeclared client-side) so client and server validation can't drift.
Import schemas/types from `@contai/domain`, not `@contai/api` — `@contai/api`
re-exports `auth` (a `betterAuth({...})` instance built at module scope),
which transitively pulls in `@contai/db`'s Postgres driver, so any client
component (`'use client'`) importing a runtime value from `@contai/api`
risks bundling server-only code.
