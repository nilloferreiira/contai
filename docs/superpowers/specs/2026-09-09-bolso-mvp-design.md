# Bolso MVP — Design Spec

Personal finance manager, mobile-first, Next.js + PostgreSQL + Drizzle ORM + Better Auth (JWT). Core value
prop: register an expense in under 15 seconds using natural language,
parsed deterministically (regex-based, no AI).

Project scaffolding (`create-next-app`) is already done — out of
scope here. **Google OAuth is deferred post-MVP; MVP auth is
email/password only.** The PostgreSQL database instance is provisioned
and connected via environment variable `DATABASE_URL`.

## 1. Required stack

- Next.js 16+ (App Router, TypeScript strict, Server Components by default)
- pnpm
- shadcn/ui (Radix underneath)
- PostgreSQL with `postgres` (postgres.js) driver
- Drizzle ORM (`drizzle-orm`, `drizzle-kit`) for typed database schema and queries
- Better Auth (`better-auth` with JWT plugin, `@better-auth/cli`) for authentication with signed JWT cookies
- @tanstack/react-query v5 for client cache/mutations
- zod for validation (forms + API payloads)
- react-hook-form + @hookform/resolvers/zod
- Tailwind CSS v4 (CSS-first config in `globals.css`)
- tailwind-variants + tailwind-merge for component variants
- lucide-react for icons
- sonner for toasts
- vitest for domain unit tests

### Setup (already partially done — see plan for what remains)

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input label select dialog sheet drawer tabs badge switch separator skeleton popover calendar command scroll-area
pnpm add better-auth @better-auth/cli drizzle-orm postgres @tanstack/react-query @tanstack/react-query-devtools zod react-hook-form @hookform/resolvers tailwind-variants tailwind-merge lucide-react sonner date-fns
pnpm add -D drizzle-kit vitest @vitejs/plugin-react jsdom @testing-library/react @types/pg
```

## 2. Code rules (non-negotiable)

### Naming
- Files: **lowercase-with-hyphens** → `user-card.tsx`, `use-modal.ts`, `card-visual.tsx`
- **Always named exports**, never `export default` (except where Next.js
  requires it: `page.tsx`, `layout.tsx`, `route.ts` handlers use named
  `GET`/`POST`)
- **No barrel files** (`index.ts`) for internal folders

### Components

```tsx
import { tv, type VariantProps } from 'tailwind-variants'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export const buttonVariants = tv({
    base: [
        'inline-flex cursor-pointer items-center justify-center rounded-lg border font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    ],
    variants: {
        variant: {
            primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover',
            secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-muted',
            ghost: 'border-transparent bg-transparent text-muted-foreground hover:text-foreground',
            destructive: 'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90',
        },
        size: {
            sm: 'h-6 px-2 gap-1.5 text-xs [&_svg]:size-3',
            md: 'h-7 px-3 gap-2 text-sm [&_svg]:size-3.5',
            lg: 'h-9 px-4 gap-2.5 text-base [&_svg]:size-4',
        },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
})

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, disabled, children, ...props }: ButtonProps) {
    return (
        <button
            type="button"
            data-slot="button"
            data-disabled={disabled ? '' : undefined}
            className={twMerge(buttonVariants({ variant, size }), className)}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    )
}
```

### Compound components

```tsx
export interface CardProps extends ComponentProps<'div'> {}

export function Card({ className, ...props }: CardProps) {
    return (
        <div
            data-slot="card"
            className={twMerge('bg-surface flex flex-col gap-6 rounded-xl border border-border p-6 shadow-sm', className)}
            {...props}
        />
    )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
    return <div data-slot="card-header" className={twMerge('flex flex-col gap-1.5', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
    return <h3 data-slot="card-title" className={twMerge('text-lg font-semibold', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
    return <div data-slot="card-content" className={className} {...props} />
}
```

### TypeScript

```tsx
// ✅ Extend ComponentProps + VariantProps
export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

// ✅ Type-only imports
import type { ComponentProps } from 'react'
import type { VariantProps } from 'tailwind-variants'

// ❌ Never React.FC, never any
```

### Mandatory patterns

```tsx
className={twMerge('base-classes', className)}   // always twMerge
<div data-slot="card">                            // always data-slot
data-disabled={disabled ? '' : undefined}         // state via data-attribute
className="data-[disabled]:opacity-50 data-[selected]:bg-primary"
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
<Check className="size-4" />                      // icons with explicit size
'[&_svg]:size-3.5'                                // inside variants
<button aria-label="Fechar"><X className="size-4" /></button> // icon-only needs aria-label
{...props}                                        // spread always last
```

## 3. Color tokens — `src/app/globals.css`

Tailwind v4, CSS-first. No hardcoded colors in components (`text-white`,
`bg-[#hex]` forbidden).

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

:root {
    --background: oklch(0.985 0.008 85);
    --surface: oklch(1 0 0);
    --surface-raised: oklch(0.975 0.01 85);

    --foreground: oklch(0.22 0.02 60);
    --foreground-subtle: oklch(0.45 0.02 60);
    --muted: oklch(0.955 0.012 85);
    --muted-foreground: oklch(0.6 0.015 60);

    --primary: oklch(0.66 0.16 45);            /* warm orange */
    --primary-hover: oklch(0.6 0.17 45);
    --primary-foreground: oklch(0.99 0.01 85);

    --secondary: oklch(0.97 0.01 85);
    --secondary-foreground: oklch(0.28 0.02 60);

    --destructive: oklch(0.58 0.19 27);
    --destructive-foreground: oklch(0.99 0.01 85);

    --success: oklch(0.62 0.13 155);
    --warning: oklch(0.75 0.14 80);

    --border: oklch(0.91 0.012 85);
    --input: oklch(0.89 0.012 85);
    --ring: oklch(0.66 0.16 45);

    --radius: 0.75rem;
}

.dark {
    --background: oklch(0.19 0.015 60);
    --surface: oklch(0.23 0.016 60);
    --surface-raised: oklch(0.27 0.018 60);
    --foreground: oklch(0.96 0.008 85);
    --foreground-subtle: oklch(0.78 0.012 85);
    --muted: oklch(0.29 0.016 60);
    --muted-foreground: oklch(0.66 0.014 70);
    --border: oklch(0.32 0.016 60);
    --input: oklch(0.34 0.016 60);
}

@theme inline {
    --color-background: var(--background);
    --color-surface: var(--surface);
    --color-surface-raised: var(--surface-raised);
    --color-foreground: var(--foreground);
    --color-foreground-subtle: var(--foreground-subtle);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-primary: var(--primary);
    --color-primary-hover: var(--primary-hover);
    --color-primary-foreground: var(--primary-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-destructive: var(--destructive);
    --color-destructive-foreground: var(--destructive-foreground);
    --color-success: var(--success);
    --color-warning: var(--warning);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --font-sans: 'Figtree', ui-sans-serif, system-ui, sans-serif;
    --font-display: 'Fraunces', ui-serif, Georgia, serif;
}
```

Available classes: `bg-surface`, `bg-surface-raised`, `bg-primary`,
`bg-secondary`, `bg-muted`, `bg-destructive`, `text-foreground`,
`text-foreground-subtle`, `text-muted-foreground`,
`text-primary-foreground`, `border-border`, `border-input`,
`border-primary`, `border-destructive`, `ring-ring`.

## 4. Reference file tree

```
src/
├── app/
│   ├── layout.tsx                      # fonts, <Providers>, <Toaster>
│   ├── globals.css
│   ├── page.tsx                        # redirect -> /inicio or /login
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── cadastro/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                  # session guard + <bottom-nav>
│   │   ├── inicio/page.tsx
│   │   ├── mes/page.tsx
│   │   ├── relatorios/page.tsx
│   │   └── ajustes/page.tsx
│   └── api/
│       ├── auth/[...all]/route.ts      # Better Auth handler
│       ├── cards/route.ts              # GET, POST
│       ├── cards/[id]/route.ts         # PATCH, DELETE
│       ├── categories/route.ts         # GET, POST
│       ├── categories/[id]/route.ts    # PATCH, DELETE
│       ├── merchants/route.ts          # GET
│       ├── expenses/route.ts           # POST (creates purchase + occurrences)
│       ├── occurrences/route.ts        # GET ?from=&to=&status=&categoryId=&cardId=&q=
│       ├── occurrences/[id]/route.ts   # PATCH ?scope=, DELETE ?scope=
│       └── reports/summary/route.ts    # GET ?month=YYYY-MM
├── components/
│   ├── ui/                             # shadcn (button, card, dialog, ...)
│   ├── app/
│   │   ├── bottom-nav.tsx
│   │   ├── quick-add.tsx
│   │   ├── manual-expense-dialog.tsx
│   │   ├── occurrence-list.tsx
│   │   ├── occurrence-row.tsx
│   │   ├── occurrence-sheet.tsx
│   │   ├── card-visual.tsx
│   │   ├── card-color-picker.tsx
│   │   ├── month-switcher.tsx
│   │   └── summary-tiles.tsx
│   └── forms/
│       ├── expense-form.tsx
│       ├── card-form.tsx
│       └── category-form.tsx
├── db/
│   ├── index.ts                        # postgres client + drizzle instance
│   └── schema/
│       ├── index.ts                    # schema re-exports
│       ├── auth.ts                     # Better Auth tables (user, session, account, verification)
│       └── domain.ts                   # cards, categories, merchants, expenses, etc.
├── hooks/
│   ├── use-cards.ts
│   ├── use-categories.ts
│   ├── use-merchants.ts
│   ├── use-occurrences.ts
│   └── use-create-expense.ts
├── lib/
│   ├── auth.ts                         # Better Auth server instance + jwt plugin
│   ├── auth-client.ts                  # createAuthClient + jwt client
│   ├── finance/
│   │   ├── types.ts
│   │   ├── date.ts
│   │   ├── money.ts
│   │   ├── invoice.ts                  # closing/due date
│   │   ├── installments.ts             # installment splitting
│   │   ├── recurrence.ts               # occurrence generation
│   │   ├── merchants.ts                # normalization
│   │   ├── parser.ts                   # natural language
│   │   ├── card-colors.ts
│   │   └── dashboard.ts                # aggregations
│   ├── schemas/
│   │   ├── expense-schema.ts
│   │   ├── card-schema.ts
│   │   └── category-schema.ts
│   ├── api-client.ts                   # typed fetch + error handling
│   └── query-keys.ts
├── providers/
│   └── query-provider.tsx
├── proxy.ts                            # Next.js 16 proxy: protects (app)/* via getSessionCookie
└── tests/
    ├── invoice.test.ts
    ├── installments.test.ts
    ├── recurrence.test.ts
    └── parser.test.ts
drizzle.config.ts
drizzle/                                # generated migrations
```

## 5. Data model (PostgreSQL + Drizzle ORM)

Mandatory separation: **purchase (`expenses`) ≠ financial occurrence
(`expense_installments`)**. All UI and all reports read occurrences.

Tables:
- Auth tables (managed by Better Auth): `user`, `session`, `account`, `verification`.
- Domain tables: `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, `expense_installments`.

### Drizzle ORM Schema & Multi-Tenancy

Every domain table includes `user_id text not null references user(id) on delete cascade` and `deleted_at timestamp with time zone` (nullable) for soft deletes.

Multi-tenant security is enforced at the query level in all API route handlers and server actions:
```ts
.where(and(eq(table.userId, session.user.id), isNull(table.deletedAt)))
```

Enums:
- `expense_type`: `'single'`, `'installment'`, `'recurring'`
- `expense_status`: `'pending'`, `'paid'`, `'cancelled'`
- `frequency`: `'weekly'`, `'monthly'`, `'yearly'`

Example Drizzle Table Definition:

```ts
export const cards = pgTable(
    'cards',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        closingDay: integer('closing_day').notNull(),
        dueDay: integer('due_day').notNull(),
        creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }),
        color: text('color'),
        active: boolean('active').default(true).notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [index('cards_user_idx').on(table.userId)],
)
```

Important details:
- `expense_installments`: `expense_id`, `installment_plan_id`,
  `recurrence_id`, `merchant_id`, `category_id`, `card_id`,
  `description`, `installment_number`, `installments_total`, `amount`,
  `occurrence_date`, `due_date`, `invoice_month` (`YYYY-MM`), `status`,
  `deleted_at`.
- Composite Indexes: `(user_id, occurrence_date)`, `(user_id, status, due_date)`,
  `(user_id, invoice_month)`.
- Unique partial index to prevent duplicate active categories per user:
  `uniqueIndex('categories_user_name_unique').on(table.userId, sql`lower(${table.name})`).where(sql`${table.deletedAt} is null`)`
- Unique partial index on merchants:
  `uniqueIndex('merchants_user_normalized_unique').on(table.userId, table.normalizedName).where(sql`${table.deletedAt} is null`)`
- `merchants`: `normalized_name` unique per user, `default_category_id`,
  `default_card_id`, `usage_count` (smart history).
- Migration management: `drizzle-kit generate` to generate SQL migrations, `drizzle-kit migrate` or `drizzle-kit push` for applying schema changes.

## 6. Pure domain layer (no DB dependency)

`src/lib/finance/*` never imports Drizzle, PostgreSQL, or Better Auth. Pure, 100% testable functions.

### Invoice

```ts
export interface CardCycle { closing_day: number; due_day: number }

/** Returns { month: 'YYYY-MM', dueDate: Date } of the invoice the purchase falls into. */
export function getInvoiceForExpense(purchaseDate: Date, card: CardCycle | null) {
    if (!card) {
        return { month: monthKey(purchaseDate), dueDate: purchaseDate }
    }
    const afterClosing = purchaseDate.getDate() > card.closing_day
    const base = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + (afterClosing ? 1 : 0), 1)
    const dueDate = clampDay(new Date(base.getFullYear(), base.getMonth(), 1), card.due_day)
    return { month: monthKey(base), dueDate }
}
```

### Installments — known trap

Anchor each occurrence to the **purchase month + i**, never to the due
date; otherwise the 2nd installment "skips" a month when the purchase
happens after closing.

```ts
export function generateInstallments(total: number, count: number, purchaseDate: Date, card: CardCycle | null) {
    const cents = Math.round(total * 100)
    const base = Math.floor(cents / count)
    const rest = cents - base * count
    return Array.from({ length: count }, (_, i) => {
        const anchor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + i, 1) // ⬅️ anchor
        const invoice = getInvoiceForExpense(i === 0 ? purchaseDate : anchor, card)
        return {
            installment_number: i + 1,
            installments_total: count,
            amount: (base + (i < rest ? 1 : 0)) / 100, // remainder on first installments
            occurrence_date: toISODate(anchor),
            due_date: toISODate(invoice.dueDate),
            invoice_month: invoice.month,
        }
    })
}
```

### Recurrence — known trap

Compare **calendar dates via `toISODate`**, never `Date` with time
components, and **include the occurrence of the start day itself**.

### Natural-language parser (deterministic)

Input examples: `"1200 em 3x na americanas no nubank"`,
`"netflix 55,90 todo mes"`, `"20 nubank alimentação"`.

Extract, in this priority order:
1. **amount** — `R$`, comma or dot decimal (`47,90`, `1.200,00`, `20`)
2. **installments** — `3x`, `em 3x`, `3 vezes`
3. **recurrence** — `todo mês`, `mensal`, `toda semana`, `anual`
4. **card** — registered card name (normalized match)
5. **explicit category** — registered category name; **prefer the
   longest match**, and prioritize typed category over
   history/keywords
6. **merchant** — remaining text; if known, applies its
   `default_category_id` / `default_card_id`
7. **date** — `hoje`, `ontem`, `dia 12`, `12/09`

Recognized tokens are stripped from the description. Returns a
`ParsedExpense` with an `ambiguous` flag when amount is missing or
there's a conflict → UI asks for confirmation.

## 7. Better Auth — configuration, JWT plugin, and route guard

Better Auth provides email/password authentication using the JWT plugin with stateless signed cookies (`session_data`), eliminating per-request database hits.

- Server: `src/lib/auth.ts` (`betterAuth` with `drizzleAdapter(db, { provider: 'pg', schema })`, `emailAndPassword`, and `jwt({ sessionCookieCache: true })`).
- Client: `src/lib/auth-client.ts` (`createAuthClient` with `jwtClient()`).
- Handler: `src/app/api/auth/[...all]/route.ts` exposes all Better Auth endpoints (`toNextJsHandler(auth.handler)`).

Route guard proxy (Next.js 16 convention):

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const protectedPrefixes = ['/inicio', '/mes', '/relatorios', '/ajustes']
const authPrefixes = ['/login', '/cadastro']

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const sessionCookie = getSessionCookie(request)

    const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))
    if (isProtected && !sessionCookie) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const isAuth = authPrefixes.some((p) => pathname.startsWith(p))
    if (isAuth && sessionCookie) {
        return NextResponse.redirect(new URL('/inicio', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/inicio/:path*', '/mes/:path*', '/relatorios/:path*', '/ajustes/:path*', '/login', '/cadastro'],
}
```

`src/app/(app)/layout.tsx` is a Server Component: calls
`auth.api.getSession({ headers: await headers() })` and `redirect('/login')` when there is no user.

> ⚠️ The route guard only protects the UI. **Every route under
> `app/api/*` revalidates the session** with `auth.api.getSession({ headers: await headers() })`
> and explicitly filters by `userId` and `isNull(deletedAt)` — never trust a client-supplied `userId`.

## 8. API routes — contract

> **Superseded:** this REST contract is replaced by the tRPC design in
> `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.
> Kept below for historical reference only — the actual task breakdown is
> `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e-api-trpc.md`.

Every handler follows: authenticate → validate with zod → execute → respond JSON.

```ts
// src/app/api/expenses/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { createExpenseSchema } from '@/lib/schemas/expense-schema'
import { createExpenseWithOccurrences } from '@/app/api/expenses/route'

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
```

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/cards` | GET, POST | lists active; creates with color |
| `/api/cards/[id]` | PATCH, DELETE | includes color change |
| `/api/categories` | GET, POST | GET does idempotent seed of defaults |
| `/api/categories/[id]` | PATCH, DELETE | |
| `/api/merchants` | GET | ordered by `usage_count` desc |
| `/api/expenses` | POST | creates purchase + plan + occurrences (or recurrence + 12 months) |
| `/api/occurrences` | GET | filters `from`, `to`, `q`, `categoryId`, `cardId`, `type`, `status` |
| `/api/occurrences/[id]` | PATCH, DELETE | `?scope=occurrence\|future\|series\|end` |
| `/api/reports/summary` | GET | `?month=YYYY-MM` — totals, by category, by card, invoices |

### Idempotent category seed (known bug)

Never insert blindly. Fetch existing ones, normalize (`lower` + no
accents), insert only the missing ones, and rely on the unique index
`(user_id, lower(name))`. Use a **single-flight promise** on the
client so the seed doesn't fire in parallel.

## 9. Forms — zod + react-hook-form

```ts
// src/lib/schemas/expense-schema.ts
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

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
```

```tsx
const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { type: 'single', purchaseDate: new Date(), amount: 0, description: '' },
})
```

### Password (sign-up) — show requirements live

Minimum 8 characters, lowercase, uppercase, number, symbol. Render a
**live checklist** with ✓/✗ per requirement, validate on `blur` and on
submit, and translate authentication errors (such as email already registered, invalid credentials) to
Portuguese explaining why. Never show unhandled raw error strings.

## 10. React Query

```ts
// src/lib/query-keys.ts
export const queryKeys = {
    cards: ['cards'] as const,
    categories: ['categories'] as const,
    merchants: ['merchants'] as const,
    occurrences: (filters: OccurrenceFilters) => ['occurrences', filters] as const,
    summary: (month: string) => ['summary', month] as const,
}
```

```tsx
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

`QueryProvider` is `'use client'` and creates the `QueryClient` inside
`useState(() => new QueryClient(...))` — never at module scope.

## 11. Pages

| Route | Content |
| --- | --- |
| `/login`, `/cadastro` | email+password, live password checklist, toasts |
| `/inicio` | current month, month total, **quick-add** front and center (autofocus), today's expenses, edit sheet |
| `/mes` | month-by-month navigation, merchant search, filters (category, card, type, status), date-grouped list |
| `/relatorios` | month total, invoices by card, recurring, open installment plans, spend by category and by card, upcoming invoices |
| `/ajustes` | Cards CRUD (closing, due day, limit, **color picker with preview**), Categories CRUD, theme, sign out |

Fixed `bottom-nav` with 4 tabs + central `+` button that goes to
`/inicio` and focuses the quick-add.

## 12. `card-visual.tsx` — cosmetic card

Purely decorative component (**no real card data**), Apple
Wallet-inspired: rounded corners, diagonal gradient from the chosen
color, radial glow at the top, chip and two overlapping circles as a
"flag".

```tsx
type Size = 'lg' | 'sm' | 'xs'

const sizes: Record<Size, string> = {
    lg: 'aspect-[1.586] w-full max-h-44 rounded-2xl p-3',
    sm: 'h-10 w-16 rounded-lg p-1.5',
    xs: 'h-4 w-6 rounded-[4px] p-0',
}
```

- `lg` → preview in `/ajustes` when creating/editing a card
- `sm` → card selection in forms
- `xs` → card pill in quick-add and expense rows

Colors in `card-colors.ts` (fixed palette + resolution of saved value).
Gradient via `color-mix(in oklab, …)` over the base color.

## 13. Out of scope (MVP)

Open Finance, generative AI, bank integrations, investments,
multi-user/sharing, payments, **Google OAuth** (deferred).

See `docs/superpowers/plans/` for the phased implementation plan
derived from this spec.
