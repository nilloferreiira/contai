# Section E2 Web Hooks — Worktree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/web` type-safe access to the `appRouter` procedures — a
tRPC client Provider wired into the existing `@tanstack/react-query` v5
`QueryClient`, and one `use-*.ts` hook file per resource (cards, categories,
merchants, expenses, occurrences, reports) — implemented in an isolated git
worktree so this work doesn't mix with anything else landing on
`feature/api-hooks`.

**Architecture:** `apps/web/src/lib/trpc/client.ts` exposes `useTRPC()` (via
`createTRPCContext<AppRouter>()`); `apps/web/src/lib/trpc/provider.tsx` builds
the `httpBatchLink`-based `TRPCClient` (with the `superjson` transformer,
matching `packages/api/src/trpc.ts`) and wraps children in `TRPCProvider`,
mounted inside the existing `QueryProvider`. Each hook file wraps
`trpc.<resource>.<procedure>` in `useQuery`/`useMutation` via
`@trpc/tanstack-react-query`'s `queryOptions()`/`mutationOptions()`.

**Tech Stack:** `@trpc/client` v11, `@trpc/tanstack-react-query` v11,
`@tanstack/react-query` v5, `sonner`.

**Spec:** `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e2-web-hooks.md`
(source task list, code, and per-task manual verification — this plan wraps it
with worktree isolation and typecheck gates), and
`docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.

**Confirmed prerequisite state (2026-09-13):** the companion server-side plan
(`section-e1-api-trpc.md`) is already built — `packages/api/src/trpc.ts` has
`transformer: superjson`; all six routers (`cards`, `categories`, `merchants`,
`expenses`, `occurrences`, `reports`) are wired into `appRouter`; `AppRouter`
is exported from `@contai/api`; `apps/web/src/app/api/trpc/[trpc]/route.ts`
already exists and correctly proxies to it. `apps/web` itself is greenfield
for this work: `lib/trpc/` has only a server-only RSC caller (`server.ts`), no
`hooks/` directory exists, `query-provider.tsx` has no tRPC wiring, and none
of `@trpc/client`/`@trpc/tanstack-react-query`/`superjson` are installed there
yet. No Section F/G component references any of these hooks yet, so there is
no coupling risk.

## Global Constraints

- Every hook calls through `useTRPC()` — never construct a raw `fetch` call or a second tRPC client.
- Hook input field names match the service's zod schema exactly (camelCase, e.g. `closingDay`/`dueDay`/`creditLimit`, not snake_case).
- Mutation hooks: `onSuccess` invalidates the relevant `queryKey()`(s) and shows a `sonner` success toast; `onError` shows `error.message` in a toast.
- Files: lowercase-with-hyphens. Named exports only.
- End of the first task to create a structurally complex folder (`apps/web/src/lib/trpc/`, `apps/web/src/hooks/`), add a short `CLAUDE.md` in that folder.
- Run `pnpm --filter web typecheck` after every task, not just at the end — each task must land green before the next starts.
- All work happens inside the isolated worktree created in Task 0; do not touch the primary `feature/api-hooks` checkout.

---

### Task 0: Create the isolated worktree

**Files:** none (git/workspace setup only).

**Interfaces:** none — this task only prepares the environment every later task runs in.

- [ ] **Step 1: Create the worktree off `feature/api-hooks`**

Invoke the `superpowers:using-git-worktrees` skill to create a new worktree on
a new branch `feature/e2-web-hooks`, based on the current branch
`feature/api-hooks` (not `main`). If falling back to raw `git`:

```bash
git worktree add -b feature/e2-web-hooks ../contai-e2-web-hooks feature/api-hooks
```

- [ ] **Step 2: Install dependencies in the new worktree**

```bash
cd ../contai-e2-web-hooks
pnpm install
```

Expected: install completes with no errors; workspace links resolve (`@contai/api`, `@contai/domain`, `@contai/db`).

- [ ] **Step 3: Sanity-check the worktree builds before starting**

```bash
pnpm turbo run typecheck
```

Expected: passes (this is the pre-existing state — nothing from this plan has been added yet).

---

### Task 18: tRPC client wiring — `client.ts`, `provider.tsx`, `QueryProvider`

**Files:**
- Create: `apps/web/src/lib/trpc/client.ts`, `apps/web/src/lib/trpc/provider.tsx`
- Edit: `apps/web/src/providers/query-provider.tsx`, `apps/web/package.json`

**Interfaces:**
- Consumes: `type AppRouter` from `@contai/api` (already exported).
- Produces: `useTRPC()` + `TRPCProvider` (`client.ts`), `TRPCReactProvider` (`provider.tsx`) — consumed by every hook task below.

- [ ] **Step 1: Add tRPC client dependencies**

Edit `apps/web/package.json`, add to `dependencies`:

```json
"@trpc/client": "^11",
"@trpc/tanstack-react-query": "^11",
"superjson": "^2"
```

These versions match what `packages/api/package.json` already uses
(`@trpc/server@^11`, `superjson@^2`), which is required — `packages/api/src/trpc.ts`
configures `transformer: superjson` on its `initTRPC` instance so `Date`
columns (`createdAt`, `deletedAt`, occurrence dates) round-trip correctly; the
client link below must configure the identical transformer or responses will
fail to deserialize those fields.

- [ ] **Step 2: Write `apps/web/src/lib/trpc/client.ts`**

```ts
'use client'

import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '@contai/api'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
```

- [ ] **Step 3: Write `apps/web/src/lib/trpc/provider.tsx`**

```tsx
'use client'

import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import superjson from 'superjson'
import type { AppRouter } from '@contai/api'
import { TRPCProvider } from './client'

export function TRPCReactProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient()
    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
        }),
    )

    return (
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            {children}
        </TRPCProvider>
    )
}
```

- [ ] **Step 4: Wire `TRPCReactProvider` inside `QueryProvider`**

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

- [ ] **Step 5: Write `apps/web/src/lib/trpc/CLAUDE.md`**

First task creating this folder — per the Global Constraints rule:

```markdown
# src/lib/trpc

Browser-side tRPC wiring. `client.ts` exports `useTRPC()`/`TRPCProvider` via
`createTRPCContext<AppRouter>()`. `provider.tsx` builds the `httpBatchLink`
client (pointed at `/api/trpc`, `superjson` transformer matching
`packages/api/src/trpc.ts`) and mounts it inside the app's `QueryProvider`.
Never construct a second tRPC client or call `fetch` directly against
`/api/trpc` — always go through `useTRPC()`.
```

- [ ] **Step 6: Typecheck**

```bash
pnpm install
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 7: Verify manually**

```bash
pnpm --filter web dev
```

Expected: app boots with the Provider mounted. There are no hooks yet to
exercise — the first real call happens in Task 19.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add tRPC client Provider wired into QueryProvider"
```

---

### Task 19: `use-cards.ts`

**Files:**
- Create: `apps/web/src/hooks/use-cards.ts`, `apps/web/src/hooks/CLAUDE.md`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `cards` router (`list`, `create`, `update`, `delete`).
- Produces: `useCards()`, `useCreateCard()`, `useUpdateCard()`, `useDeleteCard()`.

- [ ] **Step 1: Write `apps/web/src/hooks/use-cards.ts`**

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

`useUpdateCard()` takes `{ id, data }` (matching the router's `input`).
`useCreateCard().mutate(values)` matches `cardInputSchema` directly (camelCase
`closingDay`/`dueDay`/`creditLimit`).

- [ ] **Step 2: Write `apps/web/src/hooks/CLAUDE.md`**

First task creating this folder:

```markdown
# src/hooks

React Query hooks over `@trpc/tanstack-react-query` — one file per resource
(`use-<resource>.ts`), named `use<Resource>()` for lists, `useCreate<Resource>()`/
`useUpdate<Resource>()`/`useDelete<Resource>()` for mutations. Every mutation
invalidates the resource's `queryKey()` on success and toasts via `sonner`. Never call
`fetch` directly here — always go through `useTRPC()`.
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 4: Verify manually**

```bash
pnpm --filter web dev
```

Log in via the browser. In a scratch client component, call
`useCreateCard().mutate({ name: 'Nubank', closingDay: 10, dueDay: 20, color: '#8A2BE2' })`
and confirm a row appears via `useCards()`. Confirm an unauthenticated request
to `/api/trpc/cards.list` (no session cookie) returns a tRPC `UNAUTHORIZED`
error, not data.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cards hooks"
```

---

### Task 20: `use-categories.ts`

**Files:**
- Create: `apps/web/src/hooks/use-categories.ts`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `categories` router (`list`, `create`, `update`, `delete`).
- Produces: `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()`.

- [ ] **Step 1: Write `apps/web/src/hooks/use-categories.ts`**

`@trpc/tanstack-react-query`'s `queryOptions()` already dedupes concurrent
identical requests through TanStack Query's own request deduplication (same
`queryKey` in flight only fires once) — no hand-rolled single-flight guard
needed.

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

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 3: Verify manually**

```bash
pnpm --filter web dev
```

Call `useCategories()` twice in a row (e.g. two mounted components, or
refetch) and confirm the 7 defaults seed once with no
`categories_user_name_unique` violation (check via `pnpm --filter @contai/db
exec drizzle-kit studio` if needed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add categories hooks"
```

---

### Task 21: `use-merchants.ts`

**Files:**
- Create: `apps/web/src/hooks/use-merchants.ts`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `merchants` router (`list` only).
- Produces: `useMerchants()` returning merchants ordered by `usageCount` desc.

- [ ] **Step 1: Write `apps/web/src/hooks/use-merchants.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useMerchants() {
    const trpc = useTRPC()
    return useQuery(trpc.merchants.list.queryOptions())
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 3: Verify manually**

```bash
pnpm --filter web dev
```

Confirm `useMerchants()` returns `[]` for a fresh user with no 500/`UNAUTHORIZED` surprises.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add merchants hook"
```

---

### Task 22: `use-create-expense.ts`

**Files:**
- Create: `apps/web/src/hooks/use-create-expense.ts`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `expenses` router (`create` only).
- Produces: `useCreateExpense()`.

- [ ] **Step 1: Write `apps/web/src/hooks/use-create-expense.ts`**

Land it with only the `merchants.list` invalidation for now — `occurrences.list`
and `reports.summary` don't exist as client-side query keys until Tasks 23-24,
and this keeps every commit green under `pnpm --filter web typecheck`.

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
                queryClient.invalidateQueries({ queryKey: trpc.merchants.list.queryKey() })
                toast.success('Despesa registrada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

Note: `createExpenseInputSchema`'s `purchaseDate` field is `z.string().date()`
— a calendar-date-only string (`'YYYY-MM-DD'`), not a full timestamp. This is
deliberate: a `z.coerce.date()` timestamp previously caused a confirmed
off-by-one-day bug once it round-tripped through the domain layer's
local-timezone date math. Whatever builds the actual expense form later
(Section F) must send `purchaseDate` as a plain `'YYYY-MM-DD'` string, never
`new Date().toISOString()`.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 3: Verify manually**

```bash
pnpm --filter web dev
```

Test all three branches: single (`{ amount: 50, description: 'mercado',
purchaseDate: '2026-09-09', type: 'single' }` → 1 occurrence row), installment
(same + `type: 'installment', installments: 3` → 3 rows, `installmentNumber`
1-3, `occurrenceDate`s one calendar month apart), recurring (`type:
'recurring', frequency: 'monthly'` → 12 rows one month apart, including the
start date).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add create-expense hook"
```

---

### Task 23: `use-occurrences.ts`

**Files:**
- Create: `apps/web/src/hooks/use-occurrences.ts`
- Edit: `apps/web/src/hooks/use-create-expense.ts` (add the deferred `occurrences.list` invalidation)
- Edit: `packages/api/src/index.ts` (re-export `OccurrenceFilters`)

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `occurrences` router (`list`, `update`, `delete`).
- Produces: `useOccurrences(filters)`, `useUpdateOccurrence()`, `useDeleteOccurrence()`.

- [ ] **Step 1: Re-export `OccurrenceFilters` from `@contai/api`**

Edit `packages/api/src/index.ts`, adding a re-export pointing at
`services/occurrences-service.ts`'s `OccurrenceFilters` type (it is currently
defined there but not exposed on the package's public surface):

```ts
export type { OccurrenceFilters } from './services/occurrences-service'
```

- [ ] **Step 2: Write `apps/web/src/hooks/use-occurrences.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import type { OccurrenceFilters } from '@contai/api'

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
                toast.success('Ocorrência removida')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

Both mutation hooks omit the `trpc.reports.summary` invalidation for now
(Task 24 adds it back in) — same deferred-typecheck pattern as Task 22.

- [ ] **Step 3: Add the deferred `occurrences.list` invalidation to `use-create-expense.ts`**

Edit `apps/web/src/hooks/use-create-expense.ts`, adding this line inside its
`onSuccess`:

```ts
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 5: Verify manually**

```bash
pnpm --filter web dev
```

Reuse the installment expense from Task 22's verification.
`useOccurrences({ status: 'pending' })` → confirm all 3 rows.
`useUpdateOccurrence().mutate({ id: <2nd occurrence id>, scope: 'future', data:
{ status: 'paid' } })` → confirm installments 2 and 3 flip to paid,
installment 1 stays pending. `useDeleteOccurrence().mutate({ id: <2nd
occurrence id>, scope: 'occurrence' })` → confirm it disappears from
`useOccurrences()`, but the row still exists in `expense_installments` with
`deletedAt` set (soft delete, confirm via `drizzle-kit studio`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add occurrences hooks"
```

---

### Task 24: `use-summary.ts`

**Files:**
- Create: `apps/web/src/hooks/use-summary.ts`
- Edit: `apps/web/src/hooks/use-create-expense.ts`, `apps/web/src/hooks/use-occurrences.ts` (add the deferred `reports.summary` invalidations)

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `reports` router (`summary`).
- Produces: `useSummary(month)`.

- [ ] **Step 1: Write `apps/web/src/hooks/use-summary.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useSummary(month: string) {
    const trpc = useTRPC()
    return useQuery(trpc.reports.summary.queryOptions({ month }))
}
```

- [ ] **Step 2: Fill in the deferred `reports.summary` invalidations**

Edit `apps/web/src/hooks/use-create-expense.ts`'s `onSuccess`, adding:

```ts
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
```

Edit `apps/web/src/hooks/use-occurrences.ts`'s two `onSuccess` handlers
(`useUpdateOccurrence`, `useDeleteOccurrence`), adding the same line to each.

- [ ] **Step 3: Full battery**

```bash
pnpm turbo run typecheck lint test && pnpm --filter web build
```

Expected: all green.

- [ ] **Step 4: Verify manually**

```bash
pnpm --filter web dev
```

`useSummary('2026-09')` → confirm the shape matches `summarizeMonth`'s return
type and totals match what Task 22's verification created.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add summary hook"
```

---

## Verification (end-to-end, whole plan)

1. Confirm the worktree at `../contai-e2-web-hooks` exists on branch
   `feature/e2-web-hooks`, based off `feature/api-hooks`.
2. Confirm 8 commits exist on that branch (Task 0 has no commit; Tasks
   18-24 each produce exactly one), in order, with the exact messages above.
3. `pnpm turbo run typecheck lint test && pnpm --filter web build` passes at
   the end of Task 24.
4. Manually walk through every per-task verification note above via `pnpm
   --filter web dev` with a logged-in browser session and a scratch client
   component per hook.
