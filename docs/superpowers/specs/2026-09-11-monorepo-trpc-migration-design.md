# Monorepo + tRPC Migration — Design Spec

**Date:** 2026-09-11
**Status:** Approved, pending implementation plan

## Context

Contai is currently a single-package Next.js app (App Router + Drizzle +
Better Auth). The only implemented backend endpoint is the Better Auth
catch-all (`src/app/api/auth/[...all]/route.ts`); everything else — cards,
categories, merchants, expenses, occurrences, reports — exists only as a
documented REST contract in `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`
§8 and the task breakdown in
`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-hooks.md`
(Section E, not yet built).

We want to convert the repo into a Turborepo/pnpm-workspaces monorepo and
build that not-yet-implemented API layer as **tRPC** instead of REST route
handlers, so that:

1. `apps/web` keeps shipping to Vercel (Hobby plan) unchanged in behavior.
2. Business logic and DB access live in shared packages, not inside route
   handlers.
3. A future Expo/React Native app can import `type AppRouter` for
   end-to-end type safety without pulling in any Node-only runtime code.

Because nothing in Section E is built yet, this is a **pivot before
construction**, not a migration of working code — the domain layer
(`src/lib/finance/`) and DB layer (`src/db/`) are already framework-agnostic
and move with minimal change; the new work is the tRPC layer itself, the
workspace restructuring, and rewiring Better Auth's session check into a
tRPC context.

This design **supersedes** the REST API contract in
`2026-09-09-bolso-mvp-design.md` §8 and the Section E task breakdown. Those
documents are marked superseded (not deleted) as part of this migration —
see "Superseded documents" below.

## Goals

- Real pnpm workspace (`packages:` field), Turborepo pipeline, Vercel-friendly
  build with `apps/web` as Root Directory.
- `packages/domain`, `packages/db`, `packages/api` extracted with clear
  boundaries; `apps/web` consumes them via `workspace:*`.
- `expenses.list` (query, optional date/category filters) and
  `expenses.create` (mutation, zod-validated) implemented as the first tRPC
  procedures, proving the pattern end-to-end.
- `type AppRouter` cleanly exportable for a future RN client with no
  Node-only leakage into type-only consumers.

## Non-goals

- No Expo/React Native app is scaffolded in this pass.
- No other domain routers (cards, categories, merchants, occurrences,
  reports) are built now — `expenses` is the reference implementation the
  rest will follow later.
- No change to Better Auth itself (email/password, JWT plugin) — only where
  the server instance lives and how its session is read.

## Target repo structure

```text
.
├── apps/
│   └── web/                         # Next.js App Router app
│       ├── src/app/api/auth/[...all]/route.ts   # re-exports @contai/api's auth
│       ├── src/app/api/trpc/[trpc]/route.ts     # fetch adapter
│       ├── src/app/(app)/...                    # RSC pages use server caller
│       ├── src/lib/auth-client.ts                # browser Better Auth client (stays web-only)
│       ├── src/lib/trpc/                         # server caller + client Provider setup
│       └── next.config.ts                        # transpilePackages: [@contai/*]
├── packages/
│   ├── domain/            @contai/domain
│   │   └── src/
│   │       ├── date.ts, money.ts, invoice.ts, installments.ts,
│   │       │   recurrence.ts, merchants.ts, parser.ts, dashboard.ts
│   │       ├── schemas/            # zod schemas (moved from src/lib/schemas/)
│   │       └── *.test.ts           # vitest, colocated
│   ├── db/                 @contai/db
│   │   └── src/
│   │       ├── index.ts            # drizzle client (dev-mode singleton caching added)
│   │       └── schema/             # auth.ts, domain.ts, index.ts
│   └── api/                @contai/api
│       └── src/
│           ├── auth.ts             # betterAuth() server instance (moved from apps/web)
│           ├── trpc.ts             # initTRPC, protectedProcedure middleware
│           ├── context.ts          # { session, userId, db } per request
│           ├── routers/
│           │   ├── expenses.ts
│           │   └── _app.ts
│           └── index.ts            # export { appRouter }; export type { AppRouter }
├── package.json                    # root scripts (turbo run ...)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Package responsibilities & boundaries

- **`@contai/domain`** — zero dependencies on DB/tRPC/Next. Pure functions
  plus zod schemas. Importable by `packages/api` (server) and, later, an RN
  app directly (on-device parsing/preview for the quick-add flow needs no
  network round trip).
- **`@contai/db`** — Node-only. `drizzle-orm/postgres-js` client + schema.
  Never imported by anything that might run on-device (RN). Only
  `@contai/api` and `apps/web`'s Better Auth adapter wiring touch it.
- **`@contai/api`** — Node-only runtime, but its **type exports** are the
  only thing a future RN client will ever import (`import type { AppRouter }`
  — type-only imports are erased at compile time, so Metro never resolves
  `postgres` or other Node builtins transitively pulled in by `@contai/db`).
  Owns the Better Auth *server* instance (context needs it), the tRPC router,
  and the `expenses` router as the reference procedure set. Services stay
  thin wrappers: extract input via zod (from `@contai/domain`), call
  `@contai/domain` functions for business rules, call `@contai/db` for
  persistence — never receive `userId` implicitly, always via context.
- **`apps/web`** — Next.js only. Server Components fetch via a server-side
  `appRouter.createCaller(ctx)`. Client Components (quick-add form, edit
  dialogs) use `@trpc/tanstack-react-query` hooks over the existing
  `@tanstack/react-query` v5 client for mutations/optimistic updates. Keeps
  the browser-side Better Auth client (`authClient`), since that's
  React/web-specific.

## Build & tooling strategy

Packages ship raw TypeScript (`"main": "src/index.ts"`, no per-package build
step, no `tsup`). `apps/web/next.config.ts`:

```ts
const nextConfig: NextConfig = {
  transpilePackages: ['@contai/api', '@contai/db', '@contai/domain'],
}
```

This lets Next.js compile workspace packages directly — no build
orchestration needed beyond `next build`, which is what makes `apps/web` as
Vercel Root Directory work with zero extra Vercel config. Vercel detects the
pnpm workspace from the lockfile at the repo root and runs `pnpm install`
there automatically before building `apps/web`.

## Auth & tRPC context wiring

```ts
// packages/api/src/context.ts
export async function createContext({ headers }: { headers: Headers }) {
  const session = await auth.api.getSession({ headers })
  return { session, userId: session?.user.id ?? null, db }
}

// packages/api/src/trpc.ts
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, userId: ctx.userId } }) // userId now non-null
})
```

Every `expenses` procedure is a `protectedProcedure`; every DB query inside
a service filters `eq(table.userId, ctx.userId)` and `isNull(deletedAt)` —
same multi-tenant rule as today, just enforced at the tRPC layer instead of
per-route-handler.

`apps/web/src/app/api/auth/[...all]/route.ts` becomes:

```ts
import { auth } from '@contai/api'
import { toNextJsHandler } from 'better-auth/next-js'

export const { POST, GET } = toNextJsHandler(auth)
```

## Data-fetching pattern (RSC caller + client hooks)

- Server Components (`inicio`, `mes`, `relatorios`) call
  `appRouter.createCaller(await createContext(...))` directly — no HTTP hop,
  no client-side loading state on first paint.
- `apps/web/src/app/api/trpc/[trpc]/route.ts` is the fetch adapter, used
  only by client-side hooks (mutations, refetches, optimistic UI in the
  quick-add flow and edit dialogs).
- Client setup uses `@trpc/tanstack-react-query`'s `createTRPCContext` over
  the app's existing `QueryClient` (from `src/providers/query-provider.tsx`)
  — not the older `@trpc/react-query` `createTRPCReact` API.

## Config files (exact content)

**`pnpm-workspace.yaml`**
```yaml
packages:
  - apps/*
  - packages/*

allowBuilds:
  esbuild: true
  sharp: false
  unrs-resolver: false
```

**`turbo.json`**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

**`tsconfig.base.json`** (root)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false
  }
}
```

**`packages/domain/package.json`**
```json
{
  "name": "@contai/domain",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "date-fns": "^4",
    "zod": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^5"
  }
}
```

**`packages/db/package.json`**
```json
{
  "name": "@contai/db",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.9"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.10",
    "typescript": "^5"
  }
}
```

**`packages/api/package.json`**
```json
{
  "name": "@contai/api",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@contai/db": "workspace:*",
    "@contai/domain": "workspace:*",
    "@trpc/server": "^11",
    "better-auth": "^1.7.3",
    "zod": "^4"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

**`apps/web/package.json`** (relevant excerpt — added/changed deps only)
```json
{
  "dependencies": {
    "@contai/api": "workspace:*",
    "@contai/db": "workspace:*",
    "@contai/domain": "workspace:*",
    "@trpc/client": "^11",
    "@trpc/tanstack-react-query": "^11",
    "@tanstack/react-query": "^5"
  }
}
```

Root `package.json` scripts change to delegate through Turborepo:
```json
{
  "scripts": {
    "dev": "turbo run dev --filter=web",
    "build": "turbo run build --filter=web",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:push": "pnpm --filter @contai/db exec drizzle-kit push --force",
    "db:seed": "tsx scripts/seed.ts"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

## Migration phases

1. **Workspace scaffolding** — add `packages:` to `pnpm-workspace.yaml`,
   create `turbo.json` and `tsconfig.base.json`, move `src/*` →
   `apps/web/src/*`, update root `package.json` scripts. Verify
   `pnpm install` and `pnpm --filter web dev` still work with nothing else
   changed yet.
2. **`packages/db`** — extract `src/db/*` into `packages/db/src/*` verbatim;
   add dev-mode connection caching (`globalThis.__db` pattern) to avoid
   connection-multiplication on hot reload, since the client is now shared
   infrastructure rather than an app-local singleton.
3. **`packages/domain`** — extract `src/lib/finance/*` and
   `src/lib/schemas/*` (plus their vitest tests) into `packages/domain/src/*`.
4. **`packages/api`** — move the Better Auth server instance from
   `src/lib/auth.ts`; add `trpc.ts`, `context.ts`,
   `routers/expenses.ts` (`list`, `create`), `routers/_app.ts`, `index.ts`.
5. **`apps/web` wiring** — fetch-adapter route at
   `app/api/trpc/[trpc]/route.ts`, server caller helper for RSC pages,
   TanStack Query client/provider updates, point the quick-add form at the
   `expenses.create` mutation.
6. **Docs & CLAUDE.md updates** — update root `CLAUDE.md`'s structure
   section (`src/app/api/` description → tRPC), add
   `packages/api/CLAUDE.md` describing tRPC conventions (mirrors what
   `src/app/api/CLAUDE.md` would have been), mark the superseded specs (see
   below).

## Testing strategy

- `packages/domain` keeps its own `vitest.config.ts`, tests colocated with
  source (`*.test.ts`), run via `pnpm --filter @contai/domain test` or
  `turbo run test`.
- `apps/web` keeps any app-level tests (component/integration) under its own
  vitest config.
- No cross-package test runner config needed yet — Turborepo's `test` task
  fans out to each package's own script.

## Vercel deployment

- Root Directory: `apps/web`.
- No custom Install/Build Command needed: Vercel detects the pnpm workspace
  from `pnpm-lock.yaml` at the repo root, runs `pnpm install` there, then
  runs `apps/web`'s own `next build` (via the Next.js framework preset) —
  `transpilePackages` handles compiling the workspace packages inline.
- `DATABASE_URL` and Better Auth env vars stay configured exactly as today,
  just now read inside `packages/db` / `packages/api` instead of `apps/web`.

## Validation (local)

```bash
pnpm install
pnpm --filter web dev            # module resolution sanity, app boots
pnpm turbo run typecheck lint test   # all packages, from root
pnpm --filter web build          # Vercel-equivalent production build
```

## Superseded documents

- `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md` §8 ("API routes —
  contract") — superseded by this spec's tRPC context/router design. The
  file is kept for historical reference; a note should be added at the top
  of §8 pointing here.
- `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-hooks.md`
  — superseded; Section E's actual implementation plan will be rewritten as
  tRPC procedures instead of REST route handlers + hand-rolled
  `api-client.ts`, as a follow-up implementation plan.
- Root `CLAUDE.md` — the `src/app/api/` structure bullet needs to change
  from "REST-ish route handlers, see `src/app/api/CLAUDE.md`" to describe
  the tRPC layout (`packages/api/`), as part of Phase 6 above.

## Explicitly out of scope (follow-ups, not this pass)

- Scaffolding `apps/mobile` (Expo).
- Building the remaining domain routers (cards, categories, merchants,
  occurrences, reports) — `expenses` is the reference implementation only.
- Rewriting Section E's full task breakdown doc — noted as superseded here,
  actual rewrite is a separate implementation plan.
