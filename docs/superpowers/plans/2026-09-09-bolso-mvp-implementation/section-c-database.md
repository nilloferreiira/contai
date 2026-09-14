# Bolso MVP Implementation Plan — Section C: Database

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
- Soft deletes only: `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, and `expense_installments` all carry a `deleted_at timestamptz` column. Nothing under user-facing endpoints ever issues a real `DELETE` on these tables — a "delete" always means `update({ deletedAt: new Date() })`. Multi-tenant isolation and soft-delete filtering are enforced in every query: `.where(and(eq(table.userId, session.user.id), isNull(table.deletedAt)))`.
- `expense_installments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/db/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

---

## Section C: Database

### Task 9: Drizzle ORM Schema, Relations, and Drizzle Kit

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema/auth.ts`
- Create: `src/db/schema/domain.ts`
- Create: `src/db/schema/index.ts`

**Interfaces:**
- Consumes: `drizzle-orm`, `postgres`, `drizzle-kit` (Task 1)
- Produces: `user`, `session`, `account`, `verification`, `jwks`, `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installmentPlans`, `expenseInstallments` tables and relations. Every task in Section E (API routes) and Section D (domain types) imports from `@/db/schema`.

- [x] **Step 1: Write `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema/index.ts',
    out: './src/db/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: true,
})
```

- [x] **Step 2: Write `src/db/schema/auth.ts`**

Standard Better Auth tables with JWT key storage:

```ts
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
})

export const session = pgTable(
    'session',
    {
        id: text('id').primaryKey(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        token: text('token').notNull().unique(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
    },
    (table) => [index('session_userId_idx').on(table.userId)],
)

export const account = pgTable(
    'account',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
        scope: text('scope'),
        password: text('password'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index('account_userId_idx').on(table.userId)],
)

export const verification = pgTable(
    'verification',
    {
        id: text('id').primaryKey(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const jwks = pgTable('jwks', {
    id: text('id').primaryKey(),
    publicKey: text('public_key').notNull(),
    privateKey: text('private_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [x] **Step 3: Write `src/db/schema/domain.ts`**

Domain entities matching the finance domain model:

```ts
import { relations, sql } from 'drizzle-orm'
import {
    boolean,
    date,
    index,
    integer,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const expenseTypeEnum = pgEnum('expense_type', ['single', 'installment', 'recurring'])
export const expenseStatusEnum = pgEnum('expense_status', ['pending', 'paid', 'cancelled'])
export const frequencyEnum = pgEnum('frequency', ['weekly', 'monthly', 'yearly'])

export const cards = pgTable(
    'cards',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        closingDay: integer('closing_day').notNull(),
        dueDay: integer('due_day').notNull(),
        creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }),
        color: text('color'),
        active: boolean('active').default(true).notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index('cards_user_idx').on(table.userId)],
)

export const categories = pgTable(
    'categories',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        icon: text('icon'),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('categories_user_name_unique')
            .on(table.userId, sql`lower(${table.name})`)
            .where(sql`${table.deletedAt} is null`),
    ],
)

export const merchants = pgTable(
    'merchants',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        normalizedName: text('normalized_name').notNull(),
        displayName: text('display_name').notNull(),
        defaultCategoryId: uuid('default_category_id').references(() => categories.id, { onDelete: 'set null' }),
        defaultCardId: uuid('default_card_id').references(() => cards.id, { onDelete: 'set null' }),
        usageCount: integer('usage_count').default(0).notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('merchants_user_normalized_unique')
            .on(table.userId, table.normalizedName)
            .where(sql`${table.deletedAt} is null`),
    ],
)

export const recurrences = pgTable('recurrences', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    frequency: frequencyEnum('frequency').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    active: boolean('active').default(true).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const expenses = pgTable('expenses', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    type: expenseTypeEnum('type').notNull(),
    description: text('description').notNull(),
    merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    cardId: uuid('card_id').references(() => cards.id, { onDelete: 'set null' }),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    purchaseDate: date('purchase_date').notNull(),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
})

export const installmentPlans = pgTable('installment_plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    expenseId: uuid('expense_id')
        .notNull()
        .references(() => expenses.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    installmentsTotal: integer('installments_total').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const expenseInstallments = pgTable(
    'expense_installments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        expenseId: uuid('expense_id')
            .notNull()
            .references(() => expenses.id, { onDelete: 'cascade' }),
        installmentPlanId: uuid('installment_plan_id').references(() => installmentPlans.id, { onDelete: 'cascade' }),
        recurrenceId: uuid('recurrence_id').references(() => recurrences.id, { onDelete: 'cascade' }),
        merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
        categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
        cardId: uuid('card_id').references(() => cards.id, { onDelete: 'set null' }),
        description: text('description').notNull(),
        installmentNumber: integer('installment_number'),
        installmentsTotal: integer('installments_total'),
        amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
        occurrenceDate: date('occurrence_date').notNull(),
        dueDate: date('due_date').notNull(),
        invoiceMonth: text('invoice_month').notNull(),
        status: expenseStatusEnum('status').default('pending').notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('expense_installments_user_occurrence_idx').on(table.userId, table.occurrenceDate),
        index('expense_installments_user_status_due_idx').on(table.userId, table.status, table.dueDate),
        index('expense_installments_user_invoice_month_idx').on(table.userId, table.invoiceMonth),
    ],
)

// Relations
export const userRelations = relations(user, ({ many }) => ({
    cards: many(cards),
    categories: many(categories),
    merchants: many(merchants),
    expenses: many(expenses),
    expenseInstallments: many(expenseInstallments),
}))

export const cardsRelations = relations(cards, ({ one, many }) => ({
    user: one(user, { fields: [cards.userId], references: [user.id] }),
    expenses: many(expenses),
    expenseInstallments: many(expenseInstallments),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
    user: one(user, { fields: [categories.userId], references: [user.id] }),
    expenses: many(expenses),
    expenseInstallments: many(expenseInstallments),
}))

export const merchantsRelations = relations(merchants, ({ one, many }) => ({
    user: one(user, { fields: [merchants.userId], references: [user.id] }),
    defaultCategory: one(categories, { fields: [merchants.defaultCategoryId], references: [categories.id] }),
    defaultCard: one(cards, { fields: [merchants.defaultCardId], references: [cards.id] }),
    expenses: many(expenses),
}))

export const expensesRelations = relations(expenses, ({ one, many }) => ({
    user: one(user, { fields: [expenses.userId], references: [user.id] }),
    merchant: one(merchants, { fields: [expenses.merchantId], references: [merchants.id] }),
    category: one(categories, { fields: [expenses.categoryId], references: [categories.id] }),
    card: one(cards, { fields: [expenses.cardId], references: [cards.id] }),
    installmentPlan: one(installmentPlans),
    installments: many(expenseInstallments),
}))

export const installmentPlansRelations = relations(installmentPlans, ({ one, many }) => ({
    expense: one(expenses, { fields: [installmentPlans.expenseId], references: [expenses.id] }),
    installments: many(expenseInstallments),
}))

export const expenseInstallmentsRelations = relations(expenseInstallments, ({ one }) => ({
    user: one(user, { fields: [expenseInstallments.userId], references: [user.id] }),
    expense: one(expenses, { fields: [expenseInstallments.expenseId], references: [expenses.id] }),
    installmentPlan: one(installmentPlans, {
        fields: [expenseInstallments.installmentPlanId],
        references: [installmentPlans.id],
    }),
    card: one(cards, { fields: [expenseInstallments.cardId], references: [cards.id] }),
    category: one(categories, { fields: [expenseInstallments.categoryId], references: [categories.id] }),
    merchant: one(merchants, { fields: [expenseInstallments.merchantId], references: [merchants.id] }),
}))
```

- [x] **Step 4: Write `src/db/schema/index.ts`**

```ts
export * from './auth'
export * from './domain'
```

- [x] **Step 5: Generate & Push Migrations**

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

- [x] **Step 6: Verify**

```bash
pnpm drizzle-kit check
```

Confirm all tables and enums match the schema and PostgreSQL has created the tables with correct indexes and constraints.

- [x] **Step 7: Commit**

```bash
git add drizzle.config.ts src/db/schema
git commit -m "feat: add Drizzle ORM schema, relations, and drizzle-kit configuration"
```
