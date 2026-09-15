# Section F UI Components — Worktree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bolso MVP's Section F — the standalone UI components (card
visual/colors, quick-add natural-language input, manual expense dialog+form,
occurrence row/list, occurrence edit/delete sheet, summary tiles + month
switcher) — implemented in an isolated git worktree, off `develop`, so this
work doesn't mix with anything else.

**Why this doc exists instead of executing `section-f-ui-components.md`
directly:** that file was written 2026-09-09/11, *before* the monorepo/tRPC
migration (`docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`)
split business logic into `packages/domain`/`packages/api`. Its code snippets
use stale imports (`@/lib/finance/parser`, `@/lib/finance/money`), a
nonexistent `OccurrenceRow` type, snake_case field names that no longer
match the DB schema, a schema name that was renamed, and one real functional
bug (a merchant-shape mismatch that would silently break the parser's
default-card/category auto-fill). This doc rewrites every task's code in
full against the actual current source — verified by reading
`apps/web/src/hooks/*.ts`, `packages/api/src/services/*.ts`,
`packages/api/src/routers/occurrences.ts`, `packages/db/src/schema/domain.ts`,
and `packages/domain/src/{parser,money,date}.ts` directly. `section-f-ui-components.md`
itself is left unedited (Section G's plan still cross-references it); this
doc is the one to actually execute.

**Confirmed prerequisite state (2026-09-14):** Sections A–E are merged into
`develop` (`git log` HEAD `7b973bf "chore: mark plan sections E1/E2 as
implemented"`). `apps/web/src/hooks/` already has tRPC-backed
`use-cards.ts`, `use-categories.ts`, `use-merchants.ts`,
`use-create-expense.ts`, `use-occurrences.ts`, `use-summary.ts`. All required
shadcn primitives exist in `apps/web/src/components/ui/` (input, dialog,
select, sheet, switch, button, card). `apps/web/src/components/app/` exists
with only `bottom-nav.tsx` and `password-checklist.tsx` — none of Section F's
components exist yet. `apps/web/src/components/forms/` and
`apps/web/src/lib/finance/` don't exist yet — this plan creates both. No
`/inicio`, `/mes`, `/relatorios`, `/ajustes` routes exist yet (Section G) —
manual verification steps that assume those routes are deferred there.

**Tech Stack:** Next.js App Router, `@tanstack/react-query` v5 +
`@trpc/tanstack-react-query` (via `useTRPC()`), `@contai/domain` (pure
business logic: parser, money, date helpers), `@contai/api` (tRPC routers +
zod schemas), react-hook-form + `@hookform/resolvers/zod`, shadcn/ui,
tailwind-merge, lucide-react, sonner.

**Source spec:** `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-f-ui-components.md`
(task list and design intent — this doc supersedes its code blocks with
current, correct ones), `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`,
`docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.

## Global Constraints

- Files: lowercase-with-hyphens. Always named exports, never `export default`
  (except `page.tsx`/`layout.tsx`/`route.ts`, not touched by this section).
- Every UI component: `className={twMerge('base-classes', className)}`,
  `data-slot="<name>"` on the root element, state via `data-*` attributes,
  icon-only buttons need `aria-label`, icons use explicit `size-*` classes.
- No hardcoded colors — only tokens from `apps/web/src/app/globals.css`.
- TypeScript: never `React.FC`, never `any`; type-only imports; props extend
  `ComponentProps<'tag'>`.
- Never redeclare a zod schema that already exists in `@contai/api` — import
  it from there so client and server validation can't drift.
- `expense_installments` (occurrences) is what all UI reads — never
  `expenses` directly.
- A caller-supplied or generated `Date` must go through `@contai/domain`'s
  `toISODate`/`fromISODate` — never a bare `Date`/`.toISOString()`/`new
  Date(str)` — per this repo's documented timezone-bug precedent
  (`packages/domain/CLAUDE.md`).
- First task to create a structurally complex folder
  (`apps/web/src/lib/finance/`, `apps/web/src/components/forms/`) adds a
  short `CLAUDE.md` there.
- Run `pnpm --filter web typecheck` after every task — must be green before
  the next task starts (stricter than a bare `pnpm build`).

---

### Task 0: Create and verify the worktree

- [ ] **Step 1: Create the worktree off `develop`**

Invoke the `superpowers:using-git-worktrees` skill. If falling back to raw
git (matches this project's existing convention — sibling directory, not
`.worktrees/` — used for the Section E2 worktree):

```bash
git worktree add -b feature/f-ui-components ../contai-f-ui-components develop
```

- [ ] **Step 2: Install dependencies**

```bash
cd ../contai-f-ui-components
pnpm install
```

Expected: completes with no errors; workspace links resolve (`@contai/domain`,
`@contai/api`, `@contai/db`).

- [ ] **Step 3: Sanity-check before starting**

```bash
pnpm turbo run typecheck
```

Expected: passes (pre-existing state — nothing from this plan added yet).

---

### Task 25: `card-visual.tsx` + `card-colors.ts` + `card-color-picker.tsx`

**Files:**
- Create: `apps/web/src/lib/finance/card-colors.ts`
- Create: `apps/web/src/lib/finance/CLAUDE.md`
- Create: `apps/web/src/components/app/card-visual.tsx`
- Create: `apps/web/src/components/app/card-color-picker.tsx`

**Interfaces:**
- Consumes: `twMerge`, color tokens from `globals.css`.
- Produces: `CARD_COLORS`, `resolveCardColor(value)`, `<CardVisual size color name />`,
  `<CardColorPicker value onChange />` — consumed by Task 27 (expense form
  card select) and Task 35 (`/ajustes` card form, out of scope here).

- [ ] **Step 1: Write `apps/web/src/lib/finance/card-colors.ts`**

```ts
export interface CardColor {
    id: string
    label: string
    value: string
}

export const CARD_COLORS: CardColor[] = [
    { id: 'orange', label: 'Laranja', value: 'oklch(0.65 0.21 38)' },
    { id: 'purple', label: 'Roxo', value: 'oklch(0.5 0.24 300)' },
    { id: 'blue', label: 'Azul', value: 'oklch(0.55 0.18 255)' },
    { id: 'teal', label: 'Verde-água', value: 'oklch(0.6 0.13 190)' },
    { id: 'green', label: 'Verde', value: 'oklch(0.58 0.16 150)' },
    { id: 'pink', label: 'Rosa', value: 'oklch(0.65 0.2 350)' },
    { id: 'yellow', label: 'Amarelo', value: 'oklch(0.78 0.16 85)' },
    { id: 'graphite', label: 'Grafite', value: 'oklch(0.32 0.02 265)' },
]

export const DEFAULT_CARD_COLOR = CARD_COLORS[0].value

export function resolveCardColor(color?: string | null): string {
    if (!color) return DEFAULT_CARD_COLOR
    const preset = CARD_COLORS.find((c) => c.id === color || c.value === color)
    return preset?.value ?? color
}
```

- [ ] **Step 2: Write `apps/web/src/lib/finance/CLAUDE.md`**

First task creating this folder:

```markdown
# src/lib/finance

Web-only cosmetic/presentational finance helpers — not business logic (that
lives in `@contai/domain`). `card-colors.ts` defines the fixed OKLCH color
palette used by `CardVisual`/`CardColorPicker`; `resolveCardColor` accepts
either a palette `id` or a raw color string already stored on a card, for
backward compatibility with hand-picked colors.
```

- [ ] **Step 3: Write `apps/web/src/components/app/card-visual.tsx`**

```tsx
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { resolveCardColor } from '@/lib/finance/card-colors'

type Size = 'lg' | 'sm' | 'xs'

const sizes: Record<Size, string> = {
    lg: 'aspect-[1.586] w-full max-h-44 rounded-2xl p-3',
    sm: 'h-10 w-16 rounded-lg p-1.5',
    xs: 'h-4 w-6 rounded-[4px] p-0',
}

export interface CardVisualProps extends Omit<ComponentProps<'div'>, 'color'> {
    size: Size
    color?: string | null
    name?: string
}

export function CardVisual({ size, color, name, className, ...props }: CardVisualProps) {
    const base = resolveCardColor(color)
    const background = `linear-gradient(135deg, color-mix(in oklab, ${base} 88%, white) 0%, ${base} 55%, color-mix(in oklab, ${base} 78%, black) 100%)`

    return (
        <div
            data-slot="card-visual"
            aria-hidden={!name}
            className={twMerge(sizes[size], 'relative overflow-hidden shadow-sm', className)}
            style={{ background }}
            {...props}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{ background: 'radial-gradient(120% 80% at 15% 0%, rgb(255 255 255 / 0.45), transparent 60%)' }}
            />
            {size === 'lg' && (
                <div className="relative flex h-full flex-col justify-between">
                    <span className="truncate font-display text-sm font-semibold text-white drop-shadow-sm">{name}</span>
                    <div className="flex items-end justify-between">
                        <div className="h-4 w-6 rounded-[4px] bg-white/35" />
                        <div className="flex items-center">
                            <div className="size-5 rounded-full bg-white/85" />
                            <div className="-ml-2 size-5 rounded-full bg-white/45" />
                        </div>
                    </div>
                </div>
            )}
            {size === 'sm' && (
                <div className="relative mt-auto flex items-center self-end">
                    <div className="size-3 rounded-full bg-white/85" />
                    <div className="-ml-1.5 size-3 rounded-full bg-white/45" />
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 4: Write `apps/web/src/components/app/card-color-picker.tsx`**

Fixes the source plan's `aria-label` bug — `CardColor` has `label`, not `name`.

```tsx
import { twMerge } from 'tailwind-merge'
import { CARD_COLORS } from '@/lib/finance/card-colors'

export interface CardColorPickerProps {
    value: string
    onChange: (value: string) => void
}

export function CardColorPicker({ value, onChange }: CardColorPickerProps) {
    return (
        <div data-slot="card-color-picker" className="flex gap-2">
            {CARD_COLORS.map((color) => (
                <button
                    key={color.value}
                    type="button"
                    aria-label={`Cor ${color.label}`}
                    data-selected={value === color.value ? '' : undefined}
                    onClick={() => onChange(color.value)}
                    className={twMerge('size-8 rounded-full border-2 border-transparent data-[selected]:border-ring')}
                    style={{ backgroundColor: color.value }}
                />
            ))}
        </div>
    )
}
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter web typecheck
```

Visual verification: temporarily render `<CardVisual size="lg" color="orange" name="Nubank" />`
inside `apps/web/src/app/(app)/layout.tsx` (the only existing route shell),
run `pnpm --filter web dev`, confirm the gradient card renders, then remove
the temporary render before committing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/finance apps/web/src/components/app/card-visual.tsx apps/web/src/components/app/card-color-picker.tsx
git commit -m "feat: add cosmetic card-visual component and color picker"
```

---

### Task 26: `quick-add.tsx`

**Files:**
- Create: `apps/web/src/components/app/quick-add.tsx`

**Interfaces:**
- Consumes: `parseExpenseInput` (`@contai/domain`); `useCards`, `useCategories`,
  `useMerchants`, `useCreateExpense` (`apps/web/src/hooks/*`); `formatBRL`
  (`@contai/domain`).
- Produces: `<QuickAdd autoFocus? />` — consumed by Task 32 (`/inicio`, out of
  scope here).

**Corrections vs. the source plan:** imports move to `@contai/domain`;
`useMerchants()` returns Drizzle's camelCase rows
(`normalizedName`/`displayName`/`defaultCategoryId`/`defaultCardId`) but
`parseExpenseInput`'s `ParserContext.merchants` expects snake_case
`ParserMerchant[]` (`normalized_name`/`display_name`/`default_category_id`/
`default_card_id`) — without mapping, merchant-based default card/category
auto-fill silently never triggers; `parsed.purchaseDate` is a `Date` but
`createExpenseInputSchema.purchaseDate` requires a `YYYY-MM-DD` string, so it
must go through `toISODate`.

- [ ] **Step 1: Write `apps/web/src/components/app/quick-add.tsx`**

```tsx
'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { parseExpenseInput, formatBRL, toISODate } from '@contai/domain'
import { useCards } from '@/hooks/use-cards'
import { useCategories } from '@/hooks/use-categories'
import { useMerchants } from '@/hooks/use-merchants'
import { useCreateExpense } from '@/hooks/use-create-expense'
import { Input } from '@/components/ui/input'

export interface QuickAddProps {
    autoFocus?: boolean
}

export function QuickAdd({ autoFocus }: QuickAddProps) {
    const [text, setText] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const { data: merchants = [] } = useMerchants()
    const createExpense = useCreateExpense()

    const parserMerchants = useMemo(
        () =>
            merchants.map((m) => ({
                id: m.id,
                normalized_name: m.normalizedName,
                display_name: m.displayName,
                default_category_id: m.defaultCategoryId,
                default_card_id: m.defaultCardId,
            })),
        [merchants],
    )

    const parsed = useMemo(() => {
        if (!text.trim()) return null
        return parseExpenseInput(text, { cards, categories, merchants: parserMerchants }, new Date())
    }, [text, cards, categories, parserMerchants])

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter' || !parsed || parsed.ambiguous || parsed.amount === null) return

        createExpense.mutate(
            {
                amount: parsed.amount,
                description: parsed.merchantName ?? text,
                merchantName: parsed.merchantName ?? undefined,
                categoryId: parsed.categoryId,
                cardId: parsed.cardId,
                purchaseDate: toISODate(parsed.purchaseDate),
                type: parsed.installments ? 'installment' : parsed.frequency ? 'recurring' : 'single',
                installments: parsed.installments ?? undefined,
                frequency: parsed.frequency ?? undefined,
            },
            { onSuccess: () => setText('') },
        )
    }

    return (
        <div data-slot="quick-add" className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <Input
                ref={inputRef}
                autoFocus={autoFocus}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 1200 em 3x na americanas no nubank"
                aria-label="Adicionar despesa por texto"
                className="h-14 rounded-2xl border-2 text-lg font-medium"
            />
            {parsed && (
                <div data-slot="quick-add-preview" className="mt-3 rounded-2xl bg-secondary/60 p-3 text-sm text-foreground-subtle">
                    {parsed.ambiguous || parsed.amount === null ? (
                        <span>Não consegui identificar o valor — confirme manualmente.</span>
                    ) : (
                        <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
                            {formatBRL(parsed.amount)}
                            {parsed.installments ? ` em ${parsed.installments}x` : ''}
                            {parsed.frequency ? ' (recorrente)' : ''}
                            {parsed.merchantName ? ` — ${parsed.merchantName}` : ''}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web typecheck
```

Full manual verification (typing an expense, pressing Enter, seeing the
toast) is deferred to Task 32 once `/inicio` mounts this component — no route
exists yet to mount it in for a live check.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app/quick-add.tsx
git commit -m "feat: add quick-add natural language expense input"
```

---

### Task 27: `manual-expense-dialog.tsx` + `forms/expense-form.tsx`

**Files:**
- Edit: `packages/api/src/index.ts`
- Create: `apps/web/src/components/forms/CLAUDE.md`
- Create: `apps/web/src/components/forms/expense-form.tsx`
- Create: `apps/web/src/components/app/manual-expense-dialog.tsx`

**Interfaces:**
- Consumes: `createExpenseInputSchema`/`CreateExpenseInput` (`@contai/api`,
  newly barrel-exported by this task); `useCreateExpense`, `useCards`,
  `useCategories`; shadcn `Dialog`/`Select`/`Input`/`Button`; `CardVisual`
  (Task 25).
- Produces: `<ExpenseForm onSuccess />`, `<ManualExpenseDialog open onOpenChange />`
  — consumed by Task 32 (out of scope here).

**Corrections vs. the source plan:** the schema is named
`createExpenseInputSchema`/`CreateExpenseInput` (not `createExpenseSchema`)
and lives in `packages/api/src/services/expenses-service.ts`, not yet
exported from the package's public barrel — this task adds that export
rather than redeclaring the schema client-side; `purchaseDate` must be a
`YYYY-MM-DD` string via `toISODate`, not a bare `Date`.

- [ ] **Step 1: Export the expense schema from `packages/api`**

Edit `packages/api/src/index.ts`, add:

```ts
export { createExpenseInputSchema } from './services/expenses-service'
export type { CreateExpenseInput } from './services/expenses-service'
```

- [ ] **Step 2: Write `apps/web/src/components/forms/CLAUDE.md`**

First task creating this folder:

```markdown
# src/components/forms

react-hook-form + zod forms. Each form resolves against the same zod schema
its tRPC procedure validates with (imported from `@contai/api`, never
redeclared client-side) so client and server validation can't drift.
```

- [ ] **Step 3: Write `apps/web/src/components/forms/expense-form.tsx`**

```tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toISODate } from '@contai/domain'
import { createExpenseInputSchema, type CreateExpenseInput } from '@contai/api'
import { useCreateExpense } from '@/hooks/use-create-expense'
import { useCards } from '@/hooks/use-cards'
import { useCategories } from '@/hooks/use-categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardVisual } from '@/components/app/card-visual'

export interface ExpenseFormProps {
    onSuccess: () => void
}

export function ExpenseForm({ onSuccess }: ExpenseFormProps) {
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const createExpense = useCreateExpense()

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<CreateExpenseInput>({
        resolver: zodResolver(createExpenseInputSchema),
        defaultValues: {
            type: 'single',
            purchaseDate: toISODate(new Date()),
            amount: 0,
            description: '',
        },
    })

    const type = watch('type')

    function onSubmit(values: CreateExpenseInput) {
        createExpense.mutate(values, { onSuccess })
    }

    return (
        <form data-slot="expense-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <label htmlFor="amount">Valor</label>
                <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <span className="text-sm text-destructive">{errors.amount.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="description">Descrição</label>
                <Input id="description" {...register('description')} />
                {errors.description && <span className="text-sm text-destructive">{errors.description.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="type">Tipo</label>
                <Select value={type} onValueChange={(value) => setValue('type', value as CreateExpenseInput['type'])}>
                    <SelectTrigger id="type">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="single">Única</SelectItem>
                        <SelectItem value="installment">Parcelada</SelectItem>
                        <SelectItem value="recurring">Recorrente</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {type === 'installment' && (
                <div className="flex flex-col gap-1">
                    <label htmlFor="installments">Parcelas</label>
                    <Input id="installments" type="number" {...register('installments', { valueAsNumber: true })} />
                    {errors.installments && <span className="text-sm text-destructive">{errors.installments.message}</span>}
                </div>
            )}

            {type === 'recurring' && (
                <div className="flex flex-col gap-1">
                    <label htmlFor="frequency">Frequência</label>
                    <Select
                        value={watch('frequency')}
                        onValueChange={(value) => setValue('frequency', value as CreateExpenseInput['frequency'])}
                    >
                        <SelectTrigger id="frequency">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.frequency && <span className="text-sm text-destructive">{errors.frequency.message}</span>}
                </div>
            )}

            <div className="flex flex-col gap-1">
                <label htmlFor="categoryId">Categoria</label>
                <Select value={watch('categoryId') ?? undefined} onValueChange={(value) => setValue('categoryId', value)}>
                    <SelectTrigger id="categoryId">
                        <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="cardId">Cartão</label>
                <Select value={watch('cardId') ?? undefined} onValueChange={(value) => setValue('cardId', value)}>
                    <SelectTrigger id="cardId">
                        <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                        {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                                <div className="flex items-center gap-2">
                                    <CardVisual size="sm" color={card.color} name={card.name} />
                                    {card.name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="purchaseDate">Data</label>
                <Input id="purchaseDate" type="date" {...register('purchaseDate')} />
            </div>

            <Button type="submit" disabled={createExpense.isPending}>
                Salvar
            </Button>
        </form>
    )
}
```

- [ ] **Step 4: Write `apps/web/src/components/app/manual-expense-dialog.tsx`**

```tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExpenseForm } from '@/components/forms/expense-form'

export interface ManualExpenseDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ManualExpenseDialog({ open, onOpenChange }: ManualExpenseDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova despesa</DialogTitle>
                </DialogHeader>
                <ExpenseForm onSuccess={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    )
}
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter web typecheck
```

Manual verification (submitting invalid/valid installment counts, seeing the
zod refine error, seeing the dialog close on success) is deferred to Task 32
once wired into `/inicio` — no route exists yet.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/index.ts apps/web/src/components/forms apps/web/src/components/app/manual-expense-dialog.tsx
git commit -m "feat: add manual expense form and dialog fallback"
```

---

### Task 28: `occurrence-list.tsx` + `occurrence-row.tsx`

**Files:**
- Edit: `apps/web/src/hooks/use-occurrences.ts`
- Create: `apps/web/src/components/app/occurrence-row.tsx`
- Create: `apps/web/src/components/app/occurrence-list.tsx`

**Interfaces:**
- Consumes: `OccurrenceRow` type (newly added by this task); `formatBRL`
  (`@contai/domain`).
- Produces: `<OccurrenceRow occurrence onClick />`, `<OccurrenceList occurrences
  showDateHeaders? onSelect />` — consumed by Task 32/33 (out of scope here).

**Corrections vs. the source plan:** no `OccurrenceRow` type exists yet —
this task adds one inferred from the real tRPC router output; every field
name is camelCase (`installmentsTotal`, `installmentNumber`,
`occurrenceDate`, not the snake_case names the source plan used);
`occurrence.amount` is a numeric-column `string`, so `formatBRL` needs
`Number(...)`; grouping by "today" must use `toISODate(new Date())`, not
`new Date().toISOString().slice(0, 10)` (which computes UTC-midnight, not
local, and can misgroup rows near a day boundary).

- [ ] **Step 1: Add `OccurrenceRow` type to `apps/web/src/hooks/use-occurrences.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { inferRouterOutputs } from '@trpc/server'
import { useTRPC } from '@/lib/trpc/client'
import type { AppRouter, OccurrenceFilters } from '@contai/api'

type RouterOutputs = inferRouterOutputs<AppRouter>
export type OccurrenceRow = RouterOutputs['occurrences']['list'][number]

export function useOccurrences(filters: OccurrenceFilters) {
    // ... unchanged
```

(Keep the existing `useOccurrences`/`useUpdateOccurrence`/`useDeleteOccurrence`
bodies as-is — only the new imports and `OccurrenceRow` type are added above
them.)

- [ ] **Step 2: Write `apps/web/src/components/app/occurrence-row.tsx`**

```tsx
import { formatBRL } from '@contai/domain'
import { twMerge } from 'tailwind-merge'
import type { OccurrenceRow as OccurrenceRowData } from '@/hooks/use-occurrences'

export interface OccurrenceRowProps {
    occurrence: OccurrenceRowData
    onClick: () => void
}

export function OccurrenceRow({ occurrence, onClick }: OccurrenceRowProps) {
    const forecast = occurrence.status === 'pending'

    return (
        <button
            type="button"
            data-slot="occurrence-row"
            data-status={occurrence.status}
            data-forecast={forecast ? '' : undefined}
            onClick={onClick}
            className={twMerge(
                'flex min-h-11 w-full items-center justify-between rounded-2xl px-3 py-2 text-left hover:bg-secondary/60',
                'data-[status=cancelled]:opacity-50',
                'data-[forecast]:opacity-70 data-[forecast]:ring-1 data-[forecast]:ring-dashed data-[forecast]:ring-border',
            )}
        >
            <span className="flex items-center gap-2 text-foreground">
                {occurrence.description}
                {occurrence.installmentsTotal ? ` (${occurrence.installmentNumber}/${occurrence.installmentsTotal})` : ''}
                {forecast && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Previsto
                    </span>
                )}
            </span>
            <span
                className={twMerge(
                    'font-display font-semibold tabular-nums text-foreground',
                    forecast && 'text-muted-foreground',
                )}
            >
                {formatBRL(Number(occurrence.amount))}
            </span>
        </button>
    )
}
```

- [ ] **Step 3: Write `apps/web/src/components/app/occurrence-list.tsx`**

```tsx
import { toISODate } from '@contai/domain'
import { OccurrenceRow } from './occurrence-row'
import type { OccurrenceRow as OccurrenceRowData } from '@/hooks/use-occurrences'

export interface OccurrenceListProps {
    occurrences: OccurrenceRowData[]
    showDateHeaders?: boolean
    onSelect: (occurrence: OccurrenceRowData) => void
}

export function OccurrenceList({ occurrences, showDateHeaders = false, onSelect }: OccurrenceListProps) {
    if (occurrences.length === 0) {
        return <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma despesa encontrada.</p>
    }

    if (!showDateHeaders) {
        return (
            <div data-slot="occurrence-list" className="flex flex-col">
                {occurrences.map((occurrence) => (
                    <OccurrenceRow key={occurrence.id} occurrence={occurrence} onClick={() => onSelect(occurrence)} />
                ))}
            </div>
        )
    }

    const grouped = occurrences.reduce<Record<string, OccurrenceRowData[]>>((acc, occurrence) => {
        acc[occurrence.occurrenceDate] = [...(acc[occurrence.occurrenceDate] ?? []), occurrence]
        return acc
    }, {})

    const todayISO = toISODate(new Date())

    return (
        <div data-slot="occurrence-list" className="flex flex-col gap-4">
            {Object.entries(grouped).map(([date, group]) => (
                <div key={date}>
                    <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {date === todayISO ? 'Hoje' : date}
                    </h3>
                    <div className="divide-y divide-border/60">
                        {group.map((occurrence) => (
                            <OccurrenceRow key={occurrence.id} occurrence={occurrence} onClick={() => onSelect(occurrence)} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-occurrences.ts apps/web/src/components/app/occurrence-row.tsx apps/web/src/components/app/occurrence-list.tsx
git commit -m "feat: add occurrence list and row components"
```

---

### Task 29: `occurrence-sheet.tsx`

**Files:**
- Edit: `packages/api/src/index.ts`
- Create: `apps/web/src/components/app/occurrence-sheet.tsx`

**Interfaces:**
- Consumes: `OccurrenceRow` (Task 28); `useUpdateOccurrence`/`useDeleteOccurrence`;
  `Scope`/`OccurrencePatch` (`@contai/api`, newly barrel-exported by this
  task); shadcn `Sheet`/`Switch`/`Button`.
- Produces: `<OccurrenceSheet occurrence onOpenChange />` — consumed by Task
  32/33 (out of scope here).

**Corrections vs. the source plan:** `useUpdateOccurrence().mutate(...)`
takes `{ id, scope, data }` — the source plan used the key `input`, which
doesn't match the real router (`packages/api/src/routers/occurrences.ts`);
occurrence fields are camelCase (`installmentPlanId`, `recurrenceId`); the
real `Scope` union has a 4th value (`'end'`) not exposed by this UI — the
`SCOPE_OPTIONS` array must be explicitly typed as `Scope[]` or the literal
values widen to `string` and fail typecheck against the mutation input.

- [ ] **Step 1: Export occurrence scope/patch types from `packages/api`**

Edit `packages/api/src/index.ts`, add:

```ts
export { occurrencePatchSchema, scopeSchema } from './services/occurrences-service'
export type { OccurrencePatch, Scope } from './services/occurrences-service'
```

- [ ] **Step 2: Write `apps/web/src/components/app/occurrence-sheet.tsx`**

```tsx
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type { Scope } from '@contai/api'
import { useUpdateOccurrence, useDeleteOccurrence, type OccurrenceRow } from '@/hooks/use-occurrences'

export interface OccurrenceSheetProps {
    occurrence: OccurrenceRow | null
    onOpenChange: (open: boolean) => void
}

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
    { value: 'occurrence', label: 'Só esta' },
    { value: 'future', label: 'Esta e as futuras' },
    { value: 'series', label: 'Toda a série' },
]

export function OccurrenceSheet({ occurrence, onOpenChange }: OccurrenceSheetProps) {
    const updateOccurrence = useUpdateOccurrence()
    const deleteOccurrence = useDeleteOccurrence()

    if (!occurrence) return null

    const hasScopes = Boolean(occurrence.installmentPlanId || occurrence.recurrenceId)
    const applicableScopes = hasScopes ? SCOPE_OPTIONS : [SCOPE_OPTIONS[0]]

    return (
        <Sheet open={Boolean(occurrence)} onOpenChange={onOpenChange}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>{occurrence.description}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 p-4">
                    <label className="flex items-center justify-between">
                        <span>Pago</span>
                        <Switch
                            checked={occurrence.status === 'paid'}
                            onCheckedChange={(checked) =>
                                updateOccurrence.mutate({
                                    id: occurrence.id,
                                    scope: 'occurrence',
                                    data: { status: checked ? 'paid' : 'pending' },
                                })
                            }
                        />
                    </label>
                    <div className="flex flex-col gap-2">
                        {applicableScopes.map((scope) => (
                            <Button
                                key={scope.value}
                                variant="destructive"
                                onClick={() => {
                                    deleteOccurrence.mutate({ id: occurrence.id, scope: scope.value })
                                    onOpenChange(false)
                                }}
                            >
                                Excluir: {scope.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web typecheck
```

Manual verification (toggling "Pago", deleting with a scope) is deferred to
Task 32/33 once wired in — no route exists yet.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/index.ts apps/web/src/components/app/occurrence-sheet.tsx
git commit -m "feat: add occurrence edit/delete sheet with scope selection"
```

---

### Task 30: `summary-tiles.tsx` + `month-switcher.tsx`

**Files:**
- Create: `apps/web/src/components/app/summary-tiles.tsx`
- Create: `apps/web/src/components/app/month-switcher.tsx`

**Interfaces:**
- Consumes: `formatBRL` (`@contai/domain`).
- Produces: `<SummaryTiles total byCategory byCard />`, `<MonthSwitcher month
  onChange />` — consumed by Task 32/33/34 (out of scope here). Presentational
  and ID-keyed; a later page composes it with `useCategories()`/`useCards()`
  name lookups.

**Corrections vs. the source plan:** only the `formatBRL` import path
changes (`@contai/domain`, not `@/lib/finance/money`) — everything else in
this task's code was already correct.

- [ ] **Step 1: Write `apps/web/src/components/app/summary-tiles.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@contai/domain'

export interface SummaryTilesProps {
    total: number
    byCategory: Record<string, number>
    byCard: Record<string, number>
}

export function SummaryTiles({ total, byCategory, byCard }: SummaryTilesProps) {
    const categoryEntries = Object.entries(byCategory)
    const cardEntries = Object.entries(byCard)

    return (
        <div data-slot="summary-tiles" className="grid grid-cols-1 gap-3">
            <Card className="rounded-2xl border-border p-3">
                <CardHeader>
                    <CardTitle>Total do mês</CardTitle>
                </CardHeader>
                <CardContent className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {formatBRL(total)}
                </CardContent>
            </Card>
            <Card className="rounded-2xl border-border p-3">
                <CardHeader>
                    <CardTitle>Por categoria</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                    {categoryEntries.map(([id, amount]) => (
                        <div key={id} className="flex flex-col gap-1">
                            <div className="flex justify-between">
                                <span className="text-foreground-subtle">{id}</span>
                                <span className="font-display tabular-nums text-foreground">{formatBRL(amount)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary">
                                <div
                                    className="h-2 rounded-full bg-primary"
                                    style={{ width: `${total ? Math.min(100, (amount / total) * 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card className="rounded-2xl border-border p-3">
                <CardHeader>
                    <CardTitle>Por cartão</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                    {cardEntries.map(([id, amount]) => (
                        <div key={id} className="flex justify-between">
                            <span className="text-foreground-subtle">{id}</span>
                            <span className="font-display tabular-nums text-foreground">{formatBRL(amount)}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
```

- [ ] **Step 2: Write `apps/web/src/components/app/month-switcher.tsx`**

```tsx
'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export interface MonthSwitcherProps {
    month: string // YYYY-MM
    onChange: (month: string) => void
}

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
    function shift(delta: number) {
        const [year, m] = month.split('-').map(Number)
        const next = new Date(year, m - 1 + delta, 1)
        onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
    }

    return (
        <div data-slot="month-switcher" className={twMerge('flex items-center justify-between')}>
            <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)} className="flex size-11 items-center justify-center">
                <ChevronLeft className="size-5" />
            </button>
            <span className="font-medium text-foreground">{month}</span>
            <button type="button" aria-label="Próximo mês" onClick={() => shift(1)} className="flex size-11 items-center justify-center">
                <ChevronRight className="size-5" />
            </button>
        </div>
    )
}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app/summary-tiles.tsx apps/web/src/components/app/month-switcher.tsx
git commit -m "feat: add summary tiles and month switcher components"
```

---

### Task 31: `bottom-nav.tsx` — verification only, no code change

**Files:** none.

`apps/web/src/components/app/bottom-nav.tsx` already has the center FAB
linking to `/inicio?focus=quick-add` (confirmed by reading the file — this
was already built with a prior task). Section F needs no change here. The
`?focus=quick-add` → autofocus wiring lives in `/inicio` itself, which
doesn't exist yet — fold this task's verification into Section G's Task 32.

- [ ] **Step 1: Confirm no action needed**

Read `apps/web/src/components/app/bottom-nav.tsx` and confirm the center
`Link` still points at `/inicio?focus=quick-add`. No commit for this task —
it folds into Task 32.

---

## Finishing

Once Tasks 0/25–31 are committed and green on `feature/f-ui-components`:

- Run `pnpm turbo run typecheck lint test` at the repo root as a final gate.
- Check off Section F's per-step boxes in `section-f-ui-components.md` and
  the Section F row in the master plan
  (`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`).
- Use `superpowers:finishing-a-development-branch` to decide integration —
  likely a PR from `feature/f-ui-components` into `develop`, matching the
  `feature/api-hooks` → `develop` precedent already used for Sections E1/E2.

## Verification

- `pnpm --filter web typecheck` passes after each task and at the end.
- `pnpm --filter web build` and `pnpm --filter web lint` clean.
- `pnpm turbo run typecheck lint test` clean at the repo root before opening
  the PR.
- Manual dev-server spot checks wherever a check doesn't require the
  not-yet-built app routes (Task 25's scratch-render check); everything else
  (quick-add live preview, expense-form submission, occurrence sheet
  toggle/delete) is explicitly deferred to Section G's Task 32/33, since
  `/inicio`/`/mes` don't exist in this worktree.
