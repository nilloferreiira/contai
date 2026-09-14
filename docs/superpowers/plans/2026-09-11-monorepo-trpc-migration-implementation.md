# Monorepo + tRPC-docs Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Contai from a single-package Next.js app into a Turborepo/pnpm-workspace monorepo (`apps/web`, `packages/domain`, `packages/db`, `packages/api`) by moving already-built code verbatim, and rewrite the Section E ("API + hooks") task-breakdown doc so its *future* tasks build that surface as tRPC procedures instead of REST route handlers.

**Architecture:** Mechanical, phase-by-phase extraction — each task moves one slice of `src/*` into its target package/app with only the import-path edits that slice's move requires, verified by typecheck/build/test before moving on. No new application behavior is introduced by Tasks 1-5: `apps/web` must boot, build, and test identically to today, just relocated. Task 6 is a pure documentation deliverable: it does not touch `packages/api`'s runtime code (no `trpc.ts`/`context.ts`/routers are created in this pass) — it produces the plan a *later* execution will follow to build that layer.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript 5 (strict), Next.js 16 (`transpilePackages`), Drizzle ORM + `postgres.js`, Better Auth (JWT plugin), zod, vitest. tRPC (`@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`) is referenced only inside Task 6's *document content* — no tRPC package is installed anywhere in this plan's actual code changes.

**Spec:** `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`

## Global Constraints

- **This execution does not build the tRPC layer.** `packages/api` gets only the Better Auth server instance moved into it (`auth.ts` + `index.ts`). No `trpc.ts`, `context.ts`, `routers/`, fetch-adapter route, or TanStack Query client wiring is created by Tasks 1-5. That work is *described* (not built) by Task 6's rewritten plan doc, for a future execution to carry out.
- Packages ship raw TypeScript: `"main": "src/index.ts"`, no build step. `apps/web/next.config.ts` uses `transpilePackages` to compile them inline — this is what makes `apps/web` work as the Vercel Root Directory with zero extra Vercel config.
- Package boundaries (from the spec): `@contai/domain` has zero DB/tRPC/Next dependency — pure functions + zod schemas only. `@contai/db` is Node-only (Drizzle + `postgres.js`), never imported by anything that might run on-device later. `@contai/api` is Node-only; only its *type* exports are meant for a future RN client.
- Multi-tenant isolation and soft deletes carry over unchanged: every query filters `eq(table.userId, <the authenticated user's id>)` and `isNull(table.deletedAt)`; a "delete" is always `.update({ deletedAt: new Date() })`, never `.delete()`. `expense_installments` is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day. (Unchanged domain-layer behavior — verified by the tests that move with it.)
- Files: lowercase-with-hyphens. Always named exports, except `page.tsx`/`layout.tsx`/`route.ts`. Each package's `src/index.ts` is its public entry point (this is *not* a "barrel file" in the forbidden sense — it's the package boundary, same as `src/db/schema/index.ts` already is today).
- Only Section E's task doc (`section-e-api-hooks.md`) gets rewritten. Sections A-D, F, G, H are left untouched, including their stale `src/app/api/*` / `@/lib/auth` path references — that's a deliberately separate concern from this migration (confirmed with the user).
- Never delete a superseded doc — add a short banner at the top pointing to its replacement, per the design spec's "Superseded documents" section.

---

## Task 1: Workspace scaffolding — move `src/*` into `apps/web/src/*`

**Files:**
- Create: `pnpm-workspace.yaml` (edit), `turbo.json`, `tsconfig.base.json`, `apps/web/package.json`, `apps/web/tsconfig.json`
- Move (verbatim, `git mv`): `src/` → `apps/web/src/`, `next.config.ts`, `next-env.d.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `vitest.config.ts`, `public/` → all into `apps/web/`
- Move (plain `mv`, untracked): `.env.local` → `apps/web/.env.local`
- Move (`git mv`, tracked): `.env.example` → `apps/web/.env.example`
- Delete: `tsconfig.json` (replaced by `tsconfig.base.json` + `apps/web/tsconfig.json`)
- Edit: `package.json` (root)

**Interfaces:**
- Produces: `apps/web` as a fully self-contained Next.js app with its own `@/*` → `./src/*` alias, buildable via `pnpm --filter web dev`/`build`/`typecheck`. Nothing inside `apps/web/src` is edited in this task — all `@/lib/auth`, `@/db`, `@/lib/finance/*` imports still resolve because everything moved together.

- [ ] **Step 1: Add `packages:` to `pnpm-workspace.yaml`**

Edit `pnpm-workspace.yaml` to:

```yaml
packages:
  - apps/*
  - packages/*

allowBuilds:
  esbuild: true
  sharp: false
  unrs-resolver: false
```

- [ ] **Step 2: Create `turbo.json`**

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

- [ ] **Step 3: Create `tsconfig.base.json`**

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

- [ ] **Step 4: Move the app source tree and its own config files into `apps/web/`**

```bash
mkdir -p apps/web
git mv src apps/web/src
git mv next.config.ts apps/web/next.config.ts
git mv next-env.d.ts apps/web/next-env.d.ts
git mv eslint.config.mjs apps/web/eslint.config.mjs
git mv postcss.config.mjs apps/web/postcss.config.mjs
git mv components.json apps/web/components.json
git mv vitest.config.ts apps/web/vitest.config.ts
git mv public apps/web/public
git mv .env.example apps/web/.env.example
mv .env.local apps/web/.env.local   # untracked, plain mv
git rm tsconfig.json
git rm tsconfig.tsbuildinfo 2>/dev/null || true
```

`drizzle.config.ts` and `src/db`/`src/lib/finance`/`src/lib/schemas`/`src/lib/auth.ts` stay inside `apps/web/src` for now — they get pulled out into their own packages in Tasks 2-4. This task only relocates, it does not restructure.

- [ ] **Step 5: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Create `apps/web/package.json`**

Same dependency set as the current root `package.json`, minus `drizzle-orm`/`postgres`/`drizzle-kit` (those move to `packages/db` in Task 2 — nothing under `apps/web/src` outside `src/db` imports them directly, confirmed by grep). `zod` stays as a direct dependency even though no `apps/web` component imports it directly: `@hookform/resolvers/zod` needs it as a satisfied peer.

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.9.1",
    "@tanstack/react-query": "^5.102.8",
    "@tanstack/react-query-devtools": "^5.102.8",
    "better-auth": "^1.7.3",
    "class-variance-authority": "^0.7.1",
    "cmdk": "^1.1.1",
    "cn": "^0.2.6",
    "date-fns": "^4.4.0",
    "lucide-react": "^1.43.0",
    "next": "16.3.4",
    "radix-ui": "^1.6.7",
    "react": "19.2.8",
    "react-day-picker": "^10.0.1",
    "react-dom": "19.2.8",
    "react-hook-form": "^7.87.0",
    "shadcn": "^4.21.0",
    "sonner": "^2.0.8",
    "tailwind-merge": "^3.6.0",
    "tailwind-variants": "^3.3.1",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@testing-library/react": "^16.3.3",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.1.1",
    "eslint": "^9",
    "eslint-config-next": "16.3.4",
    "eslint-plugin-import": "^2.32.0",
    "jsdom": "^30.0.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^5.0.0"
  }
}
```

Note: `apps/web/src/db`, `src/lib/finance`, `src/lib/schemas` still import `drizzle-orm`/`zod` internally at this point (they haven't moved out yet) — but those packages are still present in the pnpm store from the workspace root's lockfile resolution during this transitional step; `pnpm install` (Step 9) resolves everything fresh against the new manifests, so temporarily missing a transitive dep here is not a real risk as long as Step 9's install succeeds and Step 10's dev-boot succeeds. If it doesn't, add `drizzle-orm` back to `apps/web/package.json` temporarily until Task 2 removes it again — call this out to whoever executes if `pnpm --filter web dev` fails on a missing module.

- [ ] **Step 7: Rewrite root `package.json`**

```json
{
  "name": "contai",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev --filter=web",
    "build": "turbo run build --filter=web",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:push": "pnpm --filter @contai/db exec drizzle-kit push --force",
    "db:seed": "tsx scripts/seed.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "turbo": "^2",
    "tsx": "^4.23.13"
  },
  "packageManager": "pnpm@11.24.0"
}
```

`tsx` is added at root beyond the spec's literal snippet — it's required for `db:seed` (`tsx scripts/seed.ts` runs from the repo root, not from any workspace package, so it needs its own copy). `@contai/db`/`@contai/domain` get added to root `dependencies` in Task 3, once `scripts/seed.ts` is updated to import from them.

`db:push` and `db:seed` are **expected to be broken** after this task (packages/db doesn't exist yet, and `scripts/seed.ts` still imports `@/db`/`@/lib/finance/*` which no longer resolve once the root `tsconfig.json` with the `@/*` alias is gone). That's fine — this task's verification only covers `apps/web` booting; Tasks 2 and 3 fix `scripts/seed.ts` as part of moving `db` and `domain` out.

- [ ] **Step 8: Update `.gitignore` if needed**

Check that `.env*` (with the `!.env.example` exception) still covers `apps/web/.env.local`/`apps/web/.env.example` correctly — `.gitignore` patterns aren't anchored to root by default in the way that would break this, but confirm with `git status` after the move that `apps/web/.env.local` shows as ignored and `apps/web/.env.example` shows as tracked-and-moved, not as a new untracked file.

- [ ] **Step 9: Install**

Run: `pnpm install`
Expected: succeeds, `pnpm-lock.yaml` updates to reflect the new workspace, no unresolved workspace-package errors (there are no `workspace:*` deps yet, so this is really just re-linking `apps/web` as a workspace member).

- [ ] **Step 10: Verify the app boots**

Run: `pnpm --filter web dev` (with `docker compose up -d` running first, so `DATABASE_URL` in `apps/web/.env.local` resolves to a live Postgres)
Expected: Next.js starts cleanly, `/login` renders, no module-resolution errors in the terminal. Stop the dev server once confirmed.

Run: `pnpm --filter web typecheck`
Expected: passes with zero errors (this is the strongest signal that every `@/*` import still resolves post-move).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm workspace + turborepo, move app into apps/web"
```

---

## Task 2: Extract `packages/db`

**Files:**
- Move: `apps/web/src/db/*` → `packages/db/src/*`
- Move: `drizzle.config.ts` (root, still present from before Task 1 moved everything else) — wait, see Step 1 note below.
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`
- Edit: `apps/web/src/lib/auth.ts`, `apps/web/src/tests/auth.test.ts`, `apps/web/next.config.ts`, `apps/web/package.json`, root `package.json`

**Interfaces:**
- Consumes: nothing new (pure relocation of the existing Drizzle setup).
- Produces: `db` (Drizzle client, dev-mode-cached on `globalThis`) and every schema table/relation (`user`, `session`, `account`, `verification`, `jwks`, `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installmentPlans`, `expenseInstallments`, plus their `*Relations`) — all exported flat from `@contai/db`'s single entry point (`packages/db/src/index.ts`). No `@contai/db/schema` subpath — `package.json` only declares `"main": "src/index.ts"`, so everything a consumer needs comes from importing `@contai/db` directly.

- [ ] **Step 1: Move the db source tree and drizzle config**

`drizzle.config.ts` was left at the repo root by Task 1 (it wasn't in that task's move list) and still points at `./src/db/...`, which no longer exists there — it's already dangling. Move it now, into its final home, with corrected paths in the same step:

```bash
mkdir -p packages/db/src
git mv apps/web/src/db/schema packages/db/src/schema
git mv apps/web/src/db/migrations packages/db/src/migrations
git rm apps/web/src/db/index.ts   # rewritten below, not moved verbatim
git mv drizzle.config.ts packages/db/drizzle.config.ts
```

- [ ] **Step 2: Write `packages/db/src/index.ts`** (adds dev-mode connection caching, per the design spec's phase 2)

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
    var __contaiDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

const connectionString = process.env.DATABASE_URL!

export const db =
    globalThis.__contaiDb ??
    drizzle(postgres(connectionString), { schema })

if (process.env.NODE_ENV !== 'production') {
    globalThis.__contaiDb = db
}

export * from './schema'
```

- [ ] **Step 3: Rewrite `packages/db/drizzle.config.ts`**

Paths are now relative to `packages/db/`, and the manual env fallback needs to reach `apps/web/.env.local` (the only `.env.local` in the repo after Task 1) since `pnpm --filter @contai/db exec drizzle-kit ...` runs with cwd set to `packages/db/`:

```ts
import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
    try {
        process.loadEnvFile('../../apps/web/.env.local')
    } catch {
        // ignore if file does not exist
    }
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/schema/index.ts',
    out: './src/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: false,
})
```

- [ ] **Step 4: Write `packages/db/package.json`**

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

- [ ] **Step 5: Write `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Move `packages/db/CLAUDE.md`** (adapted from the current `src/db/CLAUDE.md`)

```bash
git mv apps/web/src/db/CLAUDE.md packages/db/CLAUDE.md
```

Then edit its content to:

```markdown
# packages/db (`@contai/db`)

Drizzle ORM setup backed by PostgreSQL via `postgres.js`:
- `index.ts` — exports the singleton `db` instance (cached on `globalThis`
  in development to avoid connection-multiplication on hot reload) and
  re-exports every table/relation from `schema/`.
- `schema/` — schema definitions (auth tables + domain tables).
- `migrations/` — SQL migrations generated by `drizzle-kit` for review and history.

All database queries must go through Drizzle ORM using `db.select()`, `db.insert()`,
`db.update()`. Never run untracked raw SQL. Every user-owned entity must be
filtered by `userId` and `isNull(deletedAt)`.

**Deploy path:** From the repo root, `pnpm db:push` runs
`pnpm --filter @contai/db exec drizzle-kit push --force` to apply schema
changes to the database. Migration files are generated for review and
version control, but `drizzle-kit migrate` is not used in this project.
```

- [ ] **Step 7: Update `apps/web/src/lib/auth.ts`** to import from `@contai/db` instead of `@/db`

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt } from 'better-auth/plugins'
import { db, user, session, account, verification, jwks } from '@contai/db'

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: { user, session, account, verification, jwks },
    }),
    emailAndPassword: {
        enabled: true,
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes cache
            strategy: 'jwt',
        },
    },
    plugins: [
        jwt({
            sessionCookieCache: true,
        }),
    ],
})

export type Session = typeof auth.$Infer.Session
```

- [ ] **Step 8: Update `apps/web/src/tests/auth.test.ts`'s db import**

Change only the dynamic import at the bottom (the schema/authClient tests stay as-is until Task 3 splits this file):

```ts
    it('connects to database and queries user table', async () => {
        const { db, user } = await import('@contai/db')
        const users = await db.select().from(user)
        expect(Array.isArray(users)).toBe(true)
    })
```

(Replaces the previous two-line `await import('@/db')` / `await import('@/db/schema')` pair with one import from `@contai/db`.)

- [ ] **Step 9: Add `@contai/db` to `apps/web`**

Edit `apps/web/package.json` dependencies to add `"@contai/db": "workspace:*"`.

Edit `apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contai/db"],
};

export default nextConfig;
```

- [ ] **Step 10: Fix root `package.json`'s `db:push` script**

It was already written correctly in Task 1 Step 7 (`pnpm --filter @contai/db exec drizzle-kit push --force`) — no change needed here, just confirm it now has a target.

- [ ] **Step 11: Install and verify**

Run: `pnpm install`
Expected: `@contai/db` symlinked into `apps/web/node_modules` and root `node_modules`.

Run: `pnpm --filter @contai/db typecheck`
Expected: passes.

Run: `pnpm --filter web typecheck`
Expected: passes — confirms `@contai/db`'s exports satisfy `auth.ts`'s usage.

Run (with `docker compose up -d` running): `pnpm db:push`
Expected: `drizzle-kit push --force` reports the schema is already in sync (or applies with no unexpected changes) — confirms the relocated `drizzle.config.ts` resolves `DATABASE_URL` and the schema path correctly.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: extract packages/db from apps/web"
```

---

## Task 3: Extract `packages/domain`

**Files:**
- Move: `apps/web/src/lib/finance/*` (incl. `CLAUDE.md`) → `packages/domain/src/*`
- Move: `apps/web/src/lib/schemas/auth-schema.ts` → `packages/domain/src/schemas/auth-schema.ts`
- Move: `apps/web/src/tests/{date,money,invoice,installments,recurrence,merchants,parser,dashboard}.test.ts` → `packages/domain/src/*.test.ts` (colocated, relative imports)
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/vitest.config.ts`, `packages/domain/src/index.ts`, `packages/domain/src/schemas/auth-schema.test.ts`
- Edit: `apps/web/src/tests/auth.test.ts` (split), `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/(auth)/cadastro/page.tsx`, `apps/web/src/components/app/password-checklist.tsx`, `scripts/seed.ts`, `scripts/CLAUDE.md`, `apps/web/next.config.ts`, `apps/web/package.json`, root `package.json`
- Delete: `apps/web/src/lib/schemas/CLAUDE.md` content moves too (see Step 4)

**Interfaces:**
- Consumes: nothing new.
- Produces: `@contai/domain` exporting every function/type from `date.ts`, `money.ts`, `invoice.ts`, `installments.ts`, `recurrence.ts`, `merchants.ts`, `parser.ts`, `dashboard.ts`, and `schemas/auth-schema.ts` (`signInSchema`, `signUpSchema`, `passwordRequirements`, `SignInInput`, `SignUpInput`) — all flat off the single barrel `packages/domain/src/index.ts`. No name collisions exist across these files (verified).

- [ ] **Step 1: Move the domain source files**

```bash
mkdir -p packages/domain/src/schemas
git mv apps/web/src/lib/finance/date.ts packages/domain/src/date.ts
git mv apps/web/src/lib/finance/money.ts packages/domain/src/money.ts
git mv apps/web/src/lib/finance/invoice.ts packages/domain/src/invoice.ts
git mv apps/web/src/lib/finance/installments.ts packages/domain/src/installments.ts
git mv apps/web/src/lib/finance/recurrence.ts packages/domain/src/recurrence.ts
git mv apps/web/src/lib/finance/merchants.ts packages/domain/src/merchants.ts
git mv apps/web/src/lib/finance/parser.ts packages/domain/src/parser.ts
git mv apps/web/src/lib/finance/dashboard.ts packages/domain/src/dashboard.ts
git mv apps/web/src/lib/schemas/auth-schema.ts packages/domain/src/schemas/auth-schema.ts
git rm apps/web/src/lib/finance/CLAUDE.md   # rewritten in Step 6, not moved verbatim
git rm apps/web/src/lib/schemas/CLAUDE.md   # folded into packages/domain/CLAUDE.md in Step 6
rmdir apps/web/src/lib/finance apps/web/src/lib/schemas 2>/dev/null || true
```

None of these files import from each other via `@/*` (they use relative imports like `./date`, `./invoice`) — confirmed by grep, so **no import edits are needed inside the moved files themselves**.

- [ ] **Step 2: Move the domain test files, colocated**

```bash
git mv apps/web/src/tests/date.test.ts packages/domain/src/date.test.ts
git mv apps/web/src/tests/money.test.ts packages/domain/src/money.test.ts
git mv apps/web/src/tests/invoice.test.ts packages/domain/src/invoice.test.ts
git mv apps/web/src/tests/installments.test.ts packages/domain/src/installments.test.ts
git mv apps/web/src/tests/recurrence.test.ts packages/domain/src/recurrence.test.ts
git mv apps/web/src/tests/merchants.test.ts packages/domain/src/merchants.test.ts
git mv apps/web/src/tests/parser.test.ts packages/domain/src/parser.test.ts
git mv apps/web/src/tests/dashboard.test.ts packages/domain/src/dashboard.test.ts
```

Then edit every one of these 8 files, replacing their `@/lib/finance/<name>` import with a relative `./<name>` import. The transformation is identical in shape for each file — e.g. `packages/domain/src/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toISODate, monthKey, clampDay } from './date'
```

Apply the same `@/lib/finance/X` → `./X` substitution to the remaining 7 files (`money.test.ts` → `./money`; `invoice.test.ts` → `./invoice` and `./date`; `installments.test.ts` → `./installments` and `type CardCycle` from `./invoice`; `recurrence.test.ts` → `./recurrence`; `merchants.test.ts` → `./merchants`; `parser.test.ts` → `./parser` (two import lines, lines 2 and 75); `dashboard.test.ts` → `./dashboard`). Every other line in these files is untouched.

- [ ] **Step 3: Split `apps/web/src/tests/auth.test.ts`**

Create `packages/domain/src/schemas/auth-schema.test.ts` with the schema-only assertions:

```ts
import { describe, expect, it } from 'vitest'
import { passwordRequirements, signInSchema, signUpSchema } from './auth-schema'

describe('Auth schemas', () => {
    it('validates password requirements correctly', () => {
        const weak = 'weak'
        expect(passwordRequirements.every((r) => r.test(weak))).toBe(false)

        const strong = 'Strong1@Password'
        expect(passwordRequirements.every((r) => r.test(strong))).toBe(true)
    })

    it('validates signUpSchema requiring name, email, and strong password', () => {
        const valid = signUpSchema.safeParse({
            name: 'Dan Test',
            email: 'dan@example.com',
            password: 'Strong1@Password',
        })
        expect(valid.success).toBe(true)

        const invalidName = signUpSchema.safeParse({
            name: 'D',
            email: 'dan@example.com',
            password: 'Strong1@Password',
        })
        expect(invalidName.success).toBe(false)

        const invalidPassword = signUpSchema.safeParse({
            name: 'Dan Test',
            email: 'dan@example.com',
            password: 'simplepassword',
        })
        expect(invalidPassword.success).toBe(false)
    })

    it('validates signInSchema', () => {
        const valid = signInSchema.safeParse({
            email: 'dan@example.com',
            password: 'secret',
        })
        expect(valid.success).toBe(true)

        const invalidEmail = signInSchema.safeParse({
            email: 'invalid-email',
            password: 'secret',
        })
        expect(invalidEmail.success).toBe(false)
    })
})
```

Rewrite `apps/web/src/tests/auth.test.ts` to keep only what's actually web-specific (the `authClient` test, unchanged, and the db-connectivity test already fixed to `@contai/db` in Task 2 Step 8):

```ts
import { describe, expect, it } from 'vitest'
import { authClient } from '@/lib/auth-client'

describe('Auth client', () => {
    it('exports authClient properly', () => {
        expect(authClient).toBeDefined()
        expect(authClient.signIn).toBeDefined()
        expect(authClient.signUp).toBeDefined()
    })

    it('connects to database and queries user table', async () => {
        const { db, user } = await import('@contai/db')
        const users = await db.select().from(user)
        expect(Array.isArray(users)).toBe(true)
    })
})
```

- [ ] **Step 4: Write `packages/domain/src/index.ts`**

```ts
export * from './date'
export * from './money'
export * from './invoice'
export * from './installments'
export * from './recurrence'
export * from './merchants'
export * from './parser'
export * from './dashboard'
export * from './schemas/auth-schema'
```

- [ ] **Step 5: Write `packages/domain/package.json`, `tsconfig.json`, `vitest.config.ts`**

`packages/domain/package.json`:

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

`packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

`packages/domain/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
    },
})
```

- [ ] **Step 6: Write `packages/domain/CLAUDE.md`**

```markdown
# packages/domain (`@contai/domain`)

Pure business logic — no database, tRPC, or Next.js dependency. Every
function is a plain input→output transformation, unit-tested colocated
as `*.test.ts`. Importable by `packages/api` (server) and, later, an RN
app directly.

- `date.ts` / `money.ts` — primitives used by everything else.
- `invoice.ts` — closing/due-day math for a card cycle.
- `installments.ts` — splits a purchase into N occurrences; anchors each
  to purchase-month + i, NEVER to the due date (see spec section 6).
- `recurrence.ts` — generates recurring occurrences; compares calendar
  dates via `toISODate`, inclusive of the start day.
- `merchants.ts` — normalizes merchant names for dedup matching.
- `parser.ts` — deterministic natural-language expense parser.
- `dashboard.ts` — read-side aggregations over occurrences.
- `schemas/` — zod schemas shared between forms (`apps/web`) and future
  API validation (`packages/api`) — `auth-schema.ts` (sign-in/sign-up,
  password requirements).
```

- [ ] **Step 7: Update `apps/web` consumers of `@/lib/schemas/auth-schema`**

`apps/web/src/app/(auth)/login/page.tsx`:

```ts
import { signInSchema, type SignInInput } from '@contai/domain'
```

`apps/web/src/app/(auth)/cadastro/page.tsx`:

```ts
import { signUpSchema, type SignUpInput } from '@contai/domain'
```

`apps/web/src/components/app/password-checklist.tsx`:

```ts
import { passwordRequirements } from '@contai/domain'
```

(Each file's other imports are untouched — only this one line changes per file.)

- [ ] **Step 8: Update `scripts/seed.ts`**

Replace the two `@/db` / `@/db/schema` / `@/lib/finance/*` import lines:

```ts
import { eq } from 'drizzle-orm'
import { db, cards, categories, expenseInstallments, expenses, installmentPlans, merchants, recurrences, user } from '@contai/db'
import { toISODate, generateInstallments, getInvoiceForExpense, generateRecurrenceOccurrences, type CardCycle } from '@contai/domain'
import { seedCards, seedCategories, seedExpenses, seedMerchants, seedRecurrences } from './seed-data/finance-profile'
```

Everything below the import block in `scripts/seed.ts` is unchanged (it only ever referenced these named imports, never a namespace import).

- [ ] **Step 9: Update `scripts/CLAUDE.md`**

Change the paragraph "Scripts reuse the same `src/lib/finance/` domain functions and `src/db/schema` the app uses" to:

```markdown
Scripts reuse the same `@contai/domain` functions and `@contai/db` schema
the app uses, rather than hand-duplicating logic. Every insert is scoped
to the CLI-supplied `targetUserId` (multi-tenant isolation, same as the
app's API layer) and must respect the same idempotency guards the app
relies on.
```

- [ ] **Step 10: Add `@contai/domain` to `apps/web` and root**

Edit `apps/web/package.json` dependencies: add `"@contai/domain": "workspace:*"`.

Edit `apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contai/db", "@contai/domain"],
};

export default nextConfig;
```

Edit root `package.json` dependencies (currently `{}`):

```json
  "dependencies": {
    "@contai/db": "workspace:*",
    "@contai/domain": "workspace:*"
  },
```

(Root needs both now — `scripts/seed.ts` runs from the repo root and imports both packages by name.)

- [ ] **Step 11: Install and verify**

Run: `pnpm install`

Run: `pnpm --filter @contai/domain test`
Expected: all 8 moved test files pass unchanged (same assertions, same behavior — only import paths changed).

Run: `pnpm --filter web test`
Expected: `sanity.test.ts` and the trimmed `auth.test.ts` pass (needs `docker compose up -d` for the db-connectivity assertion).

Run: `pnpm --filter web typecheck`
Expected: passes.

Run (with Postgres up and a valid user id in the DB — see `scripts/CLAUDE.md`): `pnpm db:seed <userId>`
Expected: no module-resolution errors; either seeds successfully or fails on its own idempotency guard (`já possui dados financeiros`) if already run before — either outcome confirms the import rewrite works, a crash on `Cannot find module '@contai/db'` would not.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: extract packages/domain from apps/web"
```

---

## Task 4: Extract `packages/api` (Better Auth server instance only)

**Files:**
- Move: `apps/web/src/lib/auth.ts` → `packages/api/src/auth.ts`
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`, `packages/api/src/index.ts`, `packages/api/CLAUDE.md`
- Edit: `apps/web/src/app/page.tsx`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/next.config.ts`, `apps/web/package.json`

**Interfaces:**
- Consumes: `db`, `user`, `session`, `account`, `verification`, `jwks` from `@contai/db` (Task 2).
- Produces: `auth` (the Better Auth server instance) and `type Session` from `@contai/api`'s single entry point. **No `@contai/domain` dependency yet** — `auth.ts` doesn't need it, and no tRPC packages are added — those land when the rewritten Section E plan (Task 6's output) is actually executed later.

- [ ] **Step 1: Move `auth.ts`**

```bash
mkdir -p packages/api/src
git mv apps/web/src/lib/auth.ts packages/api/src/auth.ts
```

No content changes needed — `auth.ts` already imports from `@contai/db` (fixed in Task 2 Step 7), and it has no other `@/*` imports.

- [ ] **Step 2: Write `packages/api/src/index.ts`**

```ts
export { auth } from './auth'
export type { Session } from './auth'
```

- [ ] **Step 3: Write `packages/api/package.json`**

Deliberately minimal — only what `auth.ts` actually imports today. `@contai/domain`, `@trpc/server`, and `zod` get added when the tRPC router layer is actually built (Task 6's rewritten Section E plan, Task 1 of that plan).

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
    "better-auth": "^1.7.3"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Write `packages/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Write `packages/api/CLAUDE.md`**

```markdown
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
```

- [ ] **Step 6: Update the three `apps/web` consumers of `@/lib/auth`**

`apps/web/src/app/page.tsx`:

```ts
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@contai/api";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session?.user ? "/inicio" : "/login");
}
```

`apps/web/src/app/(app)/layout.tsx`:

```ts
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@contai/api'
import { BottomNav } from '@/components/app/bottom-nav'

export default async function AppLayout({ children }: { children: ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session?.user) {
        redirect('/login')
    }

    return (
        <div data-slot="app-shell" className="min-h-screen bg-background pb-28">
            <div className="mx-auto w-full max-w-lg px-4 pt-6">{children}</div>
            <BottomNav />
        </div>
    )
}
```

`apps/web/src/app/api/auth/[...all]/route.ts`:

```ts
import { auth } from '@contai/api'
import { toNextJsHandler } from 'better-auth/next-js'

export const { POST, GET } = toNextJsHandler(auth)
```

- [ ] **Step 7: Add `@contai/api` to `apps/web`**

Edit `apps/web/package.json` dependencies: add `"@contai/api": "workspace:*"`.

Edit `apps/web/next.config.ts` (final form):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contai/api", "@contai/db", "@contai/domain"],
};

export default nextConfig;
```

- [ ] **Step 8: Install and verify**

Run: `pnpm install`

Run: `pnpm --filter @contai/api typecheck`
Expected: passes.

Run: `pnpm --filter web typecheck`
Expected: passes.

Run: `pnpm --filter web build` (with `docker compose up -d`, `apps/web/.env.local` populated)
Expected: production build succeeds — this is the strongest end-to-end signal that `transpilePackages` correctly compiles all three workspace packages inline.

Run: `pnpm --filter web dev`, then manually visit `/login` and `/cadastro`, sign up a test user, confirm redirect to `/inicio` (which will 404/error since no page exists there yet — that's expected and out of scope; just confirm the auth redirect itself fires, proving `@contai/api`'s `auth` instance works end-to-end through the moved route handler and layout guard).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: extract packages/api (Better Auth server instance)"
```

---

## Task 5: Root docs, superseded-doc banners, and full validation

**Files:**
- Edit: `CLAUDE.md` (root), `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`

**Interfaces:**
- Consumes: nothing — this is a documentation-only task confirming the migration's final shape.
- Produces: an accurate root `CLAUDE.md` for the new monorepo layout, plus the spec-supersession banner the design doc calls for.

- [ ] **Step 1: Rewrite root `CLAUDE.md`**

```markdown
# Contai

Mobile-first personal finance manager. Core feature: register an expense
in under 15 seconds via a deterministic (regex, no AI) natural-language
parser. Turborepo/pnpm monorepo: Next.js App Router (`apps/web`) backed by
shared `packages/domain`, `packages/db`, `packages/api` (Better Auth server
instance today; a tRPC layer is planned — see
`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md`).
PostgreSQL (Drizzle ORM) + Better Auth (with JWT plugin, email/password
only — no Google OAuth in MVP).

## Structure

- `apps/web/` — Next.js App Router app (Vercel Root Directory)
  - `src/app/(auth)/` — login/cadastro pages
  - `src/app/(app)/` — authenticated pages (inicio, mes, relatorios, ajustes) behind a session guard
  - `src/app/api/auth/[...all]/` — re-exports `@contai/api`'s Better Auth instance via `toNextJsHandler`
  - `src/components/ui/` — shadcn components
  - `src/components/app/` — app-specific components (quick-add, occurrence list, card-visual, ...)
  - `src/components/forms/` — react-hook-form + zod forms
  - `src/hooks/` — React Query hooks
  - `src/lib/auth-client.ts` — Better Auth *browser* client instance (web-only)
  - `src/providers/` — root-level client providers (`QueryProvider`)
  - `src/tests/` — vitest tests for web-only concerns (auth client, db connectivity smoke test)
- `packages/domain/` (`@contai/domain`) — pure business logic + zod schemas, zero DB/Next dependency, see `packages/domain/CLAUDE.md`
- `packages/db/` (`@contai/db`) — Drizzle ORM client + schema, see `packages/db/CLAUDE.md`
- `packages/api/` (`@contai/api`) — Better Auth server instance today; tRPC router layer planned, not yet built — see `packages/api/CLAUDE.md`
- `scripts/` — standalone dev scripts (e.g. `db:seed`) run from the repo root, see `scripts/CLAUDE.md`
- `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.base.json` — workspace config

## Conventions

- Files: lowercase-with-hyphens. Always named exports (except `page.tsx`/`layout.tsx`/`route.ts`). Each package's `src/index.ts` is its public entry point — not a forbidden "barrel file".
- Components: `twMerge('base', className)`, `data-slot="name"`, state via `data-*` attributes, icons sized explicitly, icon-only buttons have `aria-label`.
- No hardcoded colors — only tokens from `apps/web/src/app/globals.css` (`bg-surface`, `text-foreground`, etc).
- Multi-tenant isolation: every query explicitly filters `userId` matching the authenticated user's id and `isNull(deletedAt)`.
- All occurrence data (UI + reports) reads `expense_installments`, never `expenses` directly.
- Full design spec: `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`.
- Monorepo/tRPC migration design: `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.
- Visual/style system (colors, radius, fonts, mobile shell) is sourced from the
  `swift-spend` MVP for parity: OKLCH forest-green/lime palette, Figtree
  (sans) + Fraunces (display), `1rem` base radius, `max-w-lg` centered mobile
  shell with a floating-FAB bottom nav.
```

- [ ] **Step 2: Add a superseded banner to `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md` §8**

Immediately after the `## 8. API routes — contract` heading (line 502), insert:

```markdown

> **Superseded:** this REST contract is replaced by the tRPC design in
> `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.
> Kept below for historical reference only — the actual task breakdown is
> `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md`.
```

- [ ] **Step 3: Full validation run**

```bash
docker compose up -d
pnpm install
pnpm turbo run typecheck lint test
pnpm --filter web build
```

Expected: every package/app's `typecheck`/`lint`/`test` task passes (Turborepo skips `lint`/`test` for packages that don't define those scripts — `packages/db`/`packages/api` only have `typecheck`, `packages/domain` has `test`+`typecheck`, `apps/web` has all three), and the production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update CLAUDE.md and mark REST API contract as superseded"
```

---

## Task 6: Rewrite Section E's task-breakdown doc as tRPC procedures

**Files:**
- Edit: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-hooks.md` (superseded banner only)
- Edit: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md` (Progress Checklist row for Section E)
- Create: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md`

**Interfaces:**
- Consumes: nothing — this is a planning-document deliverable, not code. It does not modify `packages/api`, `apps/web`, or install any new dependency.
- Produces: a complete, executable task breakdown that a *future* execution can follow (via `superpowers:subagent-driven-development` or `superpowers:executing-plans`) to build the tRPC layer this migration deliberately left out. Its tasks build `packages/api/src/trpc.ts`, `context.ts`, `routers/*.ts`, `routers/_app.ts`, the `apps/web` fetch-adapter route, RSC server-caller helper, and TanStack Query client wiring — folding in the original design spec's phases 4-5, which this execution did not carry out. Every hook it defines (`useCards`, `useCreateCard`, `useUpdateCard`, `useDeleteCard`, `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, `useMerchants`, `useCreateExpense`, `useOccurrences`, `useUpdateOccurrence`, `useDeleteOccurrence`, `useSummary`) keeps the **exact same name and call signature** the old REST-based Section E doc defined, so Section F/G's task docs (which reference these hooks by name) need no changes — confirmed with the user.

- [ ] **Step 1: Add a superseded banner to the top of `section-e-api-hooks.md`**

Insert immediately after its title line:

```markdown

> **Superseded:** rewritten as tRPC procedures in
> [`section-e-api-trpc.md`](./section-e-api-trpc.md), per
> `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.
> Kept below for historical reference — the REST routes described here were
> never built.
```

- [ ] **Step 2: Update the master plan's Progress Checklist row for Section E**

In `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`, replace the Section E bullet:

```markdown
- [ ] **Section E: API + hooks** (Tasks 18-24) — `2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md`
  `packages/api` tRPC infra (`trpc.ts`/`context.ts`/fetch adapter/RSC caller/client Provider), `cards`/`categories`/`merchants`/`expenses`/`occurrences`/`reports` routers as `protectedProcedure`s, plus matching React Query hooks via `@trpc/tanstack-react-query`, backed by Drizzle ORM. Supersedes the REST version at `section-e-api-hooks.md`.
```

- [ ] **Step 3: Write `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md`**

```markdown
# Bolso MVP Implementation Plan — Section E: API + hooks (tRPC)

> Part of the full plan. Master checklist and progress tracking: `../2026-09-09-bolso-mvp-implementation.md`. Shared context below is duplicated from that file so this section can be worked on standalone. Supersedes `section-e-api-hooks.md` (REST version, never built) per `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.

**Goal:** Build the Bolso MVP's API layer as tRPC procedures — `packages/api`'s router is the single source of truth for cards/categories/merchants/expenses/occurrences/reports, consumed by Server Components via a server-side caller and by Client Components via `@trpc/tanstack-react-query` hooks over the existing `@tanstack/react-query` v5 client.

**Architecture:** `packages/api` owns `trpc.ts` (`initTRPC` + `protectedProcedure` middleware that rejects unauthenticated requests), `context.ts` (`{ session, userId, db }` built from Better Auth's session + `@contai/db`), and one router file per resource, merged into `appRouter` (`routers/_app.ts`). `apps/web` exposes a single fetch-adapter route (`app/api/trpc/[trpc]/route.ts`) for client-side calls, and a server-caller helper (`lib/trpc/server.ts`) for RSC pages to call procedures directly with no HTTP round trip. Every procedure is `protectedProcedure` — `ctx.userId` is guaranteed non-null inside it — and every DB query filters `eq(table.userId, ctx.userId)` and `isNull(table.deletedAt)`, same multi-tenant rule as always.

**Tech Stack:** `@trpc/server` v11, `@trpc/client` v11, `@trpc/tanstack-react-query` v11, `@tanstack/react-query` v5, zod, Drizzle ORM (via `@contai/db`), `@contai/domain` for business logic (installments/recurrence/invoice/merchant-normalization/dashboard math).

**Spec:** `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`

## Global Constraints

- Every procedure is `protectedProcedure` (auth enforced in `trpc.ts`'s middleware, not per-procedure) — never trust a client-supplied `userId`, always use `ctx.userId`.
- Multi-tenant isolation and soft-deletes: every query against user-owned tables (`cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installmentPlans`, `expenseInstallments`) filters `eq(table.userId, ctx.userId)` and `isNull(table.deletedAt)`. A delete is always an `.update({ deletedAt: new Date() })`, never `.delete()`.
- `expenseInstallments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Client hooks keep the exact names/signatures the old REST-based plan used (`useCards()`, `useCreateExpense()`, etc.) — Section F/G's components already reference these names and must not need changes.
- Files: lowercase-with-hyphens. Named exports only, except `route.ts` handlers.
- End of every task below: if it's the first task to create a structurally complex folder, add/update a short `CLAUDE.md` in that folder. Refresh root `CLAUDE.md` if the task changes the top-level structure.

---

## Task 18: tRPC infrastructure — `trpc.ts`, `context.ts`, fetch adapter, RSC caller, client Provider

**Files:**
- Create: `packages/api/src/trpc.ts`, `packages/api/src/context.ts`, `packages/api/src/routers/_app.ts`
- Edit: `packages/api/src/index.ts`, `packages/api/package.json`
- Create: `apps/web/src/app/api/trpc/[trpc]/route.ts`, `apps/web/src/lib/trpc/client.ts`, `apps/web/src/lib/trpc/server.ts`, `apps/web/src/lib/trpc/provider.tsx`
- Edit: `apps/web/src/providers/query-provider.tsx`, `apps/web/package.json`

**Interfaces:**
- Consumes: `auth` from `packages/api/src/auth.ts`; `db` from `@contai/db`.
- Produces: `router`, `publicProcedure`, `protectedProcedure` (from `trpc.ts`); `createContext` + `type Context` (from `context.ts`); `appRouter` + `type AppRouter` (from `routers/_app.ts`, empty until Tasks 19-24 fill it in); `useTRPC()` + `TRPCProvider` (client hook access, `apps/web/src/lib/trpc/client.ts`); `getServerCaller()` (RSC helper, `apps/web/src/lib/trpc/server.ts`) — consumed by every task below and, later, by Section F/G/H.

- [ ] **Step 1: Add tRPC dependencies**

`packages/api/package.json` — add to `dependencies`: `"@trpc/server": "^11"`, `"@contai/domain": "workspace:*"`, `"zod": "^4"`.

`apps/web/package.json` — add to `dependencies`: `"@trpc/client": "^11"`, `"@trpc/tanstack-react-query": "^11"`.

- [ ] **Step 2: Write `packages/api/src/context.ts`**

```ts
import { db } from '@contai/db'
import { auth } from './auth'

export async function createContext({ headers }: { headers: Headers }) {
    const session = await auth.api.getSession({ headers })
    return { session, userId: session?.user.id ?? null, db }
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

- [ ] **Step 3: Write `packages/api/src/trpc.ts`**

```ts
import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
    return next({ ctx: { ...ctx, userId: ctx.userId } })
})
```

- [ ] **Step 4: Write `packages/api/src/routers/_app.ts`** (empty shell — filled in by Tasks 19-24)

```ts
import { router } from '../trpc'

export const appRouter = router({})

export type AppRouter = typeof appRouter
```

- [ ] **Step 5: Update `packages/api/src/index.ts`**

```ts
export { auth } from './auth'
export type { Session } from './auth'
export { createContext } from './context'
export type { Context } from './context'
export { appRouter } from './routers/_app'
export type { AppRouter } from './routers/_app'
```

- [ ] **Step 6: Write `apps/web/src/app/api/trpc/[trpc]/route.ts`**

```ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter, createContext } from '@contai/api'

function handler(request: Request) {
    return fetchRequestHandler({
        endpoint: '/api/trpc',
        req: request,
        router: appRouter,
        createContext: () => createContext({ headers: request.headers }),
    })
}

export { handler as GET, handler as POST }
```

- [ ] **Step 7: Write `apps/web/src/lib/trpc/server.ts`** (RSC caller — no HTTP round trip)

```ts
import 'server-only'
import { headers } from 'next/headers'
import { appRouter, createContext } from '@contai/api'

export async function getServerCaller() {
    const ctx = await createContext({ headers: await headers() })
    return appRouter.createCaller(ctx)
}
```

- [ ] **Step 8: Write `apps/web/src/lib/trpc/client.ts`**

```ts
'use client'

import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '@contai/api'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
```

- [ ] **Step 9: Write `apps/web/src/lib/trpc/provider.tsx`**

```tsx
'use client'

import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import type { AppRouter } from '@contai/api'
import { TRPCProvider } from './client'

export function TRPCReactProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient()
    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [httpBatchLink({ url: '/api/trpc' })],
        }),
    )

    return (
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            {children}
        </TRPCProvider>
    )
}
```

- [ ] **Step 10: Wire `TRPCReactProvider` inside `QueryProvider`**

Edit `apps/web/src/providers/query-provider.tsx`:

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'
import { TRPCReactProvider } from '@/lib/trpc/provider'

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <TRPCReactProvider>{children}</TRPCReactProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
```

- [ ] **Step 11: Verify**

```bash
pnpm install
pnpm --filter @contai/api typecheck
pnpm --filter web typecheck
pnpm --filter web dev
```

Expected: app boots with an (empty) tRPC router mounted; `/api/trpc/ping` (or any procedure call) 404s meaningfully rather than crashing, since `appRouter` has no procedures yet.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add tRPC infrastructure (context, protectedProcedure, fetch adapter, client Provider)"
```

---

## Task 19: `cards` router + `use-cards.ts`

**Files:**
- Create: `packages/api/src/routers/cards.ts`
- Edit: `packages/api/src/routers/_app.ts`
- Create: `apps/web/src/hooks/use-cards.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router` (Task 18); `cards` table from `@contai/db`; `useTRPC` (Task 18).
- Produces: `cardsRouter` merged into `appRouter` as `cards`; `useCards()`, `useCreateCard()`, `useUpdateCard()`, `useDeleteCard()` — consumed by Section F Task 27 (card form) and Section G Task 35 (`/ajustes`).

- [ ] **Step 1: Write `packages/api/src/routers/cards.ts`**

```ts
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { cards } from '@contai/db'
import { protectedProcedure, router } from '../trpc'

const cardInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    closingDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
    creditLimit: z.number().positive().nullable().optional(),
    color: z.string().min(1),
})

export const cardsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db
            .select()
            .from(cards)
            .where(and(eq(cards.userId, ctx.userId), eq(cards.active, true), isNull(cards.deletedAt)))
            .orderBy(asc(cards.createdAt))
    }),

    create: protectedProcedure.input(cardInputSchema).mutation(async ({ ctx, input }) => {
        const [data] = await ctx.db
            .insert(cards)
            .values({
                userId: ctx.userId,
                name: input.name,
                closingDay: input.closingDay,
                dueDay: input.dueDay,
                creditLimit: input.creditLimit != null ? String(input.creditLimit) : null,
                color: input.color,
            })
            .returning()
        return data
    }),

    update: protectedProcedure
        .input(z.object({ id: z.string().uuid(), data: cardInputSchema.partial().extend({ active: z.boolean().optional() }) }))
        .mutation(async ({ ctx, input }) => {
            const updateData: Partial<typeof cards.$inferInsert> = {}
            if (input.data.name !== undefined) updateData.name = input.data.name
            if (input.data.closingDay !== undefined) updateData.closingDay = input.data.closingDay
            if (input.data.dueDay !== undefined) updateData.dueDay = input.data.dueDay
            if (input.data.creditLimit !== undefined) {
                updateData.creditLimit = input.data.creditLimit != null ? String(input.data.creditLimit) : null
            }
            if (input.data.color !== undefined) updateData.color = input.data.color
            if (input.data.active !== undefined) updateData.active = input.data.active

            const [data] = await ctx.db
                .update(cards)
                .set(updateData)
                .where(and(eq(cards.id, input.id), eq(cards.userId, ctx.userId), isNull(cards.deletedAt)))
                .returning()

            if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cartão não encontrado' })
            return data
        }),

    delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
        await ctx.db
            .update(cards)
            .set({ deletedAt: new Date() })
            .where(and(eq(cards.id, input.id), eq(cards.userId, ctx.userId), isNull(cards.deletedAt)))
        return { ok: true }
    }),
})
```

- [ ] **Step 2: Merge into `appRouter`**

Edit `packages/api/src/routers/_app.ts`:

```ts
import { router } from '../trpc'
import { cardsRouter } from './cards'

export const appRouter = router({
    cards: cardsRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Write `apps/web/src/hooks/use-cards.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCards() {
    const trpc = useTRPC()
    return useQuery(trpc.cards.list.queryOptions())
}

export function useCreateCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão criado')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useUpdateCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão atualizado')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão removido')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

Note the shape change from the old REST hooks: `useUpdateCard()` now takes `{ id, data }` (matching the router's `input`), not `{ id, input }`. `useCreateCard().mutate(values)` matches `cardInputSchema` directly (camelCase `closingDay`/`dueDay`/`creditLimit`, not the old snake_case REST body) — Section F's card form (built later) should use these field names directly.

- [ ] **Step 4: Verify manually**

```bash
pnpm dev
```

Log in via the browser. In a scratch client component (or the browser console against the mounted provider once Section F exists), call `useCreateCard().mutate({ name: 'Nubank', closingDay: 10, dueDay: 20, color: '#8A2BE2' })` and confirm a row appears via `useCards()`. Confirm an unauthenticated request to `/api/trpc/cards.list` (no session cookie) returns a tRPC `UNAUTHORIZED` error, not data.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cards tRPC router and hooks"
```

---

## Task 20: `categories` router (idempotent default seed) + `use-categories.ts`

**Files:**
- Create: `packages/api/src/routers/categories.ts`
- Edit: `packages/api/src/routers/_app.ts`
- Create: `apps/web/src/hooks/use-categories.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router` (Task 18); `categories` table from `@contai/db`.
- Produces: `categoriesRouter` merged as `categories`; `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` — consumed by Section F Task 26 (quick-add/parser context) and Section G Task 35 (`/ajustes`).

- [ ] **Step 1: Write `packages/api/src/routers/categories.ts`**

```ts
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { categories } from '@contai/db'
import { protectedProcedure, router } from '../trpc'

const DEFAULT_CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Compras', 'Outros']

const categoryInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    icon: z.string().max(40).nullable().optional(),
})

export const categoriesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        const existing = await ctx.db
            .select()
            .from(categories)
            .where(and(eq(categories.userId, ctx.userId), isNull(categories.deletedAt)))
            .orderBy(asc(categories.name))

        const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))
        const missing = DEFAULT_CATEGORIES.filter((name) => !existingNames.has(name.toLowerCase()))

        if (missing.length === 0) {
            return existing
        }

        const inserted = await ctx.db
            .insert(categories)
            .values(missing.map((name) => ({ name, userId: ctx.userId })))
            .returning()

        return [...existing, ...inserted].sort((a, b) => a.name.localeCompare(b.name))
    }),

    create: protectedProcedure.input(categoryInputSchema).mutation(async ({ ctx, input }) => {
        try {
            const [data] = await ctx.db
                .insert(categories)
                .values({ name: input.name, icon: input.icon, userId: ctx.userId })
                .returning()
            return data
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
                throw new TRPCError({ code: 'CONFLICT', message: 'Categoria já existe' })
            }
            throw error
        }
    }),

    update: protectedProcedure
        .input(z.object({ id: z.string().uuid(), data: categoryInputSchema.partial() }))
        .mutation(async ({ ctx, input }) => {
            const [data] = await ctx.db
                .update(categories)
                .set(input.data)
                .where(and(eq(categories.id, input.id), eq(categories.userId, ctx.userId), isNull(categories.deletedAt)))
                .returning()

            if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Categoria não encontrada' })
            return data
        }),

    delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
        await ctx.db
            .update(categories)
            .set({ deletedAt: new Date() })
            .where(and(eq(categories.id, input.id), eq(categories.userId, ctx.userId), isNull(categories.deletedAt)))
        return { ok: true }
    }),
})
```

- [ ] **Step 2: Merge into `appRouter`**

```ts
import { router } from '../trpc'
import { cardsRouter } from './cards'
import { categoriesRouter } from './categories'

export const appRouter = router({
    cards: cardsRouter,
    categories: categoriesRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Write `apps/web/src/hooks/use-categories.ts`**

`@trpc/tanstack-react-query`'s `queryOptions()` already dedupes concurrent identical requests through TanStack Query's own request deduplication (same `queryKey` in flight only fires once) — the old REST hook's hand-rolled `seedInFlight` single-flight guard existed only to work around raw `fetch` having no such dedup. It's not needed here.

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCategories() {
    const trpc = useTRPC()
    return useQuery(trpc.categories.list.queryOptions())
}

export function useCreateCategory() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.categories.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
                toast.success('Categoria criada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useUpdateCategory() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.categories.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
                toast.success('Categoria atualizada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteCategory() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.categories.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
                toast.success('Categoria removida')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

- [ ] **Step 4: Verify manually**

```bash
pnpm dev
```

Call `useCategories()` twice in a row (e.g. two mounted components, or refetch) and confirm the 7 defaults seed once with no `categories_user_name_unique` violation (check via `pnpm --filter @contai/db exec drizzle-kit studio` if needed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add categories tRPC router with idempotent default seed"
```

---

## Task 21: `merchants` router + `use-merchants.ts`

**Files:**
- Create: `packages/api/src/routers/merchants.ts`
- Edit: `packages/api/src/routers/_app.ts`
- Create: `apps/web/src/hooks/use-merchants.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router` (Task 18); `merchants` table from `@contai/db`.
- Produces: `merchantsRouter` merged as `merchants`; `useMerchants()` returning merchants ordered by `usageCount` desc — consumed by Section F Task 16/26 (`ParserContext` wiring inside `quick-add.tsx`).

- [ ] **Step 1: Write `packages/api/src/routers/merchants.ts`**

```ts
import { and, desc, eq, isNull } from 'drizzle-orm'
import { merchants } from '@contai/db'
import { protectedProcedure, router } from '../trpc'

export const merchantsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db
            .select()
            .from(merchants)
            .where(and(eq(merchants.userId, ctx.userId), isNull(merchants.deletedAt)))
            .orderBy(desc(merchants.usageCount))
    }),
})
```

- [ ] **Step 2: Merge into `appRouter`**

```ts
import { router } from '../trpc'
import { cardsRouter } from './cards'
import { categoriesRouter } from './categories'
import { merchantsRouter } from './merchants'

export const appRouter = router({
    cards: cardsRouter,
    categories: categoriesRouter,
    merchants: merchantsRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Write `apps/web/src/hooks/use-merchants.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useMerchants() {
    const trpc = useTRPC()
    return useQuery(trpc.merchants.list.queryOptions())
}
```

- [ ] **Step 4: Verify manually**

```bash
pnpm dev
```

Confirm `useMerchants()` returns `[]` for a fresh user with no 500/`UNAUTHORIZED` surprises.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add merchants tRPC router and hook"
```

---

## Task 22: `expenses` router (`create`) + `use-create-expense.ts`

**Files:**
- Create: `packages/api/src/routers/expenses.ts`
- Edit: `packages/api/src/routers/_app.ts`
- Create: `apps/web/src/hooks/use-create-expense.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router` (Task 18); `cards`, `expenses`, `expenseInstallments`, `installmentPlans`, `merchants`, `recurrences` from `@contai/db`; `generateInstallments`, `generateRecurrenceOccurrences`, `getInvoiceForExpense`, `normalizeMerchantName`, `toISODate`, `type CardCycle` from `@contai/domain`.
- Produces: `expensesRouter` merged as `expenses`, exposing `expenses.create` (`ctx.db.transaction`-wrapped, ties invoice/installments/recurrence together exactly as the superseded REST handler did) and `useCreateExpense()` — consumed by Section F Task 26 (quick-add) and Task 27 (manual dialog).

- [ ] **Step 1: Write `packages/api/src/routers/expenses.ts`**

```ts
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { cards, expenseInstallments, expenses, installmentPlans, merchants, recurrences } from '@contai/db'
import {
    generateInstallments,
    generateRecurrenceOccurrences,
    getInvoiceForExpense,
    normalizeMerchantName,
    toISODate,
    type CardCycle,
} from '@contai/domain'
import { protectedProcedure, router } from '../trpc'

const createExpenseInputSchema = z
    .object({
        amount: z.number().positive('Informe um valor maior que zero'),
        description: z.string().min(1, 'Descreva a despesa').max(120),
        merchantName: z.string().max(80).optional(),
        categoryId: z.string().uuid().nullable().optional(),
        cardId: z.string().uuid().nullable().optional(),
        purchaseDate: z.coerce.date(),
        type: z.enum(['single', 'installment', 'recurring']),
        installments: z.number().int().min(2).max(48).optional(),
        frequency: z.enum(['weekly', 'monthly', 'yearly']).optional(),
        endDate: z.string().date().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
    })
    .refine((v) => v.type !== 'installment' || !!v.installments, {
        path: ['installments'],
        message: 'Informe o número de parcelas',
    })
    .refine((v) => v.type !== 'recurring' || !!v.frequency, {
        path: ['frequency'],
        message: 'Informe a frequência',
    })

export const expensesRouter = router({
    create: protectedProcedure.input(createExpenseInputSchema).mutation(async ({ ctx, input }) => {
        return ctx.db.transaction(async (tx) => {
            let merchantId: string | null = null
            if (input.merchantName) {
                const normalized = normalizeMerchantName(input.merchantName)
                const [existing] = await tx
                    .select()
                    .from(merchants)
                    .where(and(eq(merchants.normalizedName, normalized), eq(merchants.userId, ctx.userId), isNull(merchants.deletedAt)))
                    .limit(1)

                if (existing) {
                    merchantId = existing.id
                    await tx
                        .update(merchants)
                        .set({ usageCount: existing.usageCount + 1 })
                        .where(eq(merchants.id, existing.id))
                } else {
                    const [created] = await tx
                        .insert(merchants)
                        .values({
                            userId: ctx.userId,
                            normalizedName: normalized,
                            displayName: input.merchantName,
                            defaultCategoryId: input.categoryId ?? null,
                            defaultCardId: input.cardId ?? null,
                            usageCount: 1,
                        })
                        .returning()
                    merchantId = created.id
                }
            }

            const [expense] = await tx
                .insert(expenses)
                .values({
                    userId: ctx.userId,
                    type: input.type,
                    description: input.description,
                    merchantId,
                    categoryId: input.categoryId ?? null,
                    cardId: input.cardId ?? null,
                    totalAmount: String(input.amount),
                    purchaseDate: toISODate(input.purchaseDate),
                    notes: input.notes ?? null,
                })
                .returning()

            let card: CardCycle | null = null
            if (input.cardId) {
                const [cardRow] = await tx
                    .select({ closing_day: cards.closingDay, due_day: cards.dueDay })
                    .from(cards)
                    .where(and(eq(cards.id, input.cardId), eq(cards.userId, ctx.userId), isNull(cards.deletedAt)))
                    .limit(1)
                card = cardRow ?? null
            }

            if (input.type === 'installment' && input.installments) {
                const [plan] = await tx
                    .insert(installmentPlans)
                    .values({ expenseId: expense.id, userId: ctx.userId, installmentsTotal: input.installments })
                    .returning()

                const generatedInstallments = generateInstallments(input.amount, input.installments, input.purchaseDate, card)
                const occurrences = await tx
                    .insert(expenseInstallments)
                    .values(
                        generatedInstallments.map((installment) => ({
                            userId: ctx.userId,
                            expenseId: expense.id,
                            installmentPlanId: plan.id,
                            merchantId,
                            categoryId: input.categoryId ?? null,
                            cardId: input.cardId ?? null,
                            description: input.description,
                            installmentNumber: installment.installment_number,
                            installmentsTotal: installment.installments_total,
                            amount: String(installment.amount),
                            occurrenceDate: installment.occurrence_date,
                            dueDate: installment.due_date,
                            invoiceMonth: installment.invoice_month,
                        })),
                    )
                    .returning()

                return { expense, occurrences }
            }

            if (input.type === 'recurring' && input.frequency) {
                const [recurrence] = await tx
                    .insert(recurrences)
                    .values({
                        userId: ctx.userId,
                        frequency: input.frequency,
                        startDate: toISODate(input.purchaseDate),
                        endDate: input.endDate ?? null,
                    })
                    .returning()

                const untilDate = new Date(input.purchaseDate)
                untilDate.setMonth(untilDate.getMonth() + 12)
                const dates = generateRecurrenceOccurrences(
                    input.purchaseDate,
                    input.frequency,
                    untilDate,
                    input.endDate ? new Date(input.endDate) : null,
                )

                const occurrences = await tx
                    .insert(expenseInstallments)
                    .values(
                        dates.map((date) => {
                            const occurrenceDate = new Date(date)
                            const invoice = getInvoiceForExpense(occurrenceDate, card)
                            return {
                                userId: ctx.userId,
                                expenseId: expense.id,
                                recurrenceId: recurrence.id,
                                merchantId,
                                categoryId: input.categoryId ?? null,
                                cardId: input.cardId ?? null,
                                description: input.description,
                                amount: String(input.amount),
                                occurrenceDate: date,
                                dueDate: toISODate(invoice.dueDate),
                                invoiceMonth: invoice.month,
                            }
                        }),
                    )
                    .returning()

                return { expense, occurrences }
            }

            const invoice = getInvoiceForExpense(input.purchaseDate, card)
            const [occurrence] = await tx
                .insert(expenseInstallments)
                .values({
                    userId: ctx.userId,
                    expenseId: expense.id,
                    merchantId,
                    categoryId: input.categoryId ?? null,
                    cardId: input.cardId ?? null,
                    description: input.description,
                    amount: String(input.amount),
                    occurrenceDate: toISODate(input.purchaseDate),
                    dueDate: toISODate(invoice.dueDate),
                    invoiceMonth: invoice.month,
                })
                .returning()

            return { expense, occurrences: [occurrence] }
        })
    }),
})
```

- [ ] **Step 2: Merge into `appRouter`**

```ts
import { router } from '../trpc'
import { cardsRouter } from './cards'
import { categoriesRouter } from './categories'
import { merchantsRouter } from './merchants'
import { expensesRouter } from './expenses'

export const appRouter = router({
    cards: cardsRouter,
    categories: categoriesRouter,
    merchants: merchantsRouter,
    expenses: expensesRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Write `apps/web/src/hooks/use-create-expense.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCreateExpense() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.expenses.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.merchants.list.queryKey() })
                toast.success('Despesa registrada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

Note: this hook references `trpc.occurrences.list` and `trpc.reports.summary`, which don't exist until Tasks 23-24. Write this hook in Task 22 as specified by the design's Goals section (proving `expenses.create` end-to-end is explicitly in scope), but expect a typecheck error on those two invalidation lines until Task 23/24 land — either write Task 22's hook with only the `merchants.list` invalidation for now and add the other two invalidations as one-line additions in Tasks 23/24, or execute Tasks 22-24 together before running `pnpm --filter web typecheck`. Prefer the former (incremental, always-green) if executing task-by-task with review checkpoints.

- [ ] **Step 4: Verify manually**

```bash
pnpm dev
```

Test all three branches: single (`{ amount: 50, description: 'mercado', purchaseDate: '2026-09-09', type: 'single' }` → 1 occurrence row), installment (same + `type: 'installment', installments: 3` → 3 rows, `installmentNumber` 1-3, `occurrenceDate`s one calendar month apart), recurring (`type: 'recurring', frequency: 'monthly'` → 12 rows one month apart, including the start date).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add expenses tRPC router tying invoice/installments/recurrence together"
```

---

## Task 23: `occurrences` router (`list`/`update`/`delete`) + `use-occurrences.ts`

**Files:**
- Create: `packages/api/src/routers/occurrences.ts`
- Edit: `packages/api/src/routers/_app.ts`, `apps/web/src/hooks/use-create-expense.ts` (add the deferred `occurrences.list` invalidation)
- Create: `apps/web/src/hooks/use-occurrences.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router` (Task 18); `expenseInstallments` from `@contai/db`.
- Produces: `occurrencesRouter` merged as `occurrences`; `useOccurrences(filters)`, `useUpdateOccurrence()`, `useDeleteOccurrence()` — consumed by Section F Task 28 (`occurrence-list.tsx`) and Task 29 (`occurrence-sheet.tsx`).

- [ ] **Step 1: Write `packages/api/src/routers/occurrences.ts`**

```ts
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, desc, eq, gte, ilike, isNull, lte } from 'drizzle-orm'
import { expenseInstallments } from '@contai/db'
import { protectedProcedure, router } from '../trpc'

const occurrenceFiltersSchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    cardId: z.string().uuid().optional(),
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
})

const occurrencePatchSchema = z.object({
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
    amount: z.number().positive().optional(),
    description: z.string().min(1).max(120).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    cardId: z.string().uuid().nullable().optional(),
})

const scopeSchema = z.enum(['occurrence', 'future', 'series', 'end'])

function scopedConditions(
    scope: z.infer<typeof scopeSchema>,
    userId: string,
    current: typeof expenseInstallments.$inferSelect,
) {
    const conditions = [eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)]

    if (scope === 'future' && current.installmentPlanId) {
        conditions.push(
            eq(expenseInstallments.installmentPlanId, current.installmentPlanId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
        return conditions
    }
    if (scope === 'series' && current.recurrenceId) {
        conditions.push(eq(expenseInstallments.recurrenceId, current.recurrenceId))
        return conditions
    }
    if (scope === 'end' && current.recurrenceId) {
        conditions.push(
            eq(expenseInstallments.recurrenceId, current.recurrenceId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
        return conditions
    }
    throw new TRPCError({ code: 'UNPROCESSABLE_CONTENT', message: 'Escopo inválido para esta ocorrência' })
}

export const occurrencesRouter = router({
    list: protectedProcedure.input(occurrenceFiltersSchema).query(async ({ ctx, input }) => {
        const conditions = [eq(expenseInstallments.userId, ctx.userId), isNull(expenseInstallments.deletedAt)]

        if (input.from) conditions.push(gte(expenseInstallments.occurrenceDate, input.from))
        if (input.to) conditions.push(lte(expenseInstallments.occurrenceDate, input.to))
        if (input.q) conditions.push(ilike(expenseInstallments.description, `%${input.q}%`))
        if (input.categoryId) conditions.push(eq(expenseInstallments.categoryId, input.categoryId))
        if (input.cardId) conditions.push(eq(expenseInstallments.cardId, input.cardId))
        if (input.status) conditions.push(eq(expenseInstallments.status, input.status))

        return ctx.db
            .select()
            .from(expenseInstallments)
            .where(and(...conditions))
            .orderBy(desc(expenseInstallments.occurrenceDate))
    }),

    update: protectedProcedure
        .input(z.object({ id: z.string().uuid(), scope: scopeSchema, data: occurrencePatchSchema }))
        .mutation(async ({ ctx, input }) => {
            const patch: Partial<typeof expenseInstallments.$inferInsert> = {
                ...(input.data.status && { status: input.data.status }),
                ...(input.data.amount && { amount: String(input.data.amount) }),
                ...(input.data.description && { description: input.data.description }),
                ...(input.data.categoryId !== undefined && { categoryId: input.data.categoryId }),
                ...(input.data.cardId !== undefined && { cardId: input.data.cardId }),
            }

            if (input.scope === 'occurrence') {
                const [data] = await ctx.db
                    .update(expenseInstallments)
                    .set(patch)
                    .where(
                        and(
                            eq(expenseInstallments.id, input.id),
                            eq(expenseInstallments.userId, ctx.userId),
                            isNull(expenseInstallments.deletedAt),
                        ),
                    )
                    .returning()

                if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ocorrência não encontrada' })
                return [data]
            }

            const [current] = await ctx.db
                .select()
                .from(expenseInstallments)
                .where(
                    and(
                        eq(expenseInstallments.id, input.id),
                        eq(expenseInstallments.userId, ctx.userId),
                        isNull(expenseInstallments.deletedAt),
                    ),
                )
                .limit(1)

            if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ocorrência não encontrada' })

            const conditions = scopedConditions(input.scope, ctx.userId, current)
            return ctx.db.update(expenseInstallments).set(patch).where(and(...conditions)).returning()
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string().uuid(), scope: scopeSchema }))
        .mutation(async ({ ctx, input }) => {
            const deletedAt = new Date()

            if (input.scope === 'occurrence') {
                const [deleted] = await ctx.db
                    .update(expenseInstallments)
                    .set({ deletedAt })
                    .where(
                        and(
                            eq(expenseInstallments.id, input.id),
                            eq(expenseInstallments.userId, ctx.userId),
                            isNull(expenseInstallments.deletedAt),
                        ),
                    )
                    .returning()

                if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ocorrência não encontrada' })
                return { ok: true }
            }

            const [current] = await ctx.db
                .select()
                .from(expenseInstallments)
                .where(
                    and(
                        eq(expenseInstallments.id, input.id),
                        eq(expenseInstallments.userId, ctx.userId),
                        isNull(expenseInstallments.deletedAt),
                    ),
                )
                .limit(1)

            if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ocorrência não encontrada' })

            const conditions = scopedConditions(input.scope, ctx.userId, current)
            await ctx.db.update(expenseInstallments).set({ deletedAt }).where(and(...conditions))
            return { ok: true }
        }),
})
```

Note: `scopedConditions` factors out the duplicated scope-resolution logic the old REST `PATCH`/`DELETE` handlers each repeated inline — same behavior, less repetition, since both procedures now live in the same file and can share it.

- [ ] **Step 2: Merge into `appRouter`**

```ts
import { router } from '../trpc'
import { cardsRouter } from './cards'
import { categoriesRouter } from './categories'
import { merchantsRouter } from './merchants'
import { expensesRouter } from './expenses'
import { occurrencesRouter } from './occurrences'

export const appRouter = router({
    cards: cardsRouter,
    categories: categoriesRouter,
    merchants: merchantsRouter,
    expenses: expensesRouter,
    occurrences: occurrencesRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Write `apps/web/src/hooks/use-occurrences.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export interface OccurrenceFilters {
    from?: string
    to?: string
    q?: string
    categoryId?: string
    cardId?: string
    status?: 'pending' | 'paid' | 'cancelled'
}

export function useOccurrences(filters: OccurrenceFilters) {
    const trpc = useTRPC()
    return useQuery(trpc.occurrences.list.queryOptions(filters))
}

export function useUpdateOccurrence() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.occurrences.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                toast.success('Ocorrência atualizada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteOccurrence() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.occurrences.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                toast.success('Ocorrência removida')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

Both mutation hooks reference `trpc.reports.summary` (Task 24) — same deferred-typecheck note as Task 22 Step 3 applies; add that invalidation line now since `useOccurrences` itself already depends on nothing from Task 24, but if executing task-by-task, comment out or omit the `reports.summary` invalidation line until Task 24 lands, then add it back.

- [ ] **Step 4: Add the deferred `occurrences.list` invalidation to `use-create-expense.ts`**

Edit `apps/web/src/hooks/use-create-expense.ts`, uncommenting/adding the line noted in Task 22 Step 3:

```ts
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
```

- [ ] **Step 5: Verify manually**

```bash
pnpm dev
```

Reuse the installment expense from Task 22's verification. `useOccurrences({ status: 'pending' })` → confirm all 3 rows. `useUpdateOccurrence().mutate({ id: <2nd occurrence id>, scope: 'future', data: { status: 'paid' } })` → confirm installments 2 and 3 flip to paid, installment 1 stays pending. `useDeleteOccurrence().mutate({ id: <2nd occurrence id>, scope: 'occurrence' })` → confirm it disappears from `useOccurrences()`, but the row still exists in `expense_installments` with `deletedAt` set (soft delete, confirm via `drizzle-kit studio`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add occurrences tRPC router with scoped soft-delete/edit"
```

---

## Task 24: `reports` router (`summary`) + `use-summary.ts`

**Files:**
- Create: `packages/api/src/routers/reports.ts`
- Edit: `packages/api/src/routers/_app.ts`, `apps/web/src/hooks/use-create-expense.ts`, `apps/web/src/hooks/use-occurrences.ts` (add the deferred `reports.summary` invalidations)
- Create: `apps/web/src/hooks/use-summary.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router` (Task 18); `expenseInstallments` from `@contai/db`; `summarizeMonth` from `@contai/domain`.
- Produces: `reportsRouter` merged as `reports`; `useSummary(month)` — replaces the two direct `apiClient.get('/api/reports/summary?month=...')` calls the old REST-based plan had scattered in Section G's `/inicio` and `/relatorios` pages. Consumed by Section G Task 32 (`/inicio`) and Task 34 (`/relatorios`).

- [ ] **Step 1: Write `packages/api/src/routers/reports.ts`**

```ts
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { expenseInstallments } from '@contai/db'
import { summarizeMonth } from '@contai/domain'
import { protectedProcedure, router } from '../trpc'

export const reportsRouter = router({
    summary: protectedProcedure.input(z.object({ month: z.string() })).query(async ({ ctx, input }) => {
        const rows = await ctx.db
            .select({
                amount: expenseInstallments.amount,
                category_id: expenseInstallments.categoryId,
                card_id: expenseInstallments.cardId,
                status: expenseInstallments.status,
            })
            .from(expenseInstallments)
            .where(
                and(
                    eq(expenseInstallments.userId, ctx.userId),
                    eq(expenseInstallments.invoiceMonth, input.month),
                    isNull(expenseInstallments.deletedAt),
                ),
            )

        const formattedRows = rows.map((r) => ({
            amount: Number(r.amount),
            category_id: r.category_id,
            card_id: r.card_id,
            status: r.status,
        }))

        return summarizeMonth(formattedRows)
    }),
})
```

- [ ] **Step 2: Final merge into `appRouter`**

```ts
import { router } from '../trpc'
import { cardsRouter } from './cards'
import { categoriesRouter } from './categories'
import { merchantsRouter } from './merchants'
import { expensesRouter } from './expenses'
import { occurrencesRouter } from './occurrences'
import { reportsRouter } from './reports'

export const appRouter = router({
    cards: cardsRouter,
    categories: categoriesRouter,
    merchants: merchantsRouter,
    expenses: expensesRouter,
    occurrences: occurrencesRouter,
    reports: reportsRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Write `apps/web/src/hooks/use-summary.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useSummary(month: string) {
    const trpc = useTRPC()
    return useQuery(trpc.reports.summary.queryOptions({ month }))
}
```

- [ ] **Step 4: Fill in the deferred `reports.summary` invalidations**

Edit `apps/web/src/hooks/use-create-expense.ts` and `apps/web/src/hooks/use-occurrences.ts` to add/uncomment the `queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })` lines noted in Tasks 22-23.

- [ ] **Step 5: Verify manually**

```bash
pnpm dev
```

`useSummary('2026-09')` → confirm the shape matches `summarizeMonth`'s return type and totals match what Task 22's verification created.

Run the full battery once all of Tasks 18-24 are done: `pnpm turbo run typecheck lint test && pnpm --filter web build`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add reports tRPC router (monthly summary)"
```
```

- [ ] **Step 4: Self-review the new file**

Confirm: every router (cards, categories, merchants, expenses, occurrences, reports) has a task; every hook name matches what Section F/G's existing docs reference (`useCards`, `useCreateCard`, `useUpdateCard`, `useDeleteCard`, `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, `useMerchants`, `useCreateExpense`, `useOccurrences`, `useUpdateOccurrence`, `useDeleteOccurrence` — all present; `useSummary` is new but only replaces Section G's two inline `apiClient.get` calls, not an existing hook name); no `TBD`/`TODO`/placeholder code blocks; cross-task references (`trpc.occurrences.list` used before Task 23 defines it) are called out explicitly with a stated resolution, not silently left dangling.

- [ ] **Step 5: Commit the doc rewrite**

```bash
git add -A
git commit -m "docs: rewrite Section E API/hooks plan as tRPC procedures"
```

---

## Verification (full, after all 6 tasks)

```bash
docker compose up -d
pnpm install
pnpm turbo run typecheck lint test
pnpm --filter web build
pnpm --filter web dev   # manual: /login, /cadastro still work end-to-end
```

Confirm:
- `apps/web`, `packages/domain`, `packages/db`, `packages/api` all exist with the structure in the spec's "Target repo structure".
- No file under `apps/web/src` imports `@/db`, `@/lib/finance/*`, or `@/lib/schemas/auth-schema` anymore — only `@contai/db`, `@contai/domain`, `@contai/api`.
- `packages/api` contains only `auth.ts` + `index.ts` (no `trpc.ts`/`context.ts`/`routers/`) — confirming this execution did not build the tRPC layer.
- `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md` exists and is a complete, no-placeholder task breakdown; `section-e-api-hooks.md` carries a superseded banner but is otherwise untouched; Sections A-D/F/G/H are completely untouched.

## Self-Review

**Spec coverage:** design spec's phases 1-3 (workspace scaffolding, `packages/db`, `packages/domain`) → Tasks 1-3. Phase 4's non-tRPC portion (move Better Auth server instance) → Task 4; phase 4's tRPC portion (trpc.ts/context.ts/routers) and phase 5 (fetch adapter/RSC caller/client Provider) → folded into Task 6's rewritten Section E plan (Task 18 there), per the user's explicit scoping decision, not built now. Phase 6 (docs/CLAUDE.md updates, superseded-doc banners) → Task 5 + Task 6 Steps 1-2. "Superseded documents" section → Task 5 Step 2 (spec §8 banner) and Task 6 Step 1 (Section E banner) + new `section-e-api-trpc.md`. Config files section → exact content used in Tasks 1-4 (with two flagged, necessary deviations: `packages/api/package.json` omits `@contai/domain`/`@trpc/server`/`zod` until Task 6's plan actually adds them, and root `package.json` adds `tsx` beyond the spec's literal snippet, both explained inline). "Explicitly out of scope" (Expo app, other domain routers built *now*, Section E rewrite as a "separate implementation plan") → honored; Task 6 *produces* that separate plan rather than executing it.

**Placeholder scan:** no `TBD`/`TODO`; every step has real, complete file content; the two intentionally-deferred cross-references (Task 22→23, Task 22/23→24 `reports`/`occurrences` invalidations) are explicitly called out with the exact line to add later, not left as unexplained gaps.

**Type consistency:** `CardCycle` (from `@contai/domain`, unchanged) is reused identically across Task 22's `expenses` router. `OccurrenceFilters` (Task 23) is the single shape for `useOccurrences`' argument. Hook names/signatures match 1:1 with what Section F/G's existing task docs already reference (verified against the grep of `section-f-ui-components.md`/`section-g-pages.md` done during planning) — the one intentional new shape change is `useUpdateCard()`'s `{ id, data }` (was `{ id, input }`) and camelCase mutation payloads (`closingDay` not `closing_day`) matching the router's own zod input directly, called out explicitly in Task 19 Step 3.
