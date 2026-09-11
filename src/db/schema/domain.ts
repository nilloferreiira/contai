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
    expense: one(expenses, { fields: [expenseInstallments.expenseId], references: [expenses.id] }),
    installmentPlan: one(installmentPlans, {
        fields: [expenseInstallments.installmentPlanId],
        references: [installmentPlans.id],
    }),
    card: one(cards, { fields: [expenseInstallments.cardId], references: [cards.id] }),
    category: one(categories, { fields: [expenseInstallments.categoryId], references: [categories.id] }),
    merchant: one(merchants, { fields: [expenseInstallments.merchantId], references: [merchants.id] }),
}))
