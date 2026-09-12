# packages/api

Better Auth server instance (`auth.ts`) + the tRPC API layer.

- `trpc.ts` — `initTRPC`, `protectedProcedure` (rejects unauthenticated requests),
  `mapServiceError` (translates a thrown `ServiceError` into the matching `TRPCError`).
- `context.ts` — `{ session, userId, db }` built from the Better Auth session + `@contai/db`.
- `services/<resource>-service.ts` — all DB + business-rule orchestration. Zero
  dependency on `@trpc/*`: plain functions `(db, userId, ...args) => Promise<T>`, zod
  input schemas exported alongside. Throws `ServiceError` for not-found/conflict/
  invalid-scope; never throws `TRPCError`. This is the layer a future dedicated API
  would reuse as-is.
- `routers/<resource>.ts` — thin tRPC wrappers: `.input(schema)` from the matching
  service, one line calling the service function, `.catch(mapServiceError)` where the
  service can throw. No DB queries or business logic here.
- `routers/_app.ts` — merges every resource router into `appRouter`.

A future RN client should only ever import `AppRouter`'s **type** (`import type { AppRouter }`) — type-only imports are erased at compile time and prevent Metro from resolving `@contai/db`'s Node builtins transitively.
