# Bolso MVP Implementation Plan — Section E: API + hooks (tRPC)

> **Superseded:** split into
> [`section-e1-api-trpc.md`](./section-e1-api-trpc.md) (backend: `packages/api` tRPC
> infra, a services layer, and thin routers) and
> [`section-e2-web-hooks.md`](./section-e2-web-hooks.md) (frontend: `apps/web` tRPC
> client wiring and React Query hooks), per the confirmed decision to separate the
> tRPC-protocol concern from DB/domain orchestration (now in `packages/api/src/services/`,
> framework-agnostic so it survives a future move off tRPC to a dedicated API) and from
> the client-hook concern. Kept below for historical reference — this file's inline
> business-logic-inside-the-procedure approach was planned but never built.

> Part of the full plan. Master checklist and progress tracking: `../2026-09-09-bolso-mvp-implementation.md`. Shared context below is duplicated from that file so this section can be worked on standalone. Supersedes `section-e-api-hooks.md` (REST version, never built, now deleted — see git history) per `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.

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
