# Bolso MVP Implementation Plan — Section E1: API (tRPC + services)

> Companion doc: client-side tRPC wiring and React Query hooks live in
> [`section-e2-web-hooks.md`](./section-e2-web-hooks.md) — same task numbers (18-24), so
> "Task 19" here (cards) pairs with "Task 19" there.
>
> Replaces the combined tRPC doc previously at `section-e-api-trpc.md` (now a superseded
> stub) and, transitively, the REST version previously at `section-e-api-hooks.md`
> (never built, now deleted — see git history).

> Part of the full plan. Master checklist and progress tracking: `../2026-09-09-bolso-mvp-implementation.md`. Shared context below is duplicated from that file so this section can be worked on standalone.

**Goal:** Build the Bolso MVP's API layer as tRPC procedures backed by a **services
layer** — `packages/api/src/services/*` owns all DB + business-rule orchestration
(framework-agnostic, no `@trpc/*` import), and `packages/api/src/routers/*` are thin
tRPC-specific wrappers around them. This means a future dedicated API (Express/Fastify,
or anything else) can reuse `services/`, `@contai/domain`, and `@contai/db` unchanged —
only `trpc.ts`/`context.ts`/`routers/` get replaced.

**Architecture:** `packages/api` owns `trpc.ts` (`initTRPC` + `protectedProcedure`
middleware + `mapServiceError` helper), `context.ts` (`{ session, userId, db }` built
from Better Auth's session + `@contai/db`), `services/` (one `<resource>-service.ts` per
resource: zod input schemas + plain functions `(db, userId, ...) => Promise<T>`, throwing
`ServiceError` for not-found/conflict/invalid-scope cases), and `routers/` (one thin
router file per resource merged into `appRouter` in `routers/_app.ts`). `apps/web`
exposes a single fetch-adapter route (`app/api/trpc/[trpc]/route.ts`) and a server-caller
helper (`lib/trpc/server.ts`) for RSC pages — both created here since they're part of
exposing the API; the client-side hook wiring is in `section-e2-web-hooks.md`.

**Tech Stack:** `@trpc/server` v11, zod, Drizzle ORM (via `@contai/db`), `@contai/domain`
for business logic (installments/recurrence/invoice/merchant-normalization/dashboard math
— already fully implemented, see `packages/domain/CLAUDE.md`).

**Spec:** `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`

## Global Constraints

- Every procedure is `protectedProcedure` (auth enforced in `trpc.ts`'s middleware, not per-procedure) — never trust a client-supplied `userId`, always use `ctx.userId`.
- **Services never import anything from `@trpc/*`.** Signature is always `(db, userId, ...args) => Promise<T>`. A service signals a domain-level failure (not-found, conflict, invalid scope) by throwing `ServiceError` (`services/errors.ts`) — never `TRPCError`.
- **Routers stay thin.** A procedure body is: `zod input (via `.input()`) → call the matching service function → `.catch(mapServiceError)` if the service can throw`. No DB queries, no domain-function calls, no business logic directly inside a router file.
- One service file per resource, named `<resource>-service.ts`, exporting the zod input schema(s) + inferred type(s) alongside the functions (so a schema stays reusable outside tRPC too).
- Multi-tenant isolation and soft-deletes: every query against user-owned tables (`cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installmentPlans`, `expenseInstallments`) filters `eq(table.userId, userId)` and `isNull(table.deletedAt)`. A delete is always an `.update({ deletedAt: new Date() })`, never `.delete()`.
- `expenseInstallments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Files: lowercase-with-hyphens. Named exports only, except `route.ts` handlers.
- End of every task below: if it's the first task to create a structurally complex folder (`services/`, `routers/`), add/update a short `CLAUDE.md` in that folder. Refresh root `CLAUDE.md` if the task changes the top-level structure.

---

## Task 18: tRPC infra — `trpc.ts`, `context.ts`, `services/errors.ts`, fetch adapter, RSC caller

**Files:**
- Create: `packages/api/src/trpc.ts`, `packages/api/src/context.ts`, `packages/api/src/services/errors.ts`, `packages/api/src/services/types.ts`, `packages/api/src/routers/_app.ts`
- Edit: `packages/api/src/index.ts`, `packages/api/package.json`
- Create: `apps/web/src/app/api/trpc/[trpc]/route.ts`, `apps/web/src/lib/trpc/server.ts`
- Edit: `apps/web/package.json`
- Create/edit: `packages/api/CLAUDE.md`

**Interfaces:**
- Consumes: `auth` from `packages/api/src/auth.ts`; `db` from `@contai/db`.
- Produces: `router`, `publicProcedure`, `protectedProcedure`, `mapServiceError` (from `trpc.ts`); `createContext` + `type Context` (from `context.ts`); `ServiceError` (from `services/errors.ts`); `type Database` (from `services/types.ts`); `appRouter` + `type AppRouter` (from `routers/_app.ts`, empty until Tasks 19-24 fill it in); `getServerCaller()` (RSC helper) — consumed by every task below and by `section-e2-web-hooks.md`.

- [ ] **Step 1: Add tRPC dependencies**

`packages/api/package.json` — add to `dependencies`: `"@trpc/server": "^11"`, `"@contai/domain": "workspace:*"`, `"zod": "^4"`.

`apps/web/package.json` — add to `dependencies`: `"@trpc/server": "^11"` (needed by the fetch-adapter route handler below; the client-side `@trpc/client`/`@trpc/tanstack-react-query` deps are added in `section-e2-web-hooks.md` Task 18).

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

- [ ] **Step 3: Write `packages/api/src/services/types.ts`**

```ts
import type { db } from '@contai/db'

export type Database = typeof db
```

- [ ] **Step 4: Write `packages/api/src/services/errors.ts`**

```ts
export class ServiceError extends Error {
    code: 'NOT_FOUND' | 'CONFLICT' | 'INVALID_SCOPE'

    constructor(code: ServiceError['code'], message: string) {
        super(message)
        this.code = code
    }
}
```

- [ ] **Step 5: Write `packages/api/src/trpc.ts`**

```ts
import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'
import { ServiceError } from './services/errors'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
    return next({ ctx: { ...ctx, userId: ctx.userId } })
})

const TRPC_ERROR_CODE = {
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INVALID_SCOPE: 'UNPROCESSABLE_CONTENT',
} as const

export function mapServiceError(error: unknown): never {
    if (error instanceof ServiceError) {
        throw new TRPCError({ code: TRPC_ERROR_CODE[error.code], message: error.message })
    }
    throw error
}
```

- [ ] **Step 6: Write `packages/api/src/routers/_app.ts`** (empty shell — filled in by Tasks 19-24)

```ts
import { router } from '../trpc'

export const appRouter = router({})

export type AppRouter = typeof appRouter
```

- [ ] **Step 7: Update `packages/api/src/index.ts`**

```ts
export { auth } from './auth'
export type { Session } from './auth'
export { createContext } from './context'
export type { Context } from './context'
export { appRouter } from './routers/_app'
export type { AppRouter } from './routers/_app'
```

- [ ] **Step 8: Write `apps/web/src/app/api/trpc/[trpc]/route.ts`**

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

- [ ] **Step 9: Write `apps/web/src/lib/trpc/server.ts`** (RSC caller — no HTTP round trip)

```ts
import 'server-only'
import { headers } from 'next/headers'
import { appRouter, createContext } from '@contai/api'

export async function getServerCaller() {
    const ctx = await createContext({ headers: await headers() })
    return appRouter.createCaller(ctx)
}
```

- [ ] **Step 10: Write/refresh `packages/api/CLAUDE.md`**

```markdown
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
```

- [ ] **Step 11: Verify**

```bash
pnpm install
pnpm --filter @contai/api typecheck
pnpm --filter web typecheck
```

Expected: succeeds with an (empty) tRPC router mounted; no procedures exist yet so there's nothing to call.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add tRPC infra (context, protectedProcedure, services/errors, fetch adapter, RSC caller)"
```

---

## Task 19: `cards` service + router

**Files:**
- Create: `packages/api/src/services/cards-service.ts`, `packages/api/src/routers/cards.ts`
- Edit: `packages/api/src/routers/_app.ts`

**Interfaces:**
- Consumes: `Database` (Task 18); `cards` table from `@contai/db`; `ServiceError`, `protectedProcedure`, `router`, `mapServiceError` (Task 18).
- Produces: `cardInputSchema`/`CardInput`, `updateCardInputSchema`/`UpdateCardInput`, `listCards`/`createCard`/`updateCard`/`deleteCard` (service); `cardsRouter` merged into `appRouter` as `cards` — consumed by `section-e2-web-hooks.md` Task 19.

- [ ] **Step 1: Write `packages/api/src/services/cards-service.ts`**

```ts
import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { cards } from '@contai/db'
import { ServiceError } from './errors'
import type { Database } from './types'

export const cardInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    closingDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
    creditLimit: z.number().positive().nullable().optional(),
    color: z.string().min(1),
})
export type CardInput = z.infer<typeof cardInputSchema>

export const updateCardInputSchema = cardInputSchema.partial().extend({ active: z.boolean().optional() })
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>

export function listCards(db: Database, userId: string) {
    return db
        .select()
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.active, true), isNull(cards.deletedAt)))
        .orderBy(asc(cards.createdAt))
}

export async function createCard(db: Database, userId: string, input: CardInput) {
    const [data] = await db
        .insert(cards)
        .values({
            userId,
            name: input.name,
            closingDay: input.closingDay,
            dueDay: input.dueDay,
            creditLimit: input.creditLimit != null ? String(input.creditLimit) : null,
            color: input.color,
        })
        .returning()
    return data
}

export async function updateCard(db: Database, userId: string, id: string, input: UpdateCardInput) {
    const updateData: Partial<typeof cards.$inferInsert> = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.closingDay !== undefined) updateData.closingDay = input.closingDay
    if (input.dueDay !== undefined) updateData.dueDay = input.dueDay
    if (input.creditLimit !== undefined) updateData.creditLimit = input.creditLimit != null ? String(input.creditLimit) : null
    if (input.color !== undefined) updateData.color = input.color
    if (input.active !== undefined) updateData.active = input.active

    const [data] = await db
        .update(cards)
        .set(updateData)
        .where(and(eq(cards.id, id), eq(cards.userId, userId), isNull(cards.deletedAt)))
        .returning()

    if (!data) throw new ServiceError('NOT_FOUND', 'Cartão não encontrado')
    return data
}

export async function deleteCard(db: Database, userId: string, id: string) {
    await db
        .update(cards)
        .set({ deletedAt: new Date() })
        .where(and(eq(cards.id, id), eq(cards.userId, userId), isNull(cards.deletedAt)))
    return { ok: true }
}
```

- [ ] **Step 2: Write `packages/api/src/routers/cards.ts`**

```ts
import { z } from 'zod'
import { protectedProcedure, router, mapServiceError } from '../trpc'
import { cardInputSchema, updateCardInputSchema, listCards, createCard, updateCard, deleteCard } from '../services/cards-service'

export const cardsRouter = router({
    list: protectedProcedure.query(({ ctx }) => listCards(ctx.db, ctx.userId)),

    create: protectedProcedure
        .input(cardInputSchema)
        .mutation(({ ctx, input }) => createCard(ctx.db, ctx.userId, input)),

    update: protectedProcedure
        .input(z.object({ id: z.string().uuid(), data: updateCardInputSchema }))
        .mutation(({ ctx, input }) => updateCard(ctx.db, ctx.userId, input.id, input.data).catch(mapServiceError)),

    delete: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(({ ctx, input }) => deleteCard(ctx.db, ctx.userId, input.id)),
})
```

- [ ] **Step 3: Merge into `appRouter`**

Edit `packages/api/src/routers/_app.ts`:

```ts
import { router } from '../trpc'
import { cardsRouter } from './cards'

export const appRouter = router({
    cards: cardsRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @contai/api typecheck
```

Full end-to-end verification (calling `cards.create`/`cards.list` through the client) happens in `section-e2-web-hooks.md` Task 19, once `useCards()`/`useCreateCard()` exist.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cards service and tRPC router"
```

---

## Task 20: `categories` service + router (idempotent default seed)

**Files:**
- Create: `packages/api/src/services/categories-service.ts`, `packages/api/src/routers/categories.ts`
- Edit: `packages/api/src/routers/_app.ts`

**Interfaces:**
- Consumes: `Database`, `ServiceError`, `protectedProcedure`, `router`, `mapServiceError` (Task 18); `categories` table from `@contai/db`.
- Produces: `categoryInputSchema`/`CategoryInput`, `listCategories`/`createCategory`/`updateCategory`/`deleteCategory` (service); `categoriesRouter` merged as `categories` — consumed by `section-e2-web-hooks.md` Task 20.

- [ ] **Step 1: Write `packages/api/src/services/categories-service.ts`**

```ts
import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { categories } from '@contai/db'
import { ServiceError } from './errors'
import type { Database } from './types'

const DEFAULT_CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Compras', 'Outros']

export const categoryInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    icon: z.string().max(40).nullable().optional(),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>

export const updateCategoryInputSchema = categoryInputSchema.partial()
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>

export async function listCategories(db: Database, userId: string) {
    const existing = await db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
        .orderBy(asc(categories.name))

    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))
    const missing = DEFAULT_CATEGORIES.filter((name) => !existingNames.has(name.toLowerCase()))

    if (missing.length === 0) return existing

    const inserted = await db
        .insert(categories)
        .values(missing.map((name) => ({ name, userId })))
        .returning()

    return [...existing, ...inserted].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCategory(db: Database, userId: string, input: CategoryInput) {
    try {
        const [data] = await db
            .insert(categories)
            .values({ name: input.name, icon: input.icon, userId })
            .returning()
        return data
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
            throw new ServiceError('CONFLICT', 'Categoria já existe')
        }
        throw error
    }
}

export async function updateCategory(db: Database, userId: string, id: string, input: UpdateCategoryInput) {
    const [data] = await db
        .update(categories)
        .set(input)
        .where(and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt)))
        .returning()

    if (!data) throw new ServiceError('NOT_FOUND', 'Categoria não encontrada')
    return data
}

export async function deleteCategory(db: Database, userId: string, id: string) {
    await db
        .update(categories)
        .set({ deletedAt: new Date() })
        .where(and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt)))
    return { ok: true }
}
```

- [ ] **Step 2: Write `packages/api/src/routers/categories.ts`**

```ts
import { z } from 'zod'
import { protectedProcedure, router, mapServiceError } from '../trpc'
import {
    categoryInputSchema,
    updateCategoryInputSchema,
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../services/categories-service'

export const categoriesRouter = router({
    list: protectedProcedure.query(({ ctx }) => listCategories(ctx.db, ctx.userId)),

    create: protectedProcedure
        .input(categoryInputSchema)
        .mutation(({ ctx, input }) => createCategory(ctx.db, ctx.userId, input).catch(mapServiceError)),

    update: protectedProcedure
        .input(z.object({ id: z.string().uuid(), data: updateCategoryInputSchema }))
        .mutation(({ ctx, input }) => updateCategory(ctx.db, ctx.userId, input.id, input.data).catch(mapServiceError)),

    delete: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(({ ctx, input }) => deleteCategory(ctx.db, ctx.userId, input.id)),
})
```

- [ ] **Step 3: Merge into `appRouter`**

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

- [ ] **Step 4: Verify**

```bash
pnpm --filter @contai/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add categories service and tRPC router with idempotent default seed"
```

---

## Task 21: `merchants` service + router

**Files:**
- Create: `packages/api/src/services/merchants-service.ts`, `packages/api/src/routers/merchants.ts`
- Edit: `packages/api/src/routers/_app.ts`

**Interfaces:**
- Consumes: `Database`, `protectedProcedure`, `router` (Task 18); `merchants` table from `@contai/db`.
- Produces: `listMerchants` (service); `merchantsRouter` merged as `merchants` — consumed by `section-e2-web-hooks.md` Task 21.

- [ ] **Step 1: Write `packages/api/src/services/merchants-service.ts`**

```ts
import { and, desc, eq, isNull } from 'drizzle-orm'
import { merchants } from '@contai/db'
import type { Database } from './types'

export function listMerchants(db: Database, userId: string) {
    return db
        .select()
        .from(merchants)
        .where(and(eq(merchants.userId, userId), isNull(merchants.deletedAt)))
        .orderBy(desc(merchants.usageCount))
}
```

- [ ] **Step 2: Write `packages/api/src/routers/merchants.ts`**

```ts
import { protectedProcedure, router } from '../trpc'
import { listMerchants } from '../services/merchants-service'

export const merchantsRouter = router({
    list: protectedProcedure.query(({ ctx }) => listMerchants(ctx.db, ctx.userId)),
})
```

- [ ] **Step 3: Merge into `appRouter`**

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

- [ ] **Step 4: Verify**

```bash
pnpm --filter @contai/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add merchants service and tRPC router"
```

---

## Task 22: `expenses` service (`createExpense`) + router

**Files:**
- Create: `packages/api/src/services/expenses-service.ts`, `packages/api/src/routers/expenses.ts`
- Edit: `packages/api/src/routers/_app.ts`

**Interfaces:**
- Consumes: `Database` (Task 18); `cards`, `expenses`, `expenseInstallments`, `installmentPlans`, `merchants`, `recurrences` from `@contai/db`; `generateInstallments`, `generateRecurrenceOccurrences`, `getInvoiceForExpense`, `normalizeMerchantName`, `toISODate`, `type CardCycle` from `@contai/domain`.
- Produces: `createExpenseInputSchema`/`CreateExpenseInput`, `createExpense(db, userId, input)` (the full transaction, ties invoice/installments/recurrence together); `expensesRouter` merged as `expenses` — consumed by `section-e2-web-hooks.md` Task 22.

- [ ] **Step 1: Write `packages/api/src/services/expenses-service.ts`**

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
import type { Database } from './types'

export const createExpenseInputSchema = z
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

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>

export async function createExpense(db: Database, userId: string, input: CreateExpenseInput) {
    return db.transaction(async (tx) => {
        let merchantId: string | null = null
        if (input.merchantName) {
            const normalized = normalizeMerchantName(input.merchantName)
            const [existing] = await tx
                .select()
                .from(merchants)
                .where(and(eq(merchants.normalizedName, normalized), eq(merchants.userId, userId), isNull(merchants.deletedAt)))
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
                        userId,
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
                userId,
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
                .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId), isNull(cards.deletedAt)))
                .limit(1)
            card = cardRow ?? null
        }

        if (input.type === 'installment' && input.installments) {
            const [plan] = await tx
                .insert(installmentPlans)
                .values({ expenseId: expense.id, userId, installmentsTotal: input.installments })
                .returning()

            const generatedInstallments = generateInstallments(input.amount, input.installments, input.purchaseDate, card)
            const occurrences = await tx
                .insert(expenseInstallments)
                .values(
                    generatedInstallments.map((installment) => ({
                        userId,
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
                    userId,
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
                            userId,
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
                userId,
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
}
```

Note: this function is a verbatim move of what the earlier combined tRPC doc wrote inline
as `expenses.create`'s procedure body — only the signature changed, from `(ctx, input)`
to `(db, userId, input)`, so it no longer depends on tRPC's `ctx` shape.

- [ ] **Step 2: Write `packages/api/src/routers/expenses.ts`**

```ts
import { protectedProcedure, router } from '../trpc'
import { createExpenseInputSchema, createExpense } from '../services/expenses-service'

export const expensesRouter = router({
    create: protectedProcedure
        .input(createExpenseInputSchema)
        .mutation(({ ctx, input }) => createExpense(ctx.db, ctx.userId, input)),
})
```

- [ ] **Step 3: Merge into `appRouter`**

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

- [ ] **Step 4: Verify**

```bash
pnpm --filter @contai/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add expenses service tying invoice/installments/recurrence together"
```

---

## Task 23: `occurrences` service (`list`/`update`/`delete`) + router

**Files:**
- Create: `packages/api/src/services/occurrences-service.ts`, `packages/api/src/routers/occurrences.ts`
- Edit: `packages/api/src/routers/_app.ts`

**Interfaces:**
- Consumes: `Database`, `ServiceError`, `protectedProcedure`, `router`, `mapServiceError` (Task 18); `expenseInstallments` from `@contai/db`.
- Produces: `occurrenceFiltersSchema`/`OccurrenceFilters`, `listOccurrences`/`updateOccurrence`/`deleteOccurrence` (service); `occurrencesRouter` merged as `occurrences` — consumed by `section-e2-web-hooks.md` Task 23.

- [ ] **Step 1: Write `packages/api/src/services/occurrences-service.ts`**

```ts
import { z } from 'zod'
import { and, desc, eq, gte, ilike, isNull, lte } from 'drizzle-orm'
import { expenseInstallments } from '@contai/db'
import { ServiceError } from './errors'
import type { Database } from './types'

export const occurrenceFiltersSchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    cardId: z.string().uuid().optional(),
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
})
export type OccurrenceFilters = z.infer<typeof occurrenceFiltersSchema>

export const occurrencePatchSchema = z.object({
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
    amount: z.number().positive().optional(),
    description: z.string().min(1).max(120).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    cardId: z.string().uuid().nullable().optional(),
})
export type OccurrencePatch = z.infer<typeof occurrencePatchSchema>

export const scopeSchema = z.enum(['occurrence', 'future', 'series', 'end'])
export type Scope = z.infer<typeof scopeSchema>

function scopedConditions(scope: Scope, userId: string, current: typeof expenseInstallments.$inferSelect) {
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
    throw new ServiceError('INVALID_SCOPE', 'Escopo inválido para esta ocorrência')
}

export function listOccurrences(db: Database, userId: string, filters: OccurrenceFilters) {
    const conditions = [eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)]

    if (filters.from) conditions.push(gte(expenseInstallments.occurrenceDate, filters.from))
    if (filters.to) conditions.push(lte(expenseInstallments.occurrenceDate, filters.to))
    if (filters.q) conditions.push(ilike(expenseInstallments.description, `%${filters.q}%`))
    if (filters.categoryId) conditions.push(eq(expenseInstallments.categoryId, filters.categoryId))
    if (filters.cardId) conditions.push(eq(expenseInstallments.cardId, filters.cardId))
    if (filters.status) conditions.push(eq(expenseInstallments.status, filters.status))

    return db.select().from(expenseInstallments).where(and(...conditions)).orderBy(desc(expenseInstallments.occurrenceDate))
}

async function findCurrent(db: Database, userId: string, id: string) {
    const [current] = await db
        .select()
        .from(expenseInstallments)
        .where(and(eq(expenseInstallments.id, id), eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)))
        .limit(1)

    if (!current) throw new ServiceError('NOT_FOUND', 'Ocorrência não encontrada')
    return current
}

export async function updateOccurrence(db: Database, userId: string, id: string, scope: Scope, patchInput: OccurrencePatch) {
    const patch: Partial<typeof expenseInstallments.$inferInsert> = {
        ...(patchInput.status && { status: patchInput.status }),
        ...(patchInput.amount && { amount: String(patchInput.amount) }),
        ...(patchInput.description && { description: patchInput.description }),
        ...(patchInput.categoryId !== undefined && { categoryId: patchInput.categoryId }),
        ...(patchInput.cardId !== undefined && { cardId: patchInput.cardId }),
    }

    if (scope === 'occurrence') {
        const [data] = await db
            .update(expenseInstallments)
            .set(patch)
            .where(and(eq(expenseInstallments.id, id), eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)))
            .returning()

        if (!data) throw new ServiceError('NOT_FOUND', 'Ocorrência não encontrada')
        return [data]
    }

    const current = await findCurrent(db, userId, id)
    const conditions = scopedConditions(scope, userId, current)
    return db.update(expenseInstallments).set(patch).where(and(...conditions)).returning()
}

export async function deleteOccurrence(db: Database, userId: string, id: string, scope: Scope) {
    const deletedAt = new Date()

    if (scope === 'occurrence') {
        const [deleted] = await db
            .update(expenseInstallments)
            .set({ deletedAt })
            .where(and(eq(expenseInstallments.id, id), eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)))
            .returning()

        if (!deleted) throw new ServiceError('NOT_FOUND', 'Ocorrência não encontrada')
        return { ok: true }
    }

    const current = await findCurrent(db, userId, id)
    const conditions = scopedConditions(scope, userId, current)
    await db.update(expenseInstallments).set({ deletedAt }).where(and(...conditions))
    return { ok: true }
}
```

Note: `scopedConditions` (throwing `ServiceError('INVALID_SCOPE', ...)`) and
`findCurrent` (throwing `ServiceError('NOT_FOUND', ...)`) are shared by `updateOccurrence`
and `deleteOccurrence` — same behavior as the earlier combined doc, now factored into the
service instead of duplicated across router handlers.

- [ ] **Step 2: Write `packages/api/src/routers/occurrences.ts`**

```ts
import { z } from 'zod'
import { protectedProcedure, router, mapServiceError } from '../trpc'
import {
    occurrenceFiltersSchema,
    occurrencePatchSchema,
    scopeSchema,
    listOccurrences,
    updateOccurrence,
    deleteOccurrence,
} from '../services/occurrences-service'

export const occurrencesRouter = router({
    list: protectedProcedure
        .input(occurrenceFiltersSchema)
        .query(({ ctx, input }) => listOccurrences(ctx.db, ctx.userId, input)),

    update: protectedProcedure
        .input(z.object({ id: z.string().uuid(), scope: scopeSchema, data: occurrencePatchSchema }))
        .mutation(({ ctx, input }) =>
            updateOccurrence(ctx.db, ctx.userId, input.id, input.scope, input.data).catch(mapServiceError),
        ),

    delete: protectedProcedure
        .input(z.object({ id: z.string().uuid(), scope: scopeSchema }))
        .mutation(({ ctx, input }) => deleteOccurrence(ctx.db, ctx.userId, input.id, input.scope).catch(mapServiceError)),
})
```

- [ ] **Step 3: Merge into `appRouter`**

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

- [ ] **Step 4: Verify**

```bash
pnpm --filter @contai/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add occurrences service with scoped soft-delete/edit"
```

---

## Task 24: `reports` service (`getMonthSummary`) + router

**Files:**
- Create: `packages/api/src/services/reports-service.ts`, `packages/api/src/routers/reports.ts`
- Edit: `packages/api/src/routers/_app.ts`

**Interfaces:**
- Consumes: `Database` (Task 18); `expenseInstallments` from `@contai/db`; `summarizeMonth` from `@contai/domain`.
- Produces: `getMonthSummary(db, userId, month)` (service); `reportsRouter` merged as `reports` — consumed by `section-e2-web-hooks.md` Task 24.

- [ ] **Step 1: Write `packages/api/src/services/reports-service.ts`**

```ts
import { and, eq, isNull } from 'drizzle-orm'
import { expenseInstallments } from '@contai/db'
import { summarizeMonth } from '@contai/domain'
import type { Database } from './types'

export async function getMonthSummary(db: Database, userId: string, month: string) {
    const rows = await db
        .select({
            amount: expenseInstallments.amount,
            category_id: expenseInstallments.categoryId,
            card_id: expenseInstallments.cardId,
            status: expenseInstallments.status,
        })
        .from(expenseInstallments)
        .where(and(eq(expenseInstallments.userId, userId), eq(expenseInstallments.invoiceMonth, month), isNull(expenseInstallments.deletedAt)))

    const formattedRows = rows.map((r) => ({
        amount: Number(r.amount),
        category_id: r.category_id,
        card_id: r.card_id,
        status: r.status,
    }))

    return summarizeMonth(formattedRows)
}
```

- [ ] **Step 2: Write `packages/api/src/routers/reports.ts`**

```ts
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'
import { getMonthSummary } from '../services/reports-service'

export const reportsRouter = router({
    summary: protectedProcedure
        .input(z.object({ month: z.string() }))
        .query(({ ctx, input }) => getMonthSummary(ctx.db, ctx.userId, input.month)),
})
```

- [ ] **Step 3: Final merge into `appRouter`**

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

- [ ] **Step 4: Verify**

```bash
pnpm turbo run typecheck lint test
```

Run the full battery once all of Tasks 18-24 in this doc are done. Full manual/browser
verification of every procedure happens in `section-e2-web-hooks.md` once its hooks exist
— see that doc's Tasks 19-24 for the per-resource manual test steps and its Task 24 Step 5
for the combined `pnpm --filter web build` check.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add reports service (monthly summary) and tRPC router"
```
