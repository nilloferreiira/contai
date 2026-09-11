# Bolso MVP Implementation Plan — Section D: Domain layer

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
- Multi-tenant isolation and soft-deletes: Every query against user-owned tables (`cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, `expense_installments`) must filter by `eq(table.userId, session.user.id)` and `isNull(table.deletedAt)`. A delete is always an update setting `deletedAt = new Date()`.
- `expense_installments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/db/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

---

## Section D: Domain layer (`src/lib/finance/`, pure, tested)

### Task 10: `date.ts` + `money.ts`

**Files:**
- Create: `src/lib/finance/date.ts`
- Create: `src/lib/finance/money.ts`
- Create: `src/tests/date.test.ts`
- Create: `src/tests/money.test.ts`
- Create: `src/lib/finance/CLAUDE.md`

**Interfaces:**
- Consumes: nothing
- Produces: `toISODate(date: Date): string`, `monthKey(date: Date): string`, `clampDay(monthStart: Date, day: number): Date`, `formatBRL(amountInReais: number): string` — used by every domain function in Tasks 11-17.

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/date.test.ts
import { describe, expect, it } from 'vitest'
import { toISODate, monthKey, clampDay } from '@/lib/finance/date'

describe('toISODate', () => {
    it('formats a date as YYYY-MM-DD ignoring time', () => {
        expect(toISODate(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05')
    })
})

describe('monthKey', () => {
    it('formats a date as YYYY-MM', () => {
        expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01')
    })
})

describe('clampDay', () => {
    it('clamps day 31 to the last day of a 30-day month', () => {
        const result = clampDay(new Date(2026, 3, 1), 31) // April has 30 days
        expect(toISODate(result)).toBe('2026-04-30')
    })

    it('keeps the day when it fits in the month', () => {
        const result = clampDay(new Date(2026, 2, 1), 15)
        expect(toISODate(result)).toBe('2026-03-15')
    })
})
```

```ts
// src/tests/money.test.ts
import { describe, expect, it } from 'vitest'
import { formatBRL } from '@/lib/finance/money'

describe('formatBRL', () => {
    it('formats with the BRL symbol and comma decimal', () => {
        expect(formatBRL(1234.5)).toBe('R$ 1.234,50')
    })

    it('formats zero', () => {
        expect(formatBRL(0)).toBe('R$ 0,00')
    })
})
```

- [ ] **Step 2: Run and confirm both fail**

```bash
pnpm test src/tests/date.test.ts src/tests/money.test.ts
```

Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement `date.ts`**

```ts
// src/lib/finance/date.ts

export function toISODate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function monthKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
}

export function clampDay(monthStart: Date, day: number): Date {
    const year = monthStart.getFullYear()
    const month = monthStart.getMonth()
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(day, lastDayOfMonth))
}
```

- [ ] **Step 4: Implement `money.ts`**

```ts
// src/lib/finance/money.ts

export function formatBRL(amountInReais: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountInReais)
}
```

- [ ] **Step 5: Run and confirm both pass**

```bash
pnpm test src/tests/date.test.ts src/tests/money.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Write `src/lib/finance/CLAUDE.md`**

```markdown
# src/lib/finance

Pure domain logic — no database or ORM import allowed here. Every function is a
plain input→output transformation, unit-tested in `src/tests/`.

- `date.ts` / `money.ts` — primitives used by everything else.
- `invoice.ts` — closing/due-day math for a card cycle.
- `installments.ts` — splits a purchase into N occurrences; anchors each
  to purchase-month + i, NEVER to the due date (see spec section 6).
- `recurrence.ts` — generates recurring occurrences; compares calendar
  dates via `toISODate`, inclusive of the start day.
- `merchants.ts` — normalizes merchant names for dedup matching.
- `parser.ts` — deterministic natural-language expense parser.
- `dashboard.ts` — read-side aggregations over occurrences.
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/finance/date.ts src/lib/finance/money.ts src/lib/finance/CLAUDE.md src/tests/date.test.ts src/tests/money.test.ts
git commit -m "feat: add date and money domain primitives"
```

---

### Task 11: `invoice.ts`

**Files:**
- Create: `src/lib/finance/invoice.ts`
- Create: `src/tests/invoice.test.ts`

**Interfaces:**
- Consumes: `toISODate`, `monthKey`, `clampDay` from `date.ts` (Task 10)
- Produces: `CardCycle` type and `getInvoiceForExpense(purchaseDate: Date, card: CardCycle | null): { month: string; dueDate: Date }` — consumed by Task 12 (installments) and Task 22 (`/api/expenses`).

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/invoice.test.ts
import { describe, expect, it } from 'vitest'
import { getInvoiceForExpense, type CardCycle } from '@/lib/finance/invoice'
import { toISODate } from '@/lib/finance/date'

const card: CardCycle = { closing_day: 10, due_day: 20 }

describe('getInvoiceForExpense', () => {
    it('assigns a purchase before closing to the current month invoice', () => {
        const result = getInvoiceForExpense(new Date(2026, 2, 5), card) // March 5, closes on 10th
        expect(result.month).toBe('2026-03')
        expect(toISODate(result.dueDate)).toBe('2026-03-20')
    })

    it('assigns a purchase after closing to the next month invoice', () => {
        const result = getInvoiceForExpense(new Date(2026, 2, 15), card) // March 15, after closing
        expect(result.month).toBe('2026-04')
        expect(toISODate(result.dueDate)).toBe('2026-04-20')
    })

    it('rolls over the year when the purchase is in December after closing', () => {
        const result = getInvoiceForExpense(new Date(2026, 11, 15), card) // Dec 15
        expect(result.month).toBe('2027-01')
        expect(toISODate(result.dueDate)).toBe('2027-01-20')
    })

    it('falls back to the purchase month with no card', () => {
        const result = getInvoiceForExpense(new Date(2026, 2, 15), null)
        expect(result.month).toBe('2026-03')
        expect(toISODate(result.dueDate)).toBe('2026-03-15')
    })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm test src/tests/invoice.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `invoice.ts`**

```ts
// src/lib/finance/invoice.ts
import { clampDay, monthKey } from './date'

export interface CardCycle {
    closing_day: number
    due_day: number
}

export function getInvoiceForExpense(purchaseDate: Date, card: CardCycle | null) {
    if (!card) {
        return { month: monthKey(purchaseDate), dueDate: purchaseDate }
    }

    const afterClosing = purchaseDate.getDate() > card.closing_day
    const base = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + (afterClosing ? 1 : 0), 1)
    const dueDate = clampDay(base, card.due_day)

    return { month: monthKey(base), dueDate }
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm test src/tests/invoice.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/invoice.ts src/tests/invoice.test.ts
git commit -m "feat: add invoice closing/due date calculation"
```

---

### Task 12: `installments.ts`

**Files:**
- Create: `src/lib/finance/installments.ts`
- Create: `src/tests/installments.test.ts`

**Interfaces:**
- Consumes: `getInvoiceForExpense`, `CardCycle` from `invoice.ts` (Task 11); `toISODate` from `date.ts` (Task 10)
- Produces: `generateInstallments(total: number, count: number, purchaseDate: Date, card: CardCycle | null): InstallmentOccurrence[]` where `InstallmentOccurrence = { installment_number: number; installments_total: number; amount: number; occurrence_date: string; due_date: string; invoice_month: string }` — consumed by Task 22 (`/api/expenses`).

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/installments.test.ts
import { describe, expect, it } from 'vitest'
import { generateInstallments } from '@/lib/finance/installments'
import type { CardCycle } from '@/lib/finance/invoice'

const card: CardCycle = { closing_day: 10, due_day: 20 }

describe('generateInstallments', () => {
    it('anchors each installment to purchase-month + i, not the due date', () => {
        // Purchase on March 15 (after closing) in 3x — must NOT skip April.
        const result = generateInstallments(300, 3, new Date(2026, 2, 15), card)
        expect(result.map((r) => r.occurrence_date)).toEqual(['2026-03-15', '2026-04-01', '2026-05-01'])
        expect(result.map((r) => r.invoice_month)).toEqual(['2026-04', '2026-05', '2026-06'])
    })

    it('distributes remainder cents across the first installments', () => {
        const result = generateInstallments(100, 3, new Date(2026, 0, 1), card)
        expect(result.map((r) => r.amount)).toEqual([33.34, 33.33, 33.33])
        expect(result.reduce((sum, r) => sum + r.amount, 0)).toBeCloseTo(100, 2)
    })

    it('numbers installments starting at 1', () => {
        const result = generateInstallments(200, 2, new Date(2026, 5, 1), card)
        expect(result.map((r) => r.installment_number)).toEqual([1, 2])
        expect(result.every((r) => r.installments_total === 2)).toBe(true)
    })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm test src/tests/installments.test.ts
```

- [ ] **Step 3: Implement `installments.ts`**

```ts
// src/lib/finance/installments.ts
import { getInvoiceForExpense, type CardCycle } from './invoice'
import { toISODate } from './date'

export interface InstallmentOccurrence {
    installment_number: number
    installments_total: number
    amount: number
    occurrence_date: string
    due_date: string
    invoice_month: string
}

export function generateInstallments(
    total: number,
    count: number,
    purchaseDate: Date,
    card: CardCycle | null,
): InstallmentOccurrence[] {
    const cents = Math.round(total * 100)
    const base = Math.floor(cents / count)
    const rest = cents - base * count

    return Array.from({ length: count }, (_, i) => {
        const anchor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + i, i === 0 ? purchaseDate.getDate() : 1)
        const invoice = getInvoiceForExpense(anchor, card)

        return {
            installment_number: i + 1,
            installments_total: count,
            amount: (base + (i < rest ? 1 : 0)) / 100,
            occurrence_date: toISODate(anchor),
            due_date: toISODate(invoice.dueDate),
            invoice_month: invoice.month,
        }
    })
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm test src/tests/installments.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/installments.ts src/tests/installments.test.ts
git commit -m "feat: add installment splitting with purchase-month anchoring"
```

---

### Task 13: `recurrence.ts`

**Files:**
- Create: `src/lib/finance/recurrence.ts`
- Create: `src/tests/recurrence.test.ts`

**Interfaces:**
- Consumes: `toISODate` from `date.ts` (Task 10)
- Produces: `generateRecurrenceOccurrences(startDate: Date, frequency: 'weekly' | 'monthly' | 'yearly', untilDate: Date, endDate?: Date | null): string[]` (ISO date strings) — consumed by Task 22 (`/api/expenses`, recurring branch).

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/recurrence.test.ts
import { describe, expect, it } from 'vitest'
import { generateRecurrenceOccurrences } from '@/lib/finance/recurrence'

describe('generateRecurrenceOccurrences', () => {
    it('includes the start date itself', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 1), 'monthly', new Date(2026, 0, 1))
        expect(result).toEqual(['2026-01-01'])
    })

    it('generates monthly occurrences up to the until date', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 15), 'monthly', new Date(2026, 3, 15))
        expect(result).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15'])
    })

    it('generates weekly occurrences by calendar date, not by elapsed hours', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 1), 'weekly', new Date(2026, 0, 22))
        expect(result).toEqual(['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22'])
    })

    it('stops at an explicit end date even if before the until date', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 1), 'monthly', new Date(2026, 5, 1), new Date(2026, 1, 15))
        expect(result).toEqual(['2026-01-01', '2026-02-01'])
    })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm test src/tests/recurrence.test.ts
```

- [ ] **Step 3: Implement `recurrence.ts`**

```ts
// src/lib/finance/recurrence.ts
import { toISODate } from './date'

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export function generateRecurrenceOccurrences(
    startDate: Date,
    frequency: Frequency,
    untilDate: Date,
    endDate?: Date | null,
): string[] {
    const limit = endDate && endDate.getTime() < untilDate.getTime() ? endDate : untilDate
    const occurrences: string[] = []
    let current = new Date(startDate)

    while (toISODate(current) <= toISODate(limit)) {
        occurrences.push(toISODate(current))
        current = advance(current, frequency)
    }

    return occurrences
}

function advance(date: Date, frequency: Frequency): Date {
    if (frequency === 'weekly') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
    if (frequency === 'monthly') return new Date(date.getFullYear(), date.getMonth() + 1, date.getDate())
    return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate())
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm test src/tests/recurrence.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/recurrence.ts src/tests/recurrence.test.ts
git commit -m "feat: add recurrence occurrence generation"
```

---

### Task 14: `merchants.ts`

**Files:**
- Create: `src/lib/finance/merchants.ts`
- Create: `src/tests/merchants.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeMerchantName(raw: string): string` — consumed by Task 16 (parser part 2) and Task 20 (`/api/categories` seed) and Task 22 (`/api/expenses` merchant upsert).

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/merchants.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeMerchantName } from '@/lib/finance/merchants'

describe('normalizeMerchantName', () => {
    it('lowercases and strips accents', () => {
        expect(normalizeMerchantName('Americanas')).toBe('americanas')
        expect(normalizeMerchantName('Padaria São José')).toBe('padaria sao jose')
    })

    it('collapses extra whitespace', () => {
        expect(normalizeMerchantName('  Nubank   Pag  ')).toBe('nubank pag')
    })

    it('strips punctuation', () => {
        expect(normalizeMerchantName("McDonald's - Shopping")).toBe('mcdonalds shopping')
    })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm test src/tests/merchants.test.ts
```

- [ ] **Step 3: Implement `merchants.ts`**

```ts
// src/lib/finance/merchants.ts

export function normalizeMerchantName(raw: string): string {
    return raw
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm test src/tests/merchants.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/merchants.ts src/tests/merchants.test.ts
git commit -m "feat: add merchant name normalization"
```

---

### Task 15: `parser.ts` part 1 — valor, parcelas, recorrência, data

**Files:**
- Create: `src/lib/finance/parser.ts`
- Create: `src/tests/parser.test.ts`

**Interfaces:**
- Consumes: nothing yet (card/category/merchant matching comes in Task 16)
- Produces: `parseAmount(input: string): { value: number; remainder: string } | null`, `parseInstallmentCount(input: string): { count: number; remainder: string } | null`, `parseRecurrenceFrequency(input: string): { frequency: 'weekly' | 'monthly' | 'yearly'; remainder: string } | null`, `parseExplicitDate(input: string, today: Date): { date: Date; remainder: string } | null` — Task 16 imports all four and composes them into `parseExpenseInput`.

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/parser.test.ts
import { describe, expect, it } from 'vitest'
import { parseAmount, parseInstallmentCount, parseRecurrenceFrequency, parseExplicitDate } from '@/lib/finance/parser'

describe('parseAmount', () => {
    it('parses a plain integer', () => {
        expect(parseAmount('20 nubank alimentação')?.value).toBe(20)
    })

    it('parses comma decimal', () => {
        expect(parseAmount('netflix 55,90 todo mes')?.value).toBe(55.9)
    })

    it('parses dot-thousands + comma decimal', () => {
        expect(parseAmount('1.200,00 em 3x na americanas')?.value).toBe(1200)
    })

    it('parses an R$ prefix', () => {
        expect(parseAmount('R$ 47,90 uber')?.value).toBe(47.9)
    })

    it('returns null when there is no number', () => {
        expect(parseAmount('uber para o trabalho')).toBeNull()
    })
})

describe('parseInstallmentCount', () => {
    it('parses "3x"', () => {
        expect(parseInstallmentCount('1200 em 3x na americanas')?.count).toBe(3)
    })

    it('parses "3 vezes"', () => {
        expect(parseInstallmentCount('1200 3 vezes')?.count).toBe(3)
    })

    it('returns null when absent', () => {
        expect(parseInstallmentCount('netflix 55,90 todo mes')).toBeNull()
    })
})

describe('parseRecurrenceFrequency', () => {
    it('parses "todo mes" as monthly', () => {
        expect(parseRecurrenceFrequency('netflix 55,90 todo mes')?.frequency).toBe('monthly')
    })

    it('parses "toda semana" as weekly', () => {
        expect(parseRecurrenceFrequency('feira toda semana')?.frequency).toBe('weekly')
    })

    it('parses "anual" as yearly', () => {
        expect(parseRecurrenceFrequency('seguro anual')?.frequency).toBe('yearly')
    })
})

describe('parseExplicitDate', () => {
    const today = new Date(2026, 8, 9) // Sep 9 2026

    it('parses "hoje"', () => {
        expect(parseExplicitDate('mercado hoje', today)?.date.toDateString()).toBe(today.toDateString())
    })

    it('parses "ontem"', () => {
        const expected = new Date(2026, 8, 8)
        expect(parseExplicitDate('mercado ontem', today)?.date.toDateString()).toBe(expected.toDateString())
    })

    it('parses "dia 12" into the current month', () => {
        expect(parseExplicitDate('aluguel dia 12', today)?.date.toDateString()).toBe(new Date(2026, 8, 12).toDateString())
    })

    it('parses "12/09" as day/month', () => {
        expect(parseExplicitDate('aluguel 12/09', today)?.date.toDateString()).toBe(new Date(2026, 8, 12).toDateString())
    })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm test src/tests/parser.test.ts
```

- [ ] **Step 3: Implement part 1 of `parser.ts`**

```ts
// src/lib/finance/parser.ts

export function parseAmount(input: string): { value: number; remainder: string } | null {
    const match = input.match(/R\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/i)
    if (!match) return null

    const raw = match[1]
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
    const value = Number.parseFloat(normalized)
    if (Number.isNaN(value)) return null

    return { value, remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim() }
}

export function parseInstallmentCount(input: string): { count: number; remainder: string } | null {
    const match = input.match(/\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes)\b/i)
    if (!match) return null

    return {
        count: Number.parseInt(match[1], 10),
        remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim(),
    }
}

const RECURRENCE_PATTERNS: Array<{ pattern: RegExp; frequency: 'weekly' | 'monthly' | 'yearly' }> = [
    { pattern: /\btoda\s+semana\b|\bsemanal\b/i, frequency: 'weekly' },
    { pattern: /\btodo\s+m[eê]s\b|\bmensal\b/i, frequency: 'monthly' },
    { pattern: /\banual\b|\btodo\s+ano\b/i, frequency: 'yearly' },
]

export function parseRecurrenceFrequency(input: string): { frequency: 'weekly' | 'monthly' | 'yearly'; remainder: string } | null {
    for (const { pattern, frequency } of RECURRENCE_PATTERNS) {
        const match = input.match(pattern)
        if (match) {
            return {
                frequency,
                remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim(),
            }
        }
    }
    return null
}

export function parseExplicitDate(input: string, today: Date): { date: Date; remainder: string } | null {
    const strip = (match: RegExpMatchArray) =>
        (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim()

    const hoje = input.match(/\bhoje\b/i)
    if (hoje) return { date: new Date(today), remainder: strip(hoje) }

    const ontem = input.match(/\bontem\b/i)
    if (ontem) return { date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), remainder: strip(ontem) }

    const diaMatch = input.match(/\bdia\s+(\d{1,2})\b/i)
    if (diaMatch) {
        return {
            date: new Date(today.getFullYear(), today.getMonth(), Number.parseInt(diaMatch[1], 10)),
            remainder: strip(diaMatch),
        }
    }

    const slashMatch = input.match(/\b(\d{1,2})\/(\d{1,2})\b/)
    if (slashMatch) {
        return {
            date: new Date(today.getFullYear(), Number.parseInt(slashMatch[2], 10) - 1, Number.parseInt(slashMatch[1], 10)),
            remainder: strip(slashMatch),
        }
    }

    return null
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm test src/tests/parser.test.ts
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/parser.ts src/tests/parser.test.ts
git commit -m "feat: add parser primitives for amount, installments, recurrence, date"
```

---

### Task 16: `parser.ts` part 2 — cartão, categoria, merchant, `parseExpenseInput`

**Files:**
- Modify: `src/lib/finance/parser.ts`
- Modify: `src/tests/parser.test.ts`

**Interfaces:**
- Consumes: `parseAmount`, `parseInstallmentCount`, `parseRecurrenceFrequency`, `parseExplicitDate` (Task 15); `normalizeMerchantName` (Task 14)
- Produces: `ParsedExpense` type and `parseExpenseInput(input: string, context: ParserContext, today: Date): ParsedExpense`, where `ParserContext = { cards: { id: string; name: string }[]; categories: { id: string; name: string }[]; merchants: { id: string; normalized_name: string; display_name: string; default_category_id: string | null; default_card_id: string | null }[] }` — consumed by Task 26 (`quick-add.tsx`).

- [ ] **Step 1: Add failing tests to `parser.test.ts`**

```ts
// append to src/tests/parser.test.ts
import { parseExpenseInput, type ParserContext } from '@/lib/finance/parser'

const context: ParserContext = {
    cards: [{ id: 'card-1', name: 'Nubank' }],
    categories: [
        { id: 'cat-1', name: 'Alimentação' },
        { id: 'cat-2', name: 'Alimentação Fora' },
    ],
    merchants: [
        { id: 'merch-1', normalized_name: 'americanas', display_name: 'Americanas', default_category_id: 'cat-1', default_card_id: 'card-1' },
    ],
}

describe('parseExpenseInput', () => {
    const today = new Date(2026, 8, 9)

    it('extracts amount, installments, card, and merchant', () => {
        const result = parseExpenseInput('1200 em 3x na americanas no nubank', context, today)
        expect(result.amount).toBe(1200)
        expect(result.installments).toBe(3)
        expect(result.cardId).toBe('card-1')
        expect(result.merchantName).toBe('americanas')
        expect(result.ambiguous).toBe(false)
    })

    it('prefers the longest explicit category match over a shorter one', () => {
        const result = parseExpenseInput('20 alimentação fora', context, today)
        expect(result.categoryId).toBe('cat-2')
    })

    it('applies the merchant default category/card when merchant is known', () => {
        const result = parseExpenseInput('50 americanas', context, today)
        expect(result.categoryId).toBe('cat-1')
        expect(result.cardId).toBe('card-1')
    })

    it('flags ambiguous when there is no amount', () => {
        const result = parseExpenseInput('almoço no shopping', context, today)
        expect(result.ambiguous).toBe(true)
        expect(result.amount).toBeNull()
    })

    it('carries the recurrence frequency through', () => {
        const result = parseExpenseInput('netflix 55,90 todo mes', context, today)
        expect(result.frequency).toBe('monthly')
        expect(result.merchantName).toBe('netflix')
    })
})
```

- [ ] **Step 2: Run and confirm the new tests fail**

```bash
pnpm test src/tests/parser.test.ts
```

- [ ] **Step 3: Append part 2 to `parser.ts`**

```ts
// append to src/lib/finance/parser.ts
import { normalizeMerchantName } from './merchants'

export interface ParserCard {
    id: string
    name: string
}

export interface ParserCategory {
    id: string
    name: string
}

export interface ParserMerchant {
    id: string
    normalized_name: string
    display_name: string
    default_category_id: string | null
    default_card_id: string | null
}

export interface ParserContext {
    cards: ParserCard[]
    categories: ParserCategory[]
    merchants: ParserMerchant[]
}

export interface ParsedExpense {
    amount: number | null
    installments: number | null
    frequency: 'weekly' | 'monthly' | 'yearly' | null
    cardId: string | null
    categoryId: string | null
    merchantName: string | null
    purchaseDate: Date
    ambiguous: boolean
}

function matchCard(input: string, cards: ParserCard[]): { id: string; remainder: string } | null {
    for (const card of cards) {
        const pattern = new RegExp(`\\b${escapeRegExp(card.name)}\\b`, 'i')
        const match = input.match(pattern)
        if (match) {
            return { id: card.id, remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim() }
        }
    }
    return null
}

function matchExplicitCategory(input: string, categories: ParserCategory[]): { id: string; remainder: string } | null {
    const sorted = [...categories].sort((a, b) => b.name.length - a.name.length)
    for (const category of sorted) {
        const pattern = new RegExp(`\\b${escapeRegExp(category.name)}\\b`, 'i')
        const match = input.match(pattern)
        if (match) {
            return { id: category.id, remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim() }
        }
    }
    return null
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseExpenseInput(input: string, context: ParserContext, today: Date): ParsedExpense {
    let remainder = input

    const amountResult = parseAmount(remainder)
    if (amountResult) remainder = amountResult.remainder

    const installmentResult = parseInstallmentCount(remainder)
    if (installmentResult) remainder = installmentResult.remainder

    const recurrenceResult = parseRecurrenceFrequency(remainder)
    if (recurrenceResult) remainder = recurrenceResult.remainder

    const cardResult = matchCard(remainder, context.cards)
    if (cardResult) remainder = cardResult.remainder

    const categoryResult = matchExplicitCategory(remainder, context.categories)
    if (categoryResult) remainder = categoryResult.remainder

    const dateResult = parseExplicitDate(remainder, today)
    if (dateResult) remainder = dateResult.remainder

    const merchantName = remainder.trim() || null
    const matchedMerchant = merchantName
        ? context.merchants.find((m) => m.normalized_name === normalizeMerchantName(merchantName))
        : undefined

    return {
        amount: amountResult?.value ?? null,
        installments: installmentResult?.count ?? null,
        frequency: recurrenceResult?.frequency ?? null,
        cardId: cardResult?.id ?? matchedMerchant?.default_card_id ?? null,
        categoryId: categoryResult?.id ?? matchedMerchant?.default_category_id ?? null,
        merchantName: merchantName ? normalizeMerchantName(merchantName) : null,
        purchaseDate: dateResult?.date ?? today,
        ambiguous: amountResult === null,
    }
}
```

- [ ] **Step 4: Run and confirm all parser tests pass**

```bash
pnpm test src/tests/parser.test.ts
```

Expected: PASS, 20 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/parser.ts src/tests/parser.test.ts
git commit -m "feat: add card/category/merchant matching to the expense parser"
```

---

### Task 17: `dashboard.ts`

**Files:**
- Create: `src/lib/finance/dashboard.ts`
- Create: `src/tests/dashboard.test.ts`

**Interfaces:**
- Consumes: nothing (operates on plain occurrence objects)
- Produces: `Occurrence` type, `summarizeMonth(occurrences: Occurrence[]): { total: number; byCategory: Record<string, number>; byCard: Record<string, number> }` — consumed by Task 24 (`/api/reports/summary`).

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/dashboard.test.ts
import { describe, expect, it } from 'vitest'
import { summarizeMonth, type Occurrence } from '@/lib/finance/dashboard'

const occurrences: Occurrence[] = [
    { amount: 100, category_id: 'cat-1', card_id: 'card-1', status: 'pending' },
    { amount: 50, category_id: 'cat-1', card_id: 'card-2', status: 'paid' },
    { amount: 30, category_id: 'cat-2', card_id: 'card-1', status: 'pending' },
    { amount: 20, category_id: null, card_id: null, status: 'cancelled' },
]

describe('summarizeMonth', () => {
    it('sums the total excluding cancelled occurrences', () => {
        expect(summarizeMonth(occurrences).total).toBe(180)
    })

    it('groups by category excluding cancelled', () => {
        expect(summarizeMonth(occurrences).byCategory).toEqual({ 'cat-1': 150, 'cat-2': 30 })
    })

    it('groups by card excluding cancelled', () => {
        expect(summarizeMonth(occurrences).byCard).toEqual({ 'card-1': 130, 'card-2': 50 })
    })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm test src/tests/dashboard.test.ts
```

- [ ] **Step 3: Implement `dashboard.ts`**

```ts
// src/lib/finance/dashboard.ts

export interface Occurrence {
    amount: number
    category_id: string | null
    card_id: string | null
    status: 'pending' | 'paid' | 'cancelled'
}

export function summarizeMonth(occurrences: Occurrence[]) {
    const active = occurrences.filter((o) => o.status !== 'cancelled')

    const total = active.reduce((sum, o) => sum + o.amount, 0)

    const byCategory: Record<string, number> = {}
    const byCard: Record<string, number> = {}

    for (const occurrence of active) {
        if (occurrence.category_id) {
            byCategory[occurrence.category_id] = (byCategory[occurrence.category_id] ?? 0) + occurrence.amount
        }
        if (occurrence.card_id) {
            byCard[occurrence.card_id] = (byCard[occurrence.card_id] ?? 0) + occurrence.amount
        }
    }

    return { total, byCategory, byCard }
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm test src/tests/dashboard.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full domain test suite**

```bash
pnpm test
```

Expected: all domain tests pass (Tasks 10-17 combined, 40+ tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance/dashboard.ts src/tests/dashboard.test.ts
git commit -m "feat: add month summary aggregation"
```

