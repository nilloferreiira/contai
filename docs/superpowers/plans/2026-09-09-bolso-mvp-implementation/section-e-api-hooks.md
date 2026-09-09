# Bolso MVP Implementation Plan — Section E: API + hooks

> Part of the full plan. Master checklist and progress tracking: `../2026-09-09-bolso-mvp-implementation.md`. Shared context below is duplicated from that file so this section can be worked on standalone.

**Goal:** Build the Bolso MVP — a mobile-first personal finance manager where a user registers an expense in under 15 seconds via a deterministic natural-language parser, backed by Next.js + Supabase.

**Architecture:** Next.js App Router with Server Components by default; Supabase for Postgres+Auth with per-user RLS; a DB-free pure domain layer (`src/lib/finance/`) handling invoice/installment/recurrence/parser math, unit-tested with vitest; thin API routes (`auth → zod → execute → JSON`) that call the domain layer and Supabase; React Query on the client for cache/mutations; shadcn/ui + tailwind-variants for components.

**Tech Stack:** Next.js 15+ (TS strict), pnpm, shadcn/ui, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `@tanstack/react-query` v5, zod, react-hook-form, Tailwind v4, tailwind-variants, tailwind-merge, lucide-react, sonner, date-fns, vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`

## Global Constraints

- Files: lowercase-with-hyphens (`user-card.tsx`, `use-modal.ts`).
- Always named exports, never `export default` — except `page.tsx`, `layout.tsx`, and `route.ts` handlers (`GET`/`POST`/`PATCH`/`DELETE`), which Next.js requires.
- No barrel files (`index.ts`) for internal folders.
- Every UI component: `className={twMerge('base-classes', className)}`, `data-slot="<name>"` on the root element, state via `data-disabled={disabled ? '' : undefined}` (not boolean className logic), `{...props}` spread last, icon-only buttons need `aria-label`, icons use explicit `size-*` classes.
- No hardcoded colors (`text-white`, `bg-[#hex]`) — only the tokens in `globals.css` (`bg-surface`, `text-foreground`, `border-border`, etc.).
- TypeScript: never `React.FC`, never `any`; type-only imports (`import type { ComponentProps } from 'react'`); component props extend `ComponentProps<'tag'>` (+ `VariantProps<typeof xVariants>` when the component has variants).
- Every API route under `src/app/api/*`: call `supabase.auth.getUser()` and return `401` if no user, `safeParse` the body with a zod schema and return `422` with `error.flatten()` on failure — never trust a client-supplied `user_id`.
- `expense_installments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Soft deletes only. `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, and `expense_installments` all have `deleted_at`. `DELETE` route handlers never call `.delete()` on these tables — they call `.update({ deleted_at: new Date().toISOString() })`. RLS already excludes `deleted_at is not null` rows, but every `select`/`update` against these tables still adds an explicit `.is('deleted_at', null)` (or, for a lookup already scoped `.eq('id', id)`, the same filter chained on) — RLS is defense in depth, not a reason to drop the app-level filter.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/lib/supabase/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

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
- Consumes: `createClient` from `src/lib/supabase/server.ts` (Task 5); `createCardSchema`/`updateCardSchema` (Task 18); `apiClient`, `queryKeys` (Task 18)
- Produces: `useCards()`, `useCreateCard()`, `useUpdateCard()`, `useDeleteCard()` — consumed by Task 27 (card form) and Task 35 (`/ajustes`).

- [ ] **Step 1: Write `src/app/api/cards/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCardSchema } from '@/lib/schemas/card-schema'

export async function GET() {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = createCardSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const { data, error } = await supabase
        .from('cards')
        .insert({ ...parsed.data, user_id: auth.user.id })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/cards/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateCardSchema } from '@/lib/schemas/card-schema'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = updateCardSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const { data, error } = await supabase
        .from('cards')
        .update(parsed.data)
        .eq('id', id)
        .is('deleted_at', null)
        .select('*')
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { error } = await supabase
        .from('cards')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
call Supabase / `src/lib/finance` → respond JSON. Every handler starts
with `supabase.auth.getUser()` and returns 401 if absent; RLS is defense
in depth, not the only check. Named exports `GET`/`POST`/`PATCH`/`DELETE`
(Next.js requirement — the one exception to "no default export" doesn't
apply here since these are already named).
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
- Consumes: `createClient` (Task 5); `createCategorySchema`/`updateCategorySchema` (Task 18); `normalizeMerchantName`-style normalization reused inline (Task 14 covers merchants specifically — categories seed normalizes with the same `lower()`+accent-strip approach at the SQL level via the unique index, so app-level normalization here just needs `.toLowerCase().trim()` before comparing against existing names)
- Produces: `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` — consumed by Task 26 (quick-add / parser context) and Task 35 (`/ajustes`).

- [ ] **Step 1: Write `src/app/api/categories/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCategorySchema } from '@/lib/schemas/category-schema'

const DEFAULT_CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Compras', 'Outros']

export async function GET() {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: existing, error } = await supabase.from('categories').select('*').is('deleted_at', null).order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))
    const missing = DEFAULT_CATEGORIES.filter((name) => !existingNames.has(name.toLowerCase()))

    if (missing.length === 0) {
        return NextResponse.json(existing)
    }

    const { data: inserted, error: insertError } = await supabase
        .from('categories')
        .insert(missing.map((name) => ({ name, user_id: auth.user.id })))
        .select('*')

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json([...existing, ...(inserted ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = createCategorySchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const { data, error } = await supabase
        .from('categories')
        .insert({ ...parsed.data, user_id: auth.user.id })
        .select('*')
        .single()

    if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Categoria já existe' }, { status: 409 })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/categories/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateCategorySchema } from '@/lib/schemas/category-schema'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = updateCategorySchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const { data, error } = await supabase
        .from('categories')
        .update(parsed.data)
        .eq('id', id)
        .is('deleted_at', null)
        .select('*')
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { error } = await supabase
        .from('categories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

In the browser console (logged in), call `fetch('/api/categories').then(r => r.json()).then(console.log)` twice in a row — confirm the 7 defaults are seeded once and the second call returns the same 7 without duplicates (check the Supabase table editor to be sure `categories_user_name_unique` was never violated).

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
- Consumes: `createClient` (Task 5)
- Produces: `useMerchants()` returning merchants ordered by `usage_count` desc — consumed by Task 16's `ParserContext` wiring inside Task 26 (`quick-add.tsx`).

- [ ] **Step 1: Write `src/app/api/merchants/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .is('deleted_at', null)
        .order('usage_count', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
- Consumes: `createClient` (Task 5); `createExpenseSchema` (Task 18); `getInvoiceForExpense` (Task 11); `generateInstallments` (Task 12); `generateRecurrenceOccurrences` (Task 13); `normalizeMerchantName` (Task 14)
- Produces: `createExpenseWithOccurrences(supabase, userId, input): Promise<{ expense: object; occurrences: object[] }>` (exported for potential reuse) and `useCreateExpense()` — consumed by Task 26 (quick-add) and Task 27 (manual dialog).

- [ ] **Step 1: Write `src/app/api/expenses/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createExpenseSchema, type CreateExpenseInput } from '@/lib/schemas/expense-schema'
import { getInvoiceForExpense, type CardCycle } from '@/lib/finance/invoice'
import { generateInstallments } from '@/lib/finance/installments'
import { generateRecurrenceOccurrences } from '@/lib/finance/recurrence'
import { normalizeMerchantName } from '@/lib/finance/merchants'
import { toISODate } from '@/lib/finance/date'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = createExpenseSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const result = await createExpenseWithOccurrences(supabase, auth.user.id, parsed.data)
    return NextResponse.json(result, { status: 201 })
}

export async function createExpenseWithOccurrences(
    supabase: SupabaseClient,
    userId: string,
    input: CreateExpenseInput,
) {
    let merchantId: string | null = null
    if (input.merchantName) {
        const normalized = normalizeMerchantName(input.merchantName)
        const { data: existing } = await supabase
            .from('merchants')
            .select('*')
            .eq('normalized_name', normalized)
            .is('deleted_at', null)
            .maybeSingle()

        if (existing) {
            merchantId = existing.id
            await supabase.from('merchants').update({ usage_count: existing.usage_count + 1 }).eq('id', existing.id)
        } else {
            const { data: created } = await supabase
                .from('merchants')
                .insert({
                    user_id: userId,
                    normalized_name: normalized,
                    display_name: input.merchantName,
                    default_category_id: input.categoryId ?? null,
                    default_card_id: input.cardId ?? null,
                    usage_count: 1,
                })
                .select('*')
                .single()
            merchantId = created?.id ?? null
        }
    }

    const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
            user_id: userId,
            type: input.type,
            description: input.description,
            merchant_id: merchantId,
            category_id: input.categoryId ?? null,
            card_id: input.cardId ?? null,
            total_amount: input.amount,
            purchase_date: toISODate(input.purchaseDate),
            notes: input.notes ?? null,
        })
        .select('*')
        .single()

    if (expenseError) throw new Error(expenseError.message)

    let card: CardCycle | null = null
    if (input.cardId) {
        const { data: cardRow } = await supabase
            .from('cards')
            .select('closing_day, due_day')
            .eq('id', input.cardId)
            .is('deleted_at', null)
            .single()
        card = cardRow ?? null
    }

    if (input.type === 'installment' && input.installments) {
        const { data: plan } = await supabase
            .from('installment_plans')
            .insert({ expense_id: expense.id, user_id: userId, installments_total: input.installments })
            .select('*')
            .single()

        const installments = generateInstallments(input.amount, input.installments, input.purchaseDate, card)
        const { data: occurrences, error } = await supabase
            .from('expense_installments')
            .insert(
                installments.map((installment) => ({
                    user_id: userId,
                    expense_id: expense.id,
                    installment_plan_id: plan?.id,
                    merchant_id: merchantId,
                    category_id: input.categoryId ?? null,
                    card_id: input.cardId ?? null,
                    description: input.description,
                    ...installment,
                })),
            )
            .select('*')

        if (error) throw new Error(error.message)
        return { expense, occurrences }
    }

    if (input.type === 'recurring' && input.frequency) {
        const { data: recurrence } = await supabase
            .from('recurrences')
            .insert({
                user_id: userId,
                frequency: input.frequency,
                start_date: toISODate(input.purchaseDate),
                end_date: input.endDate ?? null,
            })
            .select('*')
            .single()

        const untilDate = new Date(input.purchaseDate)
        untilDate.setMonth(untilDate.getMonth() + 12)
        const dates = generateRecurrenceOccurrences(
            input.purchaseDate,
            input.frequency,
            untilDate,
            input.endDate ? new Date(input.endDate) : null,
        )

        const { data: occurrences, error } = await supabase
            .from('expense_installments')
            .insert(
                dates.map((date) => {
                    const occurrenceDate = new Date(date)
                    const invoice = getInvoiceForExpense(occurrenceDate, card)
                    return {
                        user_id: userId,
                        expense_id: expense.id,
                        recurrence_id: recurrence?.id,
                        merchant_id: merchantId,
                        category_id: input.categoryId ?? null,
                        card_id: input.cardId ?? null,
                        description: input.description,
                        amount: input.amount,
                        occurrence_date: date,
                        due_date: toISODate(invoice.dueDate),
                        invoice_month: invoice.month,
                    }
                }),
            )
            .select('*')

        if (error) throw new Error(error.message)
        return { expense, occurrences }
    }

    const invoice = getInvoiceForExpense(input.purchaseDate, card)
    const { data: occurrence, error } = await supabase
        .from('expense_installments')
        .insert({
            user_id: userId,
            expense_id: expense.id,
            merchant_id: merchantId,
            category_id: input.categoryId ?? null,
            card_id: input.cardId ?? null,
            description: input.description,
            amount: input.amount,
            occurrence_date: toISODate(input.purchaseDate),
            due_date: toISODate(invoice.dueDate),
            invoice_month: invoice.month,
        })
        .select('*')
        .single()

    if (error) throw new Error(error.message)
    return { expense, occurrences: [occurrence] }
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
- Consumes: `createClient` (Task 5), `OccurrenceFilters` type (Task 18)
- Produces: `useOccurrences(filters)`, `useUpdateOccurrence()`, `useDeleteOccurrence()` — consumed by Task 28 (`occurrence-list.tsx`) and Task 29 (`occurrence-sheet.tsx`).

- [ ] **Step 1: Write `src/app/api/occurrences/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const url = new URL(request.url)
    let query = supabase
        .from('expense_installments')
        .select('*')
        .is('deleted_at', null)
        .order('occurrence_date', { ascending: false })

    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
    const categoryId = url.searchParams.get('categoryId')
    const cardId = url.searchParams.get('cardId')
    const status = url.searchParams.get('status')

    if (from) query = query.gte('occurrence_date', from)
    if (to) query = query.lte('occurrence_date', to)
    if (q) query = query.ilike('description', `%${q}%`)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (cardId) query = query.eq('card_id', cardId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
```

- [ ] **Step 2: Write `src/app/api/occurrences/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

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

    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 422 })
    }

    const patch = {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.amount && { amount: parsed.data.amount }),
        ...(parsed.data.description && { description: parsed.data.description }),
        ...(parsed.data.categoryId !== undefined && { category_id: parsed.data.categoryId }),
        ...(parsed.data.cardId !== undefined && { card_id: parsed.data.cardId }),
    }

    if (scope === 'occurrence') {
        const { data, error } = await supabase
            .from('expense_installments')
            .update(patch)
            .eq('id', id)
            .is('deleted_at', null)
            .select('*')
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    const { data: current } = await supabase
        .from('expense_installments')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
    if (!current) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })

    let query = supabase.from('expense_installments').update(patch).is('deleted_at', null)

    if (scope === 'future' && current.installment_plan_id) {
        query = query.eq('installment_plan_id', current.installment_plan_id).gte('occurrence_date', current.occurrence_date)
    } else if (scope === 'series' && current.recurrence_id) {
        query = query.eq('recurrence_id', current.recurrence_id)
    } else if (scope === 'end' && current.recurrence_id) {
        query = query.eq('recurrence_id', current.recurrence_id).gte('occurrence_date', current.occurrence_date)
    } else {
        return NextResponse.json({ error: 'Escopo inválido para esta ocorrência' }, { status: 422 })
    }

    const { data, error } = await query.select('*')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'occurrence'

    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const deletedAt = new Date().toISOString()

    if (scope === 'occurrence') {
        const { error } = await supabase
            .from('expense_installments')
            .update({ deleted_at: deletedAt })
            .eq('id', id)
            .is('deleted_at', null)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true })
    }

    const { data: current } = await supabase
        .from('expense_installments')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
    if (!current) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })

    let query = supabase.from('expense_installments').update({ deleted_at: deletedAt }).is('deleted_at', null)

    if (scope === 'future' && current.installment_plan_id) {
        query = query.eq('installment_plan_id', current.installment_plan_id).gte('occurrence_date', current.occurrence_date)
    } else if (scope === 'series' && current.recurrence_id) {
        query = query.eq('recurrence_id', current.recurrence_id)
    } else if (scope === 'end' && current.recurrence_id) {
        query = query.eq('recurrence_id', current.recurrence_id).gte('occurrence_date', current.occurrence_date)
    } else {
        return NextResponse.json({ error: 'Escopo inválido para esta ocorrência' }, { status: 422 })
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

Reuse the installment expense created in Task 22's verification. `fetch('/api/occurrences?status=pending')` — confirm all 3 rows. `PATCH /api/occurrences/<id-of-2nd>?scope=future` with `{ status: 'paid' }` — confirm installments 2 and 3 flip to paid, installment 1 stays pending. Then `fetch('/api/occurrences/<id-of-2nd>?scope=occurrence', { method: 'DELETE' })` and confirm it disappears from `GET /api/occurrences`, but in the Supabase table editor the row is still present in `expense_installments` with `deleted_at` set (a real row, not gone) — confirming the delete was soft.

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
- Consumes: `createClient` (Task 5), `summarizeMonth` (Task 17)
- Produces: `GET /api/reports/summary?month=YYYY-MM` → `{ total, byCategory, byCard }` — consumed by Task 34 (`/relatorios`).

- [ ] **Step 1: Write `src/app/api/reports/summary/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { summarizeMonth } from '@/lib/finance/dashboard'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const url = new URL(request.url)
    const month = url.searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'Informe o mês' }, { status: 422 })

    const { data, error } = await supabase
        .from('expense_installments')
        .select('amount, category_id, card_id, status')
        .eq('invoice_month', month)
        .is('deleted_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(summarizeMonth(data))
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

