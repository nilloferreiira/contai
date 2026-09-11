# Bolso MVP Implementation Plan — Section E: API + hooks

> **Superseded:** rewritten as tRPC procedures in
> [`section-e-api-trpc.md`](./section-e-api-trpc.md), per
> `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.
> Kept below for historical reference — the REST routes described here were
> never built.

> Part of the full plan. Master checklist and progress tracking: `../2026-09-09-bolso-mvp-implementation.md`. Shared context below is duplicated from that file so this section can be worked on standalone.

**Goal:** Build the Bolso MVP — a mobile-first personal finance manager where a user registers an expense in under 15 seconds via a deterministic natural-language parser, backed by Next.js, PostgreSQL, Drizzle ORM, and Better Auth.

**Architecture:** Next.js App Router with Server Components by default; PostgreSQL for persistence via Drizzle ORM (using `postgres.js`); Better Auth with JWT plugin for session management and token verification (JWKS-backed session cookie cache); a DB-free pure domain layer (`src/lib/finance/`) handling invoice/installment/recurrence/parser math, unit-tested with vitest; thin API routes (`auth → zod → execute → JSON`) that call the domain layer and Drizzle ORM; React Query on the client for cache/mutations; shadcn/ui + tailwind-variants for components.

**Tech Stack:** Next.js 16+ (TS strict), pnpm, shadcn/ui, Better Auth (`better-auth`), Drizzle ORM (`drizzle-orm`, `drizzle-kit`), PostgreSQL driver (`postgres`), `@tanstack/react-query` v5, zod, react-hook-form, Tailwind v4, tailwind-variants, tailwind-merge, lucide-react, sonner, date-fns, vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`

## Global Constraints

- Files: lowercase-with-hyphens (`user-card.tsx`, `use-modal.ts`).
- Always named exports, never `export default` — except `page.tsx`, `layout.tsx`, and `route.ts` handlers (`GET`/`POST`/`PATCH`/`DELETE`), which Next.js requires.
- No barrel files (`index.ts`) for internal folders (except `src/db/schema/index.ts` where Drizzle collects tables/relations).
- Every UI component: `className={twMerge('base-classes', className)}`, `data-slot="<name>"` on the root element, state via `data-disabled={disabled ? '' : undefined}` (not boolean className logic), `{...props}` spread last, icon-only buttons need `aria-label`, icons use explicit `size-*` classes.
- No hardcoded colors (`text-white`, `bg-[#hex]`) — only the tokens in `globals.css` (`bg-surface`, `text-foreground`, `border-border`, etc.).
- TypeScript: never `React.FC`, never `any`; type-only imports (`import type { ComponentProps } from 'react'`); component props extend `ComponentProps<'tag'>` (+ `VariantProps<typeof xVariants>` when the component has variants).
- Every API route under `src/app/api/*`: authenticate via Better Auth (`const session = await auth.api.getSession({ headers: await headers() })`) and return `401` if no user, `safeParse` the body with a zod schema and return `422` with `error.flatten()` on failure — never trust a client-supplied `user_id`. Always query using `session.user.id`.
- Soft deletes only. `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, and `expense_installments` all have `deleted_at`. `DELETE` route handlers never call `.delete()` on these tables — they call `.update({ deletedAt: new Date() })`. Every query explicitly filters `and(eq(table.userId, session.user.id), isNull(table.deletedAt))`.
- `expense_installments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/db/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

---

## Section E: API + hooks

### Task 18: `api-client.ts`, `query-keys.ts`, zod schemas

**Files:**
- Create: `src/lib/api-client.ts`
- Create: `src/lib/query-keys.ts`
- Create: `src/lib/schemas/expense-schema.ts`
- Create: `src/lib/schemas/card-schema.ts`
- Create: `src/lib/schemas/category-schema.ts`
- Create: `src/lib/schemas/CLAUDE.md`

**Interfaces:**
- Consumes: `zod` (Task 1)
- Produces: `apiClient.get/post/patch/delete(path, body?): Promise<T>` (throws `ApiError` with a `.message` on non-2xx), `queryKeys.*`, `createExpenseSchema`/`CreateExpenseInput`, `createCardSchema`/`CreateCardInput`, `createCategorySchema`/`CreateCategoryInput` — consumed by every task in Sections E (routes/hooks) and F (forms).

- [ ] **Step 1: Write `src/lib/api-client.ts`**

```ts
export class ApiError extends Error {
    status: number
    issues?: unknown

    constructor(message: string, status: number, issues?: unknown) {
        super(message)
        this.status = status
        this.issues = issues
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
    })

    const body = await response.json().catch(() => null)

    if (!response.ok) {
        throw new ApiError(body?.error ?? 'Erro inesperado', response.status, body?.issues)
    }

    return body as T
}

export const apiClient = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
```

- [ ] **Step 2: Write `src/lib/query-keys.ts`**

```ts
export interface OccurrenceFilters {
    from?: string
    to?: string
    q?: string
    categoryId?: string
    cardId?: string
    type?: string
    status?: string
}

export const queryKeys = {
    cards: ['cards'] as const,
    categories: ['categories'] as const,
    merchants: ['merchants'] as const,
    occurrences: (filters: OccurrenceFilters) => ['occurrences', filters] as const,
    summary: (month: string) => ['summary', month] as const,
}
```

- [ ] **Step 3: Write `src/lib/schemas/card-schema.ts`**

```ts
import { z } from 'zod'

export const createCardSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    closing_day: z.number().int().min(1).max(31),
    due_day: z.number().int().min(1).max(31),
    credit_limit: z.number().positive().nullable().optional(),
    color: z.string().min(1),
})

export type CreateCardInput = z.infer<typeof createCardSchema>

export const updateCardSchema = createCardSchema.partial().extend({ active: z.boolean().optional() })
export type UpdateCardInput = z.infer<typeof updateCardSchema>
```

- [ ] **Step 4: Write `src/lib/schemas/category-schema.ts`**

```ts
import { z } from 'zod'

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    icon: z.string().max(40).nullable().optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = createCategorySchema.partial()
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
```

- [ ] **Step 5: Write `src/lib/schemas/expense-schema.ts`**

```ts
import { z } from 'zod'

export const createExpenseSchema = z
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

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
```

- [ ] **Step 6: Write `src/lib/schemas/CLAUDE.md`**

```markdown
# src/lib/schemas

Zod schemas shared between `react-hook-form` resolvers (client) and API
route validation (server) — one schema per resource, `create*Schema` +
inferred `Create*Input` type, `update*Schema` as `.partial()` of the
create schema where PATCH is supported.
```

- [ ] **Step 7: Verify**

```bash
pnpm build
```

Expected: succeeds (no runtime behavior yet, just typechecking).

- [ ] **Step 8: Commit**

```bash
git add src/lib/api-client.ts src/lib/query-keys.ts src/lib/schemas
git commit -m "feat: add API client, query keys, and card/category/expense schemas"
```

---

### Task 19: `/api/cards` + `/api/cards/[id]` + `use-cards.ts`

**Files:**
- Create: `src/app/api/cards/route.ts`
- Create: `src/app/api/cards/[id]/route.ts`
- Create: `src/hooks/use-cards.ts`
- Create: `src/app/api/CLAUDE.md`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`, `db` from `src/db/index.ts` (Task 5); `createCardSchema`/`updateCardSchema` (Task 18); `apiClient`, `queryKeys` (Task 18)
- Produces: `useCards()`, `useCreateCard()`, `useUpdateCard()`, `useDeleteCard()` — consumed by Task 27 (card form) and Task 35 (`/ajustes`).

- [ ] **Step 1: Write `src/app/api/cards/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { cards } from '@/db/schema'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { createCardSchema } from '@/lib/schemas/card-schema'

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const data = await db
        .select()
        .from(cards)
        .where(and(eq(cards.userId, session.user.id), eq(cards.active, true), isNull(cards.deletedAt)))
        .orderBy(asc(cards.createdAt))

    return NextResponse.json(data)
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = createCardSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const [data] = await db
        .insert(cards)
        .values({
            userId: session.user.id,
            name: parsed.data.name,
            closingDay: parsed.data.closing_day,
            dueDay: parsed.data.due_day,
            creditLimit: parsed.data.credit_limit != null ? String(parsed.data.credit_limit) : null,
            color: parsed.data.color,
        })
        .returning()

    return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/cards/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { cards } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { updateCardSchema } from '@/lib/schemas/card-schema'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = updateCardSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const updateData: Partial<typeof cards.$inferInsert> = {}
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.closing_day !== undefined) updateData.closingDay = parsed.data.closing_day
    if (parsed.data.due_day !== undefined) updateData.dueDay = parsed.data.due_day
    if (parsed.data.credit_limit !== undefined) updateData.creditLimit = parsed.data.credit_limit != null ? String(parsed.data.credit_limit) : null
    if (parsed.data.color !== undefined) updateData.color = parsed.data.color
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active

    const [data] = await db
        .update(cards)
        .set(updateData)
        .where(and(eq(cards.id, id), eq(cards.userId, session.user.id), isNull(cards.deletedAt)))
        .returning()

    if (!data) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 })
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    await db
        .update(cards)
        .set({ deletedAt: new Date() })
        .where(and(eq(cards.id, id), eq(cards.userId, session.user.id), isNull(cards.deletedAt)))

    return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/hooks/use-cards.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { CreateCardInput, UpdateCardInput } from '@/lib/schemas/card-schema'

export interface Card {
    id: string
    name: string
    closing_day: number
    due_day: number
    credit_limit: number | null
    color: string | null
    active: boolean
}

export function useCards() {
    return useQuery({ queryKey: queryKeys.cards, queryFn: () => apiClient.get<Card[]>('/api/cards') })
}

export function useCreateCard() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateCardInput) => apiClient.post<Card>('/api/cards', input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cards })
            toast.success('Cartão criado')
        },
        onError: (error) => toast.error(error.message),
    })
}

export function useUpdateCard() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateCardInput }) => apiClient.patch<Card>(`/api/cards/${id}`, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cards })
            toast.success('Cartão atualizado')
        },
        onError: (error) => toast.error(error.message),
    })
}

export function useDeleteCard() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => apiClient.delete(`/api/cards/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cards })
            toast.success('Cartão removido')
        },
        onError: (error) => toast.error(error.message),
    })
}
```

- [ ] **Step 4: Write `src/app/api/CLAUDE.md`**

```markdown
# src/app/api

Route handlers only — no business logic beyond auth → zod validate →
call Drizzle ORM (`db`) / `src/lib/finance` → respond JSON. Every handler
authenticates with `auth.api.getSession({ headers: await headers() })` and
returns 401 if absent. Queries always scope by `userId` and `isNull(deletedAt)`.
Named exports `GET`/`POST`/`PATCH`/`DELETE`.
```

- [ ] **Step 5: Verify manually**

```bash
pnpm dev
```

Log in via the browser, then in the browser devtools console run:

```js
fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Nubank', closing_day: 10, due_day: 20, color: '#8A2BE2' }) }).then(r => r.json()).then(console.log)
```

Confirm a 201 with the created row, then `fetch('/api/cards').then(r => r.json()).then(console.log)` returns it in a list. Test the 401 path by running the same `fetch` in an incognito tab with no session — confirm `401`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cards src/hooks/use-cards.ts src/app/api/CLAUDE.md
git commit -m "feat: add cards API routes and use-cards hook"
```

---

### Task 20: `/api/categories` (idempotent seed) + `use-categories.ts`

**Files:**
- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/categories/[id]/route.ts`
- Create: `src/hooks/use-categories.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`, `db` from `src/db/index.ts` (Task 5); `createCategorySchema`/`updateCategorySchema` (Task 18); `apiClient`, `queryKeys` (Task 18)
- Produces: `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` — consumed by Task 26 (quick-add / parser context) and Task 35 (`/ajustes`).

- [ ] **Step 1: Write `src/app/api/categories/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { createCategorySchema } from '@/lib/schemas/category-schema'

const DEFAULT_CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Compras', 'Outros']

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const existing = await db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, session.user.id), isNull(categories.deletedAt)))
        .orderBy(asc(categories.name))

    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))
    const missing = DEFAULT_CATEGORIES.filter((name) => !existingNames.has(name.toLowerCase()))

    if (missing.length === 0) {
        return NextResponse.json(existing)
    }

    const inserted = await db
        .insert(categories)
        .values(missing.map((name) => ({ name, userId: session.user.id })))
        .returning()

    return NextResponse.json([...existing, ...inserted].sort((a, b) => a.name.localeCompare(b.name)))
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = createCategorySchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    try {
        const [data] = await db
            .insert(categories)
            .values({
                name: parsed.data.name,
                icon: parsed.data.icon,
                userId: session.user.id,
            })
            .returning()

        return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
        if (error?.code === '23505') {
            return NextResponse.json({ error: 'Categoria já existe' }, { status: 409 })
        }
        return NextResponse.json({ error: error?.message || 'Erro ao criar categoria' }, { status: 500 })
    }
}
```

- [ ] **Step 2: Write `src/app/api/categories/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { updateCategorySchema } from '@/lib/schemas/category-schema'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = updateCategorySchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const [data] = await db
        .update(categories)
        .set(parsed.data)
        .where(and(eq(categories.id, id), eq(categories.userId, session.user.id), isNull(categories.deletedAt)))
        .returning()

    if (!data) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    await db
        .update(categories)
        .set({ deletedAt: new Date() })
        .where(and(eq(categories.id, id), eq(categories.userId, session.user.id), isNull(categories.deletedAt)))

    return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/hooks/use-categories.ts` with single-flight seed guard**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { CreateCategoryInput, UpdateCategoryInput } from '@/lib/schemas/category-schema'

export interface Category {
    id: string
    name: string
    icon: string | null
}

let seedInFlight: Promise<Category[]> | null = null

function fetchCategoriesSingleFlight() {
    if (!seedInFlight) {
        seedInFlight = apiClient.get<Category[]>('/api/categories').finally(() => {
            seedInFlight = null
        })
    }
    return seedInFlight
}

export function useCategories() {
    return useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategoriesSingleFlight })
}

export function useCreateCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateCategoryInput) => apiClient.post<Category>('/api/categories', input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories })
            toast.success('Categoria criada')
        },
        onError: (error) => toast.error(error.message),
    })
}

export function useUpdateCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
            apiClient.patch<Category>(`/api/categories/${id}`, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories })
            toast.success('Categoria atualizada')
        },
        onError: (error) => toast.error(error.message),
    })
}

export function useDeleteCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => apiClient.delete(`/api/categories/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories })
            toast.success('Categoria removida')
        },
        onError: (error) => toast.error(error.message),
    })
}
```

- [ ] **Step 4: Verify manually**

```bash
pnpm dev
```

In the browser console (logged in), call `fetch('/api/categories').then(r => r.json()).then(console.log)` twice in a row — confirm the 7 defaults are seeded once and the second call returns the same 7 without duplicates (check the database or Drizzle Studio `pnpm drizzle-kit studio` to be sure `categories_user_name_unique` was never violated).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/categories src/hooks/use-categories.ts
git commit -m "feat: add categories API with idempotent default seed"
```

---

### Task 21: `/api/merchants` + `use-merchants.ts`

**Files:**
- Create: `src/app/api/merchants/route.ts`
- Create: `src/hooks/use-merchants.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`, `db` from `src/db/index.ts` (Task 5)
- Produces: `useMerchants()` returning merchants ordered by `usage_count` desc — consumed by Task 16's `ParserContext` wiring inside Task 26 (`quick-add.tsx`).

- [ ] **Step 1: Write `src/app/api/merchants/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { merchants } from '@/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const data = await db
        .select()
        .from(merchants)
        .where(and(eq(merchants.userId, session.user.id), isNull(merchants.deletedAt)))
        .orderBy(desc(merchants.usageCount))

    return NextResponse.json(data)
}
```

- [ ] **Step 2: Write `src/hooks/use-merchants.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Merchant {
    id: string
    normalized_name: string
    display_name: string
    default_category_id: string | null
    default_card_id: string | null
    usage_count: number
}

export function useMerchants() {
    return useQuery({ queryKey: queryKeys.merchants, queryFn: () => apiClient.get<Merchant[]>('/api/merchants') })
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

`fetch('/api/merchants').then(r => r.json()).then(console.log)` in the browser console — confirm `[]` (empty, since no expense created yet) and no 500.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/merchants src/hooks/use-merchants.ts
git commit -m "feat: add merchants API route and hook"
```

---

### Task 22: `/api/expenses` POST + `use-create-expense.ts`

**Files:**
- Create: `src/app/api/expenses/route.ts`
- Create: `src/hooks/use-create-expense.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (Task 5); `db` from `@/db` (Task 6); `createExpenseSchema` (Task 18); `getInvoiceForExpense` (Task 11); `generateInstallments` (Task 12); `generateRecurrenceOccurrences` (Task 13); `normalizeMerchantName` (Task 14)
- Produces: `createExpenseWithOccurrences(userId, input): Promise<{ expense: object; occurrences: object[] }>` (exported for potential reuse) and `useCreateExpense()` — consumed by Task 26 (quick-add) and Task 27 (manual dialog).

- [ ] **Step 1: Write `src/app/api/expenses/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { cards, expenses, expenseInstallments, installmentPlans, merchants, recurrences } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { createExpenseSchema, type CreateExpenseInput } from '@/lib/schemas/expense-schema'
import { getInvoiceForExpense, type CardCycle } from '@/lib/finance/invoice'
import { generateInstallments } from '@/lib/finance/installments'
import { generateRecurrenceOccurrences } from '@/lib/finance/recurrence'
import { normalizeMerchantName } from '@/lib/finance/merchants'
import { toISODate } from '@/lib/finance/date'

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = createExpenseSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const result = await createExpenseWithOccurrences(session.user.id, parsed.data)
    return NextResponse.json(result, { status: 201 })
}

export async function createExpenseWithOccurrences(
    userId: string,
    input: CreateExpenseInput,
) {
    return await db.transaction(async (tx) => {
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
                .values({
                    expenseId: expense.id,
                    userId,
                    installmentsTotal: input.installments,
                })
                .returning()

            const installments = generateInstallments(input.amount, input.installments, input.purchaseDate, card)
            const occurrences = await tx
                .insert(expenseInstallments)
                .values(
                    installments.map((installment) => ({
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
                    }))
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
                    })
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

- [ ] **Step 2: Write `src/hooks/use-create-expense.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { CreateExpenseInput } from '@/lib/schemas/expense-schema'

export function useCreateExpense() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateExpenseInput) => apiClient.post('/api/expenses', input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occurrences'] })
            queryClient.invalidateQueries({ queryKey: ['summary'] })
            queryClient.invalidateQueries({ queryKey: queryKeys.merchants })
            toast.success('Despesa registrada')
        },
        onError: (error) => toast.error(error.message),
    })
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Test all three branches via the browser console (logged in):
1. Single: `{ amount: 50, description: 'mercado', purchaseDate: '2026-09-09', type: 'single' }` → confirm 1 row in `expense_installments`.
2. Installment: same payload + `type: 'installment', installments: 3` → confirm 3 rows with `installment_number` 1-3 and `occurrence_date`s one calendar month apart.
3. Recurring: `type: 'recurring', frequency: 'monthly'` → confirm 12 rows one month apart, including the start date.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/expenses src/hooks/use-create-expense.ts
git commit -m "feat: add expenses API tying invoice/installments/recurrence together"
```

---

### Task 23: `/api/occurrences` + `/api/occurrences/[id]` + `use-occurrences.ts`

**Files:**
- Create: `src/app/api/occurrences/route.ts`
- Create: `src/app/api/occurrences/[id]/route.ts`
- Create: `src/hooks/use-occurrences.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (Task 5); `db` from `@/db` (Task 6); `OccurrenceFilters` type (Task 18)
- Produces: `useOccurrences(filters)`, `useUpdateOccurrence()`, `useDeleteOccurrence()` — consumed by Task 28 (`occurrence-list.tsx`) and Task 29 (`occurrence-sheet.tsx`).

- [ ] **Step 1: Write `src/app/api/occurrences/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { expenseInstallments } from '@/db/schema'
import { and, desc, eq, ilike, isNull, gte, lte } from 'drizzle-orm'

export async function GET(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
    const categoryId = url.searchParams.get('categoryId')
    const cardId = url.searchParams.get('cardId')
    const status = url.searchParams.get('status') as 'pending' | 'paid' | 'cancelled' | null

    const conditions = [
        eq(expenseInstallments.userId, session.user.id),
        isNull(expenseInstallments.deletedAt),
    ]

    if (from) conditions.push(gte(expenseInstallments.occurrenceDate, from))
    if (to) conditions.push(lte(expenseInstallments.occurrenceDate, to))
    if (q) conditions.push(ilike(expenseInstallments.description, `%${q}%`))
    if (categoryId) conditions.push(eq(expenseInstallments.categoryId, categoryId))
    if (cardId) conditions.push(eq(expenseInstallments.cardId, cardId))
    if (status) conditions.push(eq(expenseInstallments.status, status))

    const data = await db
        .select()
        .from(expenseInstallments)
        .where(and(...conditions))
        .orderBy(desc(expenseInstallments.occurrenceDate))

    return NextResponse.json(data)
}
```

- [ ] **Step 2: Write `src/app/api/occurrences/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { expenseInstallments } from '@/db/schema'
import { and, eq, gte, isNull } from 'drizzle-orm'

const patchSchema = z.object({
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
    amount: z.number().positive().optional(),
    description: z.string().min(1).max(120).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    cardId: z.string().uuid().nullable().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'occurrence'

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const patch: Partial<typeof expenseInstallments.$inferInsert> = {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.amount && { amount: String(parsed.data.amount) }),
        ...(parsed.data.description && { description: parsed.data.description }),
        ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
        ...(parsed.data.cardId !== undefined && { cardId: parsed.data.cardId }),
    }

    if (scope === 'occurrence') {
        const [data] = await db
            .update(expenseInstallments)
            .set(patch)
            .where(
                and(
                    eq(expenseInstallments.id, id),
                    eq(expenseInstallments.userId, session.user.id),
                    isNull(expenseInstallments.deletedAt),
                )
            )
            .returning()

        if (!data) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })
        return NextResponse.json(data)
    }

    const [current] = await db
        .select()
        .from(expenseInstallments)
        .where(
            and(
                eq(expenseInstallments.id, id),
                eq(expenseInstallments.userId, session.user.id),
                isNull(expenseInstallments.deletedAt),
            )
        )
        .limit(1)

    if (!current) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })

    const conditions = [
        eq(expenseInstallments.userId, session.user.id),
        isNull(expenseInstallments.deletedAt),
    ]

    if (scope === 'future' && current.installmentPlanId) {
        conditions.push(
            eq(expenseInstallments.installmentPlanId, current.installmentPlanId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
    } else if (scope === 'series' && current.recurrenceId) {
        conditions.push(eq(expenseInstallments.recurrenceId, current.recurrenceId))
    } else if (scope === 'end' && current.recurrenceId) {
        conditions.push(
            eq(expenseInstallments.recurrenceId, current.recurrenceId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
    } else {
        return NextResponse.json({ error: 'Escopo inválido para esta ocorrência' }, { status: 422 })
    }

    const data = await db
        .update(expenseInstallments)
        .set(patch)
        .where(and(...conditions))
        .returning()

    return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'occurrence'

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const deletedAt = new Date()

    if (scope === 'occurrence') {
        const [deleted] = await db
            .update(expenseInstallments)
            .set({ deletedAt })
            .where(
                and(
                    eq(expenseInstallments.id, id),
                    eq(expenseInstallments.userId, session.user.id),
                    isNull(expenseInstallments.deletedAt),
                )
            )
            .returning()

        if (!deleted) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })
        return NextResponse.json({ ok: true })
    }

    const [current] = await db
        .select()
        .from(expenseInstallments)
        .where(
            and(
                eq(expenseInstallments.id, id),
                eq(expenseInstallments.userId, session.user.id),
                isNull(expenseInstallments.deletedAt),
            )
        )
        .limit(1)

    if (!current) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })

    const conditions = [
        eq(expenseInstallments.userId, session.user.id),
        isNull(expenseInstallments.deletedAt),
    ]

    if (scope === 'future' && current.installmentPlanId) {
        conditions.push(
            eq(expenseInstallments.installmentPlanId, current.installmentPlanId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
    } else if (scope === 'series' && current.recurrenceId) {
        conditions.push(eq(expenseInstallments.recurrenceId, current.recurrenceId))
    } else if (scope === 'end' && current.recurrenceId) {
        conditions.push(
            eq(expenseInstallments.recurrenceId, current.recurrenceId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
    } else {
        return NextResponse.json({ error: 'Escopo inválido para esta ocorrência' }, { status: 422 })
    }

    await db
        .update(expenseInstallments)
        .set({ deletedAt })
        .where(and(...conditions))

    return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/hooks/use-occurrences.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { queryKeys, type OccurrenceFilters } from '@/lib/query-keys'

export interface OccurrenceRow {
    id: string
    description: string
    amount: number
    occurrence_date: string
    due_date: string
    invoice_month: string
    status: 'pending' | 'paid' | 'cancelled'
    category_id: string | null
    card_id: string | null
    installment_number: number | null
    installments_total: number | null
    installment_plan_id: string | null
    recurrence_id: string | null
}

export function useOccurrences(filters: OccurrenceFilters) {
    const params = new URLSearchParams(filters as Record<string, string>)
    return useQuery({
        queryKey: queryKeys.occurrences(filters),
        queryFn: () => apiClient.get<OccurrenceRow[]>(`/api/occurrences?${params.toString()}`),
    })
}

export function useUpdateOccurrence() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, scope, input }: { id: string; scope: string; input: Partial<OccurrenceRow> }) =>
            apiClient.patch(`/api/occurrences/${id}?scope=${scope}`, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occurrences'] })
            queryClient.invalidateQueries({ queryKey: ['summary'] })
            toast.success('Ocorrência atualizada')
        },
        onError: (error) => toast.error(error.message),
    })
}

export function useDeleteOccurrence() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, scope }: { id: string; scope: string }) => apiClient.delete(`/api/occurrences/${id}?scope=${scope}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occurrences'] })
            queryClient.invalidateQueries({ queryKey: ['summary'] })
            toast.success('Ocorrência removida')
        },
        onError: (error) => toast.error(error.message),
    })
}
```

- [ ] **Step 4: Verify manually**

```bash
pnpm dev
```

Reuse the installment expense created in Task 22's verification. `fetch('/api/occurrences?status=pending')` — confirm all 3 rows. `PATCH /api/occurrences/<id-of-2nd>?scope=future` with `{ status: 'paid' }` — confirm installments 2 and 3 flip to paid, installment 1 stays pending. Then `fetch('/api/occurrences/<id-of-2nd>?scope=occurrence', { method: 'DELETE' })` and confirm it disappears from `GET /api/occurrences`, but in the database the row is still present in `expense_installments` with `deleted_at` set (a real row, not gone) — confirming the delete was soft.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/occurrences src/hooks/use-occurrences.ts
git commit -m "feat: add occurrences API with scoped soft-delete/edit"
```

---

### Task 24: `/api/reports/summary`

**Files:**
- Create: `src/app/api/reports/summary/route.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (Task 5); `db` from `@/db` (Task 6); `summarizeMonth` (Task 17)
- Produces: `GET /api/reports/summary?month=YYYY-MM` → `{ total, byCategory, byCard }` — consumed by Task 34 (`/relatorios`).

- [ ] **Step 1: Write `src/app/api/reports/summary/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { expenseInstallments } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { summarizeMonth } from '@/lib/finance/dashboard'

export async function GET(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const url = new URL(request.url)
    const month = url.searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'Informe o mês' }, { status: 422 })

    const rows = await db
        .select({
            amount: expenseInstallments.amount,
            category_id: expenseInstallments.categoryId,
            card_id: expenseInstallments.cardId,
            status: expenseInstallments.status,
        })
        .from(expenseInstallments)
        .where(
            and(
                eq(expenseInstallments.userId, session.user.id),
                eq(expenseInstallments.invoiceMonth, month),
                isNull(expenseInstallments.deletedAt),
            )
        )

    const formattedRows = rows.map((r) => ({
        amount: Number(r.amount),
        category_id: r.category_id,
        card_id: r.card_id,
        status: r.status,
    }))

    return NextResponse.json(summarizeMonth(formattedRows))
}
```

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```

`fetch('/api/reports/summary?month=2026-09').then(r => r.json()).then(console.log)` — confirm the shape matches `summarizeMonth`'s return type and totals match what was created in Task 22's verification.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reports
git commit -m "feat: add monthly summary report route"
```

