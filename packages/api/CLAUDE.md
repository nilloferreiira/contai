# packages/api (`@contai/api`)

Node-only runtime package. Today it only houses the Better Auth *server*
instance (`auth.ts`) — the tRPC router layer described in
`docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md` is
planned but not yet built here; when it lands, its task breakdown is
`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md`.

Once the router exists, only its **type exports** should ever be imported
by a future RN client (`import type { AppRouter }`) — type-only imports
are erased at compile time, so Metro never resolves `@contai/db`'s Node
builtins transitively.

- `auth.ts` — `betterAuth()` server instance (email/password, JWT plugin),
  backed by `@contai/db`.
- `index.ts` — public entry point: re-exports `auth` and its `Session` type.
