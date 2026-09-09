# Bolso MVP Implementation Plan — Section F: UI components

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
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/lib/supabase/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

---

## Section F: UI components

### Task 25: `card-visual.tsx` + `card-colors.ts` + `card-color-picker.tsx`

**Files:**
- Create: `src/lib/finance/card-colors.ts`
- Create: `src/components/app/card-visual.tsx`
- Create: `src/components/app/card-color-picker.tsx`

**Interfaces:**
- Consumes: `twMerge` (Task 1), color tokens (Task 2)
- Produces: `CARD_COLORS: { name: string; value: string }[]`, `resolveCardColor(value: string | null): string`, `<CardVisual size="lg"|"sm"|"xs" color={string} name={string} />`, `<CardColorPicker value={string} onChange={(value: string) => void} />` — consumed by Task 27 (expense form card select), Task 35 (`/ajustes` card form).

- [ ] **Step 1: Write `src/lib/finance/card-colors.ts`**

```ts
export const CARD_COLORS = [
    { name: 'Roxo', value: '#8B5CF6' },
    { name: 'Laranja', value: '#F97316' },
    { name: 'Verde', value: '#10B981' },
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Cinza', value: '#6B7280' },
]

export function resolveCardColor(value: string | null): string {
    if (value && CARD_COLORS.some((c) => c.value === value)) return value
    return CARD_COLORS[0].value
}
```

- [ ] **Step 2: Write `src/components/app/card-visual.tsx`**

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
    color: string | null
    name?: string
}

export function CardVisual({ size, color, name, className, ...props }: CardVisualProps) {
    const resolved = resolveCardColor(color)

    return (
        <div
            data-slot="card-visual"
            className={twMerge(sizes[size], 'relative overflow-hidden text-white shadow-sm')}
            style={{
                background: `linear-gradient(135deg, ${resolved}, color-mix(in oklab, ${resolved} 60%, black))`,
            }}
            {...props}
        >
            <div
                className="absolute inset-0"
                style={{ background: `radial-gradient(circle at 30% 0%, color-mix(in oklab, ${resolved} 40%, white) 0%, transparent 60%)` }}
            />
            {size === 'lg' && (
                <div className="relative flex h-full flex-col justify-between">
                    <div className="h-5 w-7 rounded-sm bg-white/30" />
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{name}</span>
                        <div className="flex">
                            <div className="size-5 rounded-full bg-white/60" />
                            <div className="-ml-2 size-5 rounded-full bg-white/40" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 3: Write `src/components/app/card-color-picker.tsx`**

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
                    aria-label={`Cor ${color.name}`}
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

- [ ] **Step 4: Verify**

Create a scratch page or use the browser devtools React tree once Task 35 wires this in — for now, verify with `pnpm build` (typecheck) and visually in Storybook-less fashion by temporarily rendering `<CardVisual size="lg" color="#8B5CF6" name="Nubank" />` inside `src/app/(app)/inicio/page.tsx` (placeholder, to be replaced in Task 32), running `pnpm dev`, and confirming the gradient card renders. Remove the placeholder render before committing if `/inicio` isn't built yet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/card-colors.ts src/components/app/card-visual.tsx src/components/app/card-color-picker.tsx
git commit -m "feat: add cosmetic card-visual component and color picker"
```

---

### Task 26: `quick-add.tsx`

**Files:**
- Create: `src/components/app/quick-add.tsx`

**Interfaces:**
- Consumes: `parseExpenseInput`, `ParserContext` (Task 16); `useCards` (Task 19); `useCategories` (Task 20); `useMerchants` (Task 21); `useCreateExpense` (Task 22); `formatBRL` (Task 10)
- Produces: `<QuickAdd autoFocus?: boolean />` — consumed by Task 32 (`/inicio`).

- [ ] **Step 1: Write `src/components/app/quick-add.tsx`**

```tsx
'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { parseExpenseInput } from '@/lib/finance/parser'
import { formatBRL } from '@/lib/finance/money'
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

    const parsed = useMemo(() => {
        if (!text.trim()) return null
        return parseExpenseInput(text, { cards, categories, merchants }, new Date())
    }, [text, cards, categories, merchants])

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter' || !parsed || parsed.ambiguous || parsed.amount === null) return

        createExpense.mutate(
            {
                amount: parsed.amount,
                description: parsed.merchantName ?? text,
                merchantName: parsed.merchantName ?? undefined,
                categoryId: parsed.categoryId,
                cardId: parsed.cardId,
                purchaseDate: parsed.purchaseDate,
                type: parsed.installments ? 'installment' : parsed.frequency ? 'recurring' : 'single',
                installments: parsed.installments ?? undefined,
                frequency: parsed.frequency ?? undefined,
            },
            { onSuccess: () => setText('') },
        )
    }

    return (
        <div data-slot="quick-add" className="flex flex-col gap-2">
            <Input
                ref={inputRef}
                autoFocus={autoFocus}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 1200 em 3x na americanas no nubank"
                aria-label="Adicionar despesa por texto"
            />
            {parsed && (
                <div data-slot="quick-add-preview" className="rounded-lg border border-border bg-surface-raised p-2 text-sm text-foreground-subtle">
                    {parsed.ambiguous || parsed.amount === null ? (
                        <span>Não consegui identificar o valor — confirme manualmente.</span>
                    ) : (
                        <span>
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

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```

Once Task 32 mounts this on `/inicio`, type `"1200 em 3x na americanas no nubank"`, confirm the live preview shows the parsed amount/installments/merchant, press Enter, confirm a toast and the input clears. Type something with no number, confirm the ambiguous message shows and Enter does nothing.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/quick-add.tsx
git commit -m "feat: add quick-add natural language expense input"
```

---

### Task 27: `manual-expense-dialog.tsx` + `forms/expense-form.tsx`

**Files:**
- Create: `src/components/forms/expense-form.tsx`
- Create: `src/components/app/manual-expense-dialog.tsx`

**Interfaces:**
- Consumes: `createExpenseSchema`/`CreateExpenseInput` (Task 18); `useCreateExpense` (Task 22); `useCards`/`useCategories` (Tasks 19-20); shadcn `Dialog`/`Select`/`Input`/`Button` (Task 2); `CardVisual` (Task 25)
- Produces: `<ExpenseForm onSuccess: () => void />`, `<ManualExpenseDialog open, onOpenChange />` — consumed by Task 32 (`/inicio`, as the quick-add fallback).

- [ ] **Step 1: Write `src/components/forms/expense-form.tsx`**

RHF + zod form with fields: amount (number input), description (text), type (select: single/installment/recurring), conditional installments (number, shown when type=installment) / frequency (select, shown when type=recurring), categoryId (select from `useCategories`), cardId (select from `useCards`, rendering `<CardVisual size="sm" .../>` per option), purchaseDate (date input, default today). On submit, call `useCreateExpense().mutate(values, { onSuccess })`. Use `zodResolver(createExpenseSchema)` and `defaultValues: { type: 'single', purchaseDate: new Date(), amount: 0, description: '' }` per the spec.

- [ ] **Step 2: Write `src/components/app/manual-expense-dialog.tsx`**

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

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Once wired into `/inicio` (Task 32), open the dialog, submit an installment expense with invalid installments (e.g. 1), confirm the zod refine error shows under the field. Submit a valid one, confirm the dialog closes and a toast appears.

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/expense-form.tsx src/components/app/manual-expense-dialog.tsx
git commit -m "feat: add manual expense form and dialog fallback"
```

---

### Task 28: `occurrence-list.tsx` + `occurrence-row.tsx`

**Files:**
- Create: `src/components/app/occurrence-row.tsx`
- Create: `src/components/app/occurrence-list.tsx`

**Interfaces:**
- Consumes: `OccurrenceRow` type (Task 23); `formatBRL` (Task 10); `CardVisual` (Task 25)
- Produces: `<OccurrenceRow occurrence, onClick />`, `<OccurrenceList occurrences: OccurrenceRow[], showDateHeaders?: boolean, onSelect: (occurrence) => void />` — consumed by Task 32 (`/inicio`) and Task 33 (`/mes`).

- [ ] **Step 1: Write `src/components/app/occurrence-row.tsx`**

```tsx
import { formatBRL } from '@/lib/finance/money'
import { twMerge } from 'tailwind-merge'
import type { OccurrenceRow as OccurrenceRowData } from '@/hooks/use-occurrences'

export interface OccurrenceRowProps {
    occurrence: OccurrenceRowData
    onClick: () => void
}

export function OccurrenceRow({ occurrence, onClick }: OccurrenceRowProps) {
    return (
        <button
            type="button"
            data-slot="occurrence-row"
            data-status={occurrence.status}
            onClick={onClick}
            className={twMerge(
                'flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-muted',
                'data-[status=cancelled]:opacity-50',
            )}
        >
            <span className="text-foreground">
                {occurrence.description}
                {occurrence.installments_total ? ` (${occurrence.installment_number}/${occurrence.installments_total})` : ''}
            </span>
            <span className="font-medium text-foreground">{formatBRL(occurrence.amount)}</span>
        </button>
    )
}
```

- [ ] **Step 2: Write `src/components/app/occurrence-list.tsx`**

```tsx
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
        acc[occurrence.occurrence_date] = [...(acc[occurrence.occurrence_date] ?? []), occurrence]
        return acc
    }, {})

    return (
        <div data-slot="occurrence-list" className="flex flex-col gap-4">
            {Object.entries(grouped).map(([date, group]) => (
                <div key={date}>
                    <h3 className="px-3 pb-1 text-xs font-medium uppercase text-muted-foreground">{date}</h3>
                    {group.map((occurrence) => (
                        <OccurrenceRow key={occurrence.id} occurrence={occurrence} onClick={() => onSelect(occurrence)} />
                    ))}
                </div>
            ))}
        </div>
    )
}
```

- [ ] **Step 3: Verify**

```bash
pnpm build
```

Typecheck passes; visual verification happens once mounted in Task 32/33.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/occurrence-row.tsx src/components/app/occurrence-list.tsx
git commit -m "feat: add occurrence list and row components"
```

---

### Task 29: `occurrence-sheet.tsx`

**Files:**
- Create: `src/components/app/occurrence-sheet.tsx`

**Interfaces:**
- Consumes: `OccurrenceRow` type (Task 23); `useUpdateOccurrence`/`useDeleteOccurrence` (Task 23); shadcn `Sheet`/`Switch`/`Button` (Task 2)
- Produces: `<OccurrenceSheet occurrence: OccurrenceRow | null, onOpenChange />` — consumed by Task 32 (`/inicio`) and Task 33 (`/mes`).

- [ ] **Step 1: Write `src/components/app/occurrence-sheet.tsx`**

```tsx
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useUpdateOccurrence, useDeleteOccurrence, type OccurrenceRow } from '@/hooks/use-occurrences'

export interface OccurrenceSheetProps {
    occurrence: OccurrenceRow | null
    onOpenChange: (open: boolean) => void
}

const SCOPE_OPTIONS = [
    { value: 'occurrence', label: 'Só esta' },
    { value: 'future', label: 'Esta e as futuras' },
    { value: 'series', label: 'Toda a série' },
]

export function OccurrenceSheet({ occurrence, onOpenChange }: OccurrenceSheetProps) {
    const updateOccurrence = useUpdateOccurrence()
    const deleteOccurrence = useDeleteOccurrence()

    if (!occurrence) return null

    const hasScopes = Boolean(occurrence.installment_plan_id || occurrence.recurrence_id)
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
                                    input: { status: checked ? 'paid' : 'pending' },
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

- [ ] **Step 2: Verify manually**

Once wired into Task 32, click an occurrence row, toggle "Pago", confirm the row's amount styling updates (via `data-status`) after the list refetches. Delete an installment occurrence with scope "Esta e as futuras", confirm only that and later installments disappear.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/occurrence-sheet.tsx
git commit -m "feat: add occurrence edit/delete sheet with scope selection"
```

---

### Task 30: `summary-tiles.tsx` + `month-switcher.tsx`

**Files:**
- Create: `src/components/app/summary-tiles.tsx`
- Create: `src/components/app/month-switcher.tsx`

**Interfaces:**
- Consumes: `formatBRL` (Task 10); summary shape from `/api/reports/summary` (Task 24)
- Produces: `<SummaryTiles total, byCategory, byCard />`, `<MonthSwitcher month: string, onChange: (month: string) => void />` — consumed by Task 32 (`/inicio`), Task 33 (`/mes`), Task 34 (`/relatorios`).

- [ ] **Step 1: Write `src/components/app/summary-tiles.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/finance/money'

export interface SummaryTilesProps {
    total: number
    byCategory: Record<string, number>
    byCard: Record<string, number>
}

export function SummaryTiles({ total, byCategory, byCard }: SummaryTilesProps) {
    return (
        <div data-slot="summary-tiles" className="grid grid-cols-1 gap-3">
            <Card>
                <CardHeader>
                    <CardTitle>Total do mês</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-foreground">{formatBRL(total)}</CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Por categoria</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                    {Object.entries(byCategory).map(([id, amount]) => (
                        <div key={id} className="flex justify-between">
                            <span className="text-foreground-subtle">{id}</span>
                            <span className="text-foreground">{formatBRL(amount)}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Por cartão</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                    {Object.entries(byCard).map(([id, amount]) => (
                        <div key={id} className="flex justify-between">
                            <span className="text-foreground-subtle">{id}</span>
                            <span className="text-foreground">{formatBRL(amount)}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
```

(Task 34 resolves `id` to category/card names via `useCategories()`/`useCards()` lookups when composing the page — this component stays presentational and ID-keyed.)

- [ ] **Step 2: Write `src/components/app/month-switcher.tsx`**

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
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/app/summary-tiles.tsx src/components/app/month-switcher.tsx
git commit -m "feat: add summary tiles and month switcher components"
```

---

### Task 31: `bottom-nav.tsx` full wiring

**Files:**
- Modify: `src/components/app/bottom-nav.tsx` (Task 8 built the shell)

**Interfaces:**
- Consumes: `next/navigation` router (already used)
- Produces: central `+` focuses the quick-add on `/inicio` instead of only navigating there.

- [ ] **Step 1: Update the center button behavior**

Once Task 32 exists, `/inicio` reads a `?focus=quick-add` search param (via `useSearchParams`) and calls `.focus()` on the quick-add input ref when present. Update the center `Link` in `bottom-nav.tsx` (already pointing at `/inicio?focus=quick-add` from Task 8) — no change needed there; this step is in `/inicio` itself (Task 32) reading the param. Confirm via manual test once Task 32 lands.

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```

From `/mes`, tap the center `+`, confirm you land on `/inicio` with the quick-add input already focused (mobile keyboard would pop up on a real device).

- [ ] **Step 3: Commit**

Only commit if Step 1 required an actual code change beyond Task 8's `Link` — otherwise this task is verification-only and folds into Task 32's commit.

