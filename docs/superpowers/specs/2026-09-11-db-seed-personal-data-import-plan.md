# DB Seed — Personal Finance Data Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This plan adds **Task 17b** to the master Bolso MVP implementation plan
> (`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`), to be
> appended immediately after Task 17 in
> `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-d-domain-layer.md`
> (no other task numbers shift). It cannot run before Section D
> (Tasks 10-17) is complete — it depends directly on the pure functions
> those tasks produce.

**Goal:** Add a `pnpm db:seed <userId>` command that loads one real user's
financial history (cards, categories, merchants, expenses, installment
plans, recurrences, and their generated occurrences) into the Bolso
Postgres/Drizzle database, for an existing user who has no data yet.

**Architecture:** A standalone Node script (`scripts/seed.ts`, run via
`tsx`, not part of the Next.js app bundle) reads a typed fixture
(`scripts/seed-data/finance-profile.ts`), inserts cards → categories →
merchants → expenses/installment-plans/recurrences via Drizzle ORM in
dependency order, and generates every `expense_installments` occurrence by
calling the same pure domain functions the app itself uses
(`getInvoiceForExpense`, `generateInstallments`,
`generateRecurrenceOccurrences` from `src/lib/finance/`) rather than
hand-transcribing historical rows.

**Tech Stack:** TypeScript, `tsx` (script runner), Drizzle ORM, the
project's own `src/lib/finance/` domain layer and `src/db/schema`.

**Spec:** `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`; master
plan `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`;
domain-layer task detail `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-d-domain-layer.md`.

## Global Constraints

(Copied verbatim from the master plan — apply to this task too.)

- Files: lowercase-with-hyphens (`user-card.tsx`, `use-modal.ts`).
- Always named exports, never `export default` — except `page.tsx`,
  `layout.tsx`, and `route.ts` handlers, which Next.js requires. (`scripts/`
  is outside the Next.js app tree and is exempt — its executable script
  needs a runnable `main()` but still uses named exports for the fixture.)
- No barrel files (`index.ts`) for internal folders (except
  `src/db/schema/index.ts`).
- No hardcoded colors outside `globals.css` tokens — not applicable to this
  task (no UI).
- TypeScript: never `React.FC`, never `any`; type-only imports.
- Multi-tenant isolation and soft-deletes: every user-owned table query
  filters by `eq(table.userId, session.user.id)` / here, the CLI-supplied
  `targetUserId` and `isNull(table.deletedAt)`.
- `expense_installments` (occurrences) is what all UI/reports read — never
  `expenses` directly. This script is the one place besides the domain
  layer allowed to reason about how occurrences are derived.
- Installments anchor to **purchase month + i**, never to the due date.
  Recurrence compares **calendar dates**, inclusive of the start day.

---

## Context

The user has a SQL dump exported from their live (pre-migration) Supabase
database — real financial history for their own account — and wants it
loaded into the new Postgres/Drizzle database via a `pnpm db:seed <userId>`
command instead of raw SQL, using the project's own architecture (Drizzle,
not `psql`).

The pasted SQL had every `old_id` column set to `NULL` in its temp tables,
which would have made every relational `LEFT JOIN` fail silently and insert
every foreign key as `NULL` (cards/categories/merchants would exist but
every expense/occurrence would be orphaned). This was investigated and
resolved directly with the user:

- **Merchants, expenses, installment plans, recurrences**: fully
  reconstructable from the dump — every reference to them carries a
  matching `description`/`amount`/`purchase_date` that uniquely identifies
  the row, so no data was lost.
- **Cards** (3, no textual anchor in the data) — user confirmed:
  `f8a6a60c-e477-450f-a3fe-bb00129ff05f` = Inter,
  `462df91d-91fa-45d1-841d-655fddcc501c` = Picpay,
  `442b7a07-f579-4fe8-b791-4206ac47a63d` = Nubank.
- **Categories** (2 ambiguous of 13) — user confirmed:
  `f4fa4adf-d4b8-46ce-8942-9ff5cdc26728` = Outros (Celular, Petrox July —
  **not** Anthropic, see override below),
  `ad3ae14f-9ea1-4929-b502-e48a1800ad86` = Trabalho (Mei, Google ai Pro,
  Linedin Premium). User explicitly overrode Anthropic's category to
  **Trabalho** (not Outros) — the dump's duplicate Anthropic occurrence
  block under `f4fa4adf` was stale data from before that recategorization.

**Key design decision:** rather than transcribing the ~150 individual
`expense_installments` rows from the dump, the seed script generates them
by calling the exact same pure functions Section D builds —
`generateInstallments` (Task 12), `generateRecurrenceOccurrences`
(Task 13), and `getInvoiceForExpense` (Task 11) — from just the 12
expenses + 8 recurrences. This was verified line-by-line against the dump
(e.g. the 46.33/46.33/46.32 cent-remainder split on the "Presente Pai"
installment plan, and the closing-day rollover on "Farmácia" landing in
October) — the domain functions reproduce the real data exactly. This is
why the task must come **after** Section D (it needs those functions to
exist).

**Schema note surfaced during this design:**
`expense_installments.expense_id` is `NOT NULL` (Task 9 schema), but
recurring occurrences in the dump have no backing `expenses` row
(`old_expense_id` is always `NULL` for them — the old schema allowed this).
Resolution: give every recurrence a companion `expenses` row too
(`type: 'recurring'`), consistent with that enum value already existing in
the Task 9 schema. Each generated occurrence then sets both `expenseId`
(→ that row) and `recurrenceId` (→ the recurrence), keeping
`expense_installments.expense_id` `NOT NULL` satisfied for every occurrence
kind without a schema change.

The seed assumes the target user already exists (created via `/cadastro`);
it does not create the `user` row itself. It aborts if the user doesn't
exist, and aborts if the user already has any
cards/categories/merchants/expenses (idempotency guard, same intent as the
original SQL's check) — notably, this means `db:seed` must run **before**
the user's first `/api/categories` call, since Task 20's automatic
default-category seed would otherwise trip this guard.

## Task 1: `pnpm db:seed <userId>` personal data import script

**Files:**
- Create: `scripts/seed-data/finance-profile.ts` — resolved fixture data
- Create: `scripts/seed.ts` — the executable seed script
- Modify: `package.json` — add `db:seed` script, add `tsx` dev dependency

**Interfaces:**
- Consumes: `db` from `src/db/index.ts` (Task 5); `cards`, `categories`,
  `merchants`, `expenses`, `installmentPlans`, `recurrences`,
  `expenseInstallments`, `user` from `src/db/schema` (Task 9);
  `toISODate` from `src/lib/finance/date.ts` (Task 10);
  `getInvoiceForExpense`, `type CardCycle` from `src/lib/finance/invoice.ts`
  (Task 11); `generateInstallments` from `src/lib/finance/installments.ts`
  (Task 12); `generateRecurrenceOccurrences` from
  `src/lib/finance/recurrence.ts` (Task 13).
- Produces: a dev-only CLI command (`pnpm db:seed <userId>`); not imported
  by any app code.

- [ ] **Step 1: Add `tsx`**

```bash
pnpm add -D tsx
```

- [ ] **Step 2: Write `scripts/seed-data/finance-profile.ts`**

```ts
// scripts/seed-data/finance-profile.ts

export interface SeedCard {
    key: string
    name: string
    closingDay: number
    dueDay: number
    creditLimit: string | null
    color: string
}

export interface SeedCategory {
    key: string
    name: string
    icon: string
}

export interface SeedMerchant {
    key: string
    displayName: string
    normalizedName: string
    categoryKey: string | null
    cardKey: string | null
    usageCount: number
}

export interface SeedExpense {
    key: string
    merchantKey: string
    categoryKey: string
    cardKey: string
    description: string
    totalAmount: string
    purchaseDate: string
    type: 'single' | 'installment'
    installments?: number
}

export interface SeedRecurrence {
    key: string
    merchantKey: string | null
    categoryKey: string | null
    cardKey: string | null
    description: string
    amount: string
    frequency: 'weekly' | 'monthly' | 'yearly'
    startDate: string
    endDate: string | null
}

export const seedCards: SeedCard[] = [
    { key: 'inter', name: 'Inter', closingDay: 5, dueDay: 10, creditLimit: '2000.00', color: 'oklch(0.65 0.21 38)' },
    { key: 'picpay', name: 'Picpay', closingDay: 5, dueDay: 10, creditLimit: '2000.00', color: 'oklch(0.58 0.16 150)' },
    { key: 'nubank', name: 'Nubank', closingDay: 5, dueDay: 10, creditLimit: null, color: 'oklch(0.5 0.24 300)' },
]

export const seedCategories: SeedCategory[] = [
    { key: 'assinaturas', name: 'Assinaturas', icon: '📺' },
    { key: 'transporte', name: 'Transporte', icon: '🚗' },
    { key: 'mercado', name: 'Mercado', icon: '🛒' },
    { key: 'compras', name: 'Compras', icon: '🛍️' },
    { key: 'casa', name: 'Casa', icon: '🏠' },
    { key: 'alimentacao', name: 'Alimentação', icon: '🍔' },
    { key: 'lazer', name: 'Lazer', icon: '🎮' },
    { key: 'saude', name: 'Saúde', icon: '💊' },
    { key: 'educacao', name: 'Educação', icon: '📚' },
    { key: 'contas', name: 'Contas', icon: '🧾' },
    { key: 'viagem', name: 'Viagem', icon: '✈️' },
    { key: 'outros', name: 'Outros', icon: '📦' },
    { key: 'trabalho', name: 'Trabalho', icon: '💻' },
]

export const seedMerchants: SeedMerchant[] = [
    { key: 'netflix', displayName: 'Netflix', normalizedName: 'netflix', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'cadeira', displayName: 'Cadeira', normalizedName: 'cadeira', categoryKey: 'compras', cardKey: 'picpay', usageCount: 2 },
    { key: 'amazon', displayName: 'amazon', normalizedName: 'amazon', categoryKey: 'compras', cardKey: 'inter', usageCount: 2 },
    { key: 'ifood', displayName: 'ifood', normalizedName: 'ifood', categoryKey: 'alimentacao', cardKey: 'inter', usageCount: 3 },
    { key: 'pos-graduacao', displayName: 'Pos Graducao', normalizedName: 'pos graducao', categoryKey: 'educacao', cardKey: 'inter', usageCount: 1 },
    { key: 'anthropic', displayName: 'Anthropic', normalizedName: 'anthropic', categoryKey: 'trabalho', cardKey: 'inter', usageCount: 1 },
    { key: 'spotify', displayName: 'Spotify', normalizedName: 'spotify', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'celular', displayName: 'Celular', normalizedName: 'celular', categoryKey: 'outros', cardKey: 'nubank', usageCount: 1 },
    { key: 'mei', displayName: 'Mei', normalizedName: 'mei', categoryKey: 'trabalho', cardKey: null, usageCount: 1 },
    { key: 'youtube-premium', displayName: 'Youtube Premium', normalizedName: 'youtube premium', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'google-drive', displayName: 'Google Drive', normalizedName: 'google drive', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'linkedin-premium', displayName: 'Linedin Premium', normalizedName: 'linedin premium', categoryKey: 'trabalho', cardKey: 'inter', usageCount: 1 },
    { key: 'shopee', displayName: 'Sla oq Shopee', normalizedName: 'sla oq shopee', categoryKey: 'compras', cardKey: 'picpay', usageCount: 2 },
    { key: 'atalaia-racoes', displayName: 'Atalaia Racoes', normalizedName: 'atalaia racoes', categoryKey: 'compras', cardKey: 'picpay', usageCount: 1 },
    { key: 'presente-pai', displayName: 'Presente Pai', normalizedName: 'presente pai', categoryKey: 'compras', cardKey: 'picpay', usageCount: 2 },
    { key: 'farmacia', displayName: 'Farmácia', normalizedName: 'farmacia', categoryKey: 'saude', cardKey: 'inter', usageCount: 1 },
    { key: 'google-ai-pro', displayName: 'Google ai Pro', normalizedName: 'google ai pro', categoryKey: 'trabalho', cardKey: 'inter', usageCount: 1 },
    { key: 'temakezin', displayName: 'Temakezin', normalizedName: 'temakezin', categoryKey: 'alimentacao', cardKey: 'inter', usageCount: 1 },
    { key: 'petrox-july', displayName: 'Petrox July', normalizedName: 'petrox july', categoryKey: 'outros', cardKey: 'inter', usageCount: 1 },
    { key: 'presente-july-sapatos', displayName: 'Presente July Sapatos', normalizedName: 'presente july sapatos', categoryKey: 'compras', cardKey: 'inter', usageCount: 1 },
    { key: 'hotel-salvador', displayName: 'Hotel Salvador', normalizedName: 'hotel salvador', categoryKey: 'viagem', cardKey: 'inter', usageCount: 1 },
]

export const seedExpenses: SeedExpense[] = [
    { key: 'celular-plano', merchantKey: 'celular', categoryKey: 'outros', cardKey: 'nubank', description: 'Celular', totalAmount: '7956.00', purchaseDate: '2025-04-11', type: 'installment', installments: 24 },
    { key: 'shopee-1', merchantKey: 'shopee', categoryKey: 'compras', cardKey: 'picpay', description: 'Sla oq Shopee', totalAmount: '87.93', purchaseDate: '2026-08-16', type: 'installment', installments: 3 },
    { key: 'atalaia-racoes-1', merchantKey: 'atalaia-racoes', categoryKey: 'compras', cardKey: 'picpay', description: 'Atalaia Racoes', totalAmount: '188.43', purchaseDate: '2026-08-01', type: 'installment', installments: 3 },
    { key: 'presente-pai-1', merchantKey: 'presente-pai', categoryKey: 'compras', cardKey: 'picpay', description: 'Presente Pai', totalAmount: '89.96', purchaseDate: '2026-07-05', type: 'installment', installments: 4 },
    { key: 'presente-pai-2', merchantKey: 'presente-pai', categoryKey: 'compras', cardKey: 'picpay', description: 'Presente Pai', totalAmount: '138.98', purchaseDate: '2026-07-05', type: 'installment', installments: 3 },
    { key: 'cadeira-1', merchantKey: 'cadeira', categoryKey: 'compras', cardKey: 'picpay', description: 'Cadeira', totalAmount: '1279.00', purchaseDate: '2026-05-16', type: 'installment', installments: 10 },
    { key: 'farmacia-1', merchantKey: 'farmacia', categoryKey: 'saude', cardKey: 'inter', description: 'Farmácia', totalAmount: '52.65', purchaseDate: '2026-09-08', type: 'single' },
    { key: 'google-ai-pro-1', merchantKey: 'google-ai-pro', categoryKey: 'trabalho', cardKey: 'inter', description: 'Google ai Pro', totalAmount: '48.49', purchaseDate: '2026-09-11', type: 'single' },
    { key: 'temakezin-1', merchantKey: 'temakezin', categoryKey: 'alimentacao', cardKey: 'inter', description: 'Temakezin', totalAmount: '38.49', purchaseDate: '2026-09-07', type: 'single' },
    { key: 'petrox-july-1', merchantKey: 'petrox-july', categoryKey: 'outros', cardKey: 'inter', description: 'Petrox July', totalAmount: '43.00', purchaseDate: '2026-09-03', type: 'single' },
    { key: 'presente-july-sapatos-1', merchantKey: 'presente-july-sapatos', categoryKey: 'compras', cardKey: 'inter', description: 'Presente July Sapatos', totalAmount: '114.27', purchaseDate: '2026-08-11', type: 'installment', installments: 3 },
    { key: 'hotel-salvador-1', merchantKey: 'hotel-salvador', categoryKey: 'viagem', cardKey: 'inter', description: 'Hotel Salvador', totalAmount: '833.76', purchaseDate: '2026-09-11', type: 'installment', installments: 6 },
]

export const seedRecurrences: SeedRecurrence[] = [
    { key: 'netflix-rec', merchantKey: 'netflix', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Netflix', amount: '45.00', frequency: 'monthly', startDate: '2026-09-09', endDate: null },
    { key: 'pos-graduacao-rec', merchantKey: 'pos-graduacao', categoryKey: 'educacao', cardKey: 'inter', description: 'Pos Graducao', amount: '500.00', frequency: 'monthly', startDate: '2026-01-25', endDate: '2027-01-25' },
    { key: 'anthropic-rec', merchantKey: 'anthropic', categoryKey: 'trabalho', cardKey: 'inter', description: 'Anthropic', amount: '110.00', frequency: 'monthly', startDate: '2026-04-25', endDate: null },
    { key: 'spotify-rec', merchantKey: 'spotify', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Spotify', amount: '31.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'mei-rec', merchantKey: 'mei', categoryKey: 'trabalho', cardKey: null, description: 'Mei', amount: '85.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'youtube-premium-rec', merchantKey: 'youtube-premium', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Youtube Premium', amount: '34.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'google-drive-rec', merchantKey: 'google-drive', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Google Drive', amount: '8.90', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'linkedin-premium-rec', merchantKey: 'linkedin-premium', categoryKey: 'trabalho', cardKey: 'inter', description: 'Linedin Premium', amount: '36.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
]
```

- [ ] **Step 3: Write `scripts/seed.ts`**

```ts
// scripts/seed.ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { cards, categories, expenseInstallments, expenses, installmentPlans, merchants, recurrences, user } from '@/db/schema'
import { toISODate } from '@/lib/finance/date'
import { generateInstallments } from '@/lib/finance/installments'
import { getInvoiceForExpense, type CardCycle } from '@/lib/finance/invoice'
import { generateRecurrenceOccurrences } from '@/lib/finance/recurrence'
import { seedCards, seedCategories, seedExpenses, seedMerchants, seedRecurrences } from './seed-data/finance-profile'

function addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function cardCycleFor(cardKey: string | null): CardCycle | null {
    if (!cardKey) return null
    const card = seedCards.find((c) => c.key === cardKey)!
    return { closing_day: card.closingDay, due_day: card.dueDay }
}

async function main() {
    const targetUserId = process.argv[2]
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!targetUserId || !uuidPattern.test(targetUserId)) {
        console.error('Uso: pnpm db:seed <userId>')
        process.exit(1)
    }

    const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetUserId))
    if (!existingUser) {
        throw new Error(`Usuário ${targetUserId} não existe. Crie a conta antes de aplicar o seed.`)
    }

    const [hasCard] = await db.select({ id: cards.id }).from(cards).where(eq(cards.userId, targetUserId))
    const [hasCategory] = await db.select({ id: categories.id }).from(categories).where(eq(categories.userId, targetUserId))
    const [hasMerchant] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.userId, targetUserId))
    const [hasExpense] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.userId, targetUserId))
    if (hasCard || hasCategory || hasMerchant || hasExpense) {
        throw new Error(`Usuário ${targetUserId} já possui dados financeiros. Seed cancelado para evitar duplicação.`)
    }

    const cardIdByKey = new Map<string, string>()
    for (const card of seedCards) {
        const [row] = await db
            .insert(cards)
            .values({ userId: targetUserId, name: card.name, closingDay: card.closingDay, dueDay: card.dueDay, creditLimit: card.creditLimit, color: card.color })
            .returning({ id: cards.id })
        cardIdByKey.set(card.key, row.id)
    }

    const categoryIdByKey = new Map<string, string>()
    for (const category of seedCategories) {
        const [row] = await db
            .insert(categories)
            .values({ userId: targetUserId, name: category.name, icon: category.icon })
            .returning({ id: categories.id })
        categoryIdByKey.set(category.key, row.id)
    }

    const merchantIdByKey = new Map<string, string>()
    for (const merchant of seedMerchants) {
        const [row] = await db
            .insert(merchants)
            .values({
                userId: targetUserId,
                displayName: merchant.displayName,
                normalizedName: merchant.normalizedName,
                defaultCategoryId: merchant.categoryKey ? categoryIdByKey.get(merchant.categoryKey) : null,
                defaultCardId: merchant.cardKey ? cardIdByKey.get(merchant.cardKey) : null,
                usageCount: merchant.usageCount,
            })
            .returning({ id: merchants.id })
        merchantIdByKey.set(merchant.key, row.id)
    }

    for (const expense of seedExpenses) {
        const merchantId = merchantIdByKey.get(expense.merchantKey) ?? null
        const categoryId = categoryIdByKey.get(expense.categoryKey) ?? null
        const cardId = cardIdByKey.get(expense.cardKey) ?? null
        const cardCycle = cardCycleFor(expense.cardKey)
        const purchaseDate = new Date(`${expense.purchaseDate}T00:00:00`)

        const [expenseRow] = await db
            .insert(expenses)
            .values({
                userId: targetUserId,
                type: expense.type,
                description: expense.description,
                merchantId,
                categoryId,
                cardId,
                totalAmount: expense.totalAmount,
                purchaseDate: expense.purchaseDate,
            })
            .returning({ id: expenses.id })

        if (expense.type === 'single') {
            const invoice = getInvoiceForExpense(purchaseDate, cardCycle)
            await db.insert(expenseInstallments).values({
                userId: targetUserId,
                expenseId: expenseRow.id,
                merchantId,
                categoryId,
                cardId,
                description: expense.description,
                installmentNumber: 1,
                installmentsTotal: 1,
                amount: expense.totalAmount,
                occurrenceDate: expense.purchaseDate,
                dueDate: toISODate(invoice.dueDate),
                invoiceMonth: invoice.month,
            })
            continue
        }

        const [planRow] = await db
            .insert(installmentPlans)
            .values({ userId: targetUserId, expenseId: expenseRow.id, installmentsTotal: expense.installments! })
            .returning({ id: installmentPlans.id })

        const occurrences = generateInstallments(Number(expense.totalAmount), expense.installments!, purchaseDate, cardCycle)
        await db.insert(expenseInstallments).values(
            occurrences.map((occ) => ({
                userId: targetUserId,
                expenseId: expenseRow.id,
                installmentPlanId: planRow.id,
                merchantId,
                categoryId,
                cardId,
                description: expense.description,
                installmentNumber: occ.installment_number,
                installmentsTotal: occ.installments_total,
                amount: occ.amount.toFixed(2),
                occurrenceDate: occ.occurrence_date,
                dueDate: occ.due_date,
                invoiceMonth: occ.invoice_month,
            })),
        )
    }

    for (const recurrence of seedRecurrences) {
        const merchantId = recurrence.merchantKey ? merchantIdByKey.get(recurrence.merchantKey) ?? null : null
        const categoryId = recurrence.categoryKey ? categoryIdByKey.get(recurrence.categoryKey) ?? null : null
        const cardId = recurrence.cardKey ? cardIdByKey.get(recurrence.cardKey) ?? null : null
        const cardCycle = cardCycleFor(recurrence.cardKey)
        const startDate = new Date(`${recurrence.startDate}T00:00:00`)
        const endDate = recurrence.endDate ? new Date(`${recurrence.endDate}T00:00:00`) : null

        const [expenseRow] = await db
            .insert(expenses)
            .values({
                userId: targetUserId,
                type: 'recurring',
                description: recurrence.description,
                merchantId,
                categoryId,
                cardId,
                totalAmount: recurrence.amount,
                purchaseDate: recurrence.startDate,
            })
            .returning({ id: expenses.id })

        const [recurrenceRow] = await db
            .insert(recurrences)
            .values({ userId: targetUserId, frequency: recurrence.frequency, startDate: recurrence.startDate, endDate: recurrence.endDate, active: true })
            .returning({ id: recurrences.id })

        const until = endDate ?? addMonths(startDate, 12)
        const dates = generateRecurrenceOccurrences(startDate, recurrence.frequency, until, endDate)

        await db.insert(expenseInstallments).values(
            dates.map((date) => {
                const invoice = getInvoiceForExpense(new Date(`${date}T00:00:00`), cardCycle)
                return {
                    userId: targetUserId,
                    expenseId: expenseRow.id,
                    recurrenceId: recurrenceRow.id,
                    merchantId,
                    categoryId,
                    cardId,
                    description: recurrence.description,
                    amount: recurrence.amount,
                    occurrenceDate: date,
                    dueDate: toISODate(invoice.dueDate),
                    invoiceMonth: invoice.month,
                }
            }),
        )
    }

    console.log(`Perfil financeiro criado com sucesso para ${targetUserId}`)
    process.exit(0)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
```

- [ ] **Step 4: Add the `db:seed` script to `package.json`**

```json
"scripts": {
    "db:seed": "tsx scripts/seed.ts"
}
```

- [ ] **Step 5: Verify**

```bash
pnpm db:seed <realUserId>
```

Expected: `Perfil financeiro criado com sucesso para <realUserId>`. Then, in
Drizzle Studio (`pnpm drizzle-kit studio`) or the app itself (`/mes`,
`/relatorios`), confirm: 3 cards, 13 categories, 21 merchants, 12 expenses
(6 installment, 6 single) with their installment occurrences, 8 recurrences
with ~12 monthly occurrences each, and that Anthropic shows under
"Trabalho" (not "Outros"). Re-running the same command against the same
user must fail with the "já possui dados financeiros" error.

- [ ] **Step 6: Commit**

```bash
git add scripts package.json pnpm-lock.yaml
git commit -m "feat: add pnpm db:seed personal finance data import script"
```

---

## Self-Review

**Spec coverage:** the only requirement — "load my real financial data via
`pnpm db:seed <userId>` using Drizzle instead of raw SQL" — is covered by
Task 1 end-to-end: cards, categories, merchants, expenses, installment
plans, recurrences, and their `expense_installments` occurrences are all
created.

**Placeholder scan:** no TBD/TODO; every step has complete, real code and
data — no "similar to Task N" references.

**Type consistency:** `CardCycle` (`{ closing_day, due_day }`) matches
Task 11's exported type exactly, including its snake_case field names, and
is reused unchanged for both the expense loop and the recurrence loop.
`generateInstallments`'s return fields (`installment_number`,
`installments_total`, `amount`, `occurrence_date`, `due_date`,
`invoice_month`) are mapped 1:1 onto `expenseInstallments`'s camelCase
columns. `generateRecurrenceOccurrences`'s return (`string[]` of ISO
dates) is paired with `getInvoiceForExpense` per date exactly as Task 22
(`/api/expenses`, recurring branch) is expected to do for user-created
recurring expenses.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/specs/2026-09-11-db-seed-personal-data-import-plan.md`.
Once Section D (Tasks 10-17) is implemented, insert this task's content as
**Task 17b** in
`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-d-domain-layer.md`
and reference it from the master checklist. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent for this
   task, review before merging.
2. **Inline Execution** — execute in this session using executing-plans.

Which approach?
