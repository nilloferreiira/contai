# Bolso MVP Implementation Plan — Section B: PostgreSQL & Better Auth (JWT)

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

## Section B: PostgreSQL & Better Auth (JWT)

### Task 5: Database connection + Better Auth configuration

**Files:**
- Create: `.env.local` (untracked — add to `.gitignore` if not already)
- Create: `.env.example`
- Create: `src/db/index.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth-client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/db/CLAUDE.md`

**Interfaces:**
- Consumes: `postgres`, `drizzle-orm`, `better-auth` (Task 1)
- Produces: `db` instance from `src/db/index.ts`, `auth` server instance from `src/lib/auth.ts`, `authClient` from `src/lib/auth-client.ts`, Better Auth HTTP endpoint at `/api/auth/*`.

- [x] **Step 1: Write env files**

```bash
# .env.local (untracked, real values)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bolso
BETTER_AUTH_SECRET=a_random_32_character_secret_string_minimum
BETTER_AUTH_URL=http://localhost:3000
```

```bash
# .env.example (tracked, placeholders)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bolso
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
```

Confirm `.env.local` is listed in `.gitignore`.

- [x] **Step 2: Write `src/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

const connectionString = process.env.DATABASE_URL!

// For query execution across server components and route handlers
const client = postgres(connectionString)
export const db = drizzle(client, { schema })
```

- [x] **Step 3: Write `src/lib/auth.ts`**

Configure Better Auth with the Drizzle adapter, email/password provider, and JWT plugin with JWKS session cookie cache:

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt } from 'better-auth/plugins'
import { db } from '@/db'
import * as schema from '@/db/schema'

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
            ...schema,
        },
    }),
    emailAndPassword: {
        enabled: true,
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes cache
            strategy: 'jwt',
        },
    },
    plugins: [
        jwt({
            sessionCookieCache: true,
        }),
    ],
})

export type Session = typeof auth.$Infer.Session
```

- [x] **Step 4: Write `src/lib/auth-client.ts`**

Client-side auth client for React components:

```ts
import { createAuthClient } from 'better-auth/react'
import { jwtClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
    plugins: [jwtClient()],
})

export type ClientSession = typeof authClient.$Infer.Session
```

- [x] **Step 5: Write `src/app/api/auth/[...all]/route.ts`**

Catch-all route handler exposing Better Auth endpoints (sign-up, sign-in, session, token, jwks):

```ts
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { POST, GET } = toNextJsHandler(auth)
```

- [x] **Step 6: Write `src/db/CLAUDE.md`**

```markdown
# src/db

Drizzle ORM setup backed by PostgreSQL via `postgres.js`:
- `index.ts` — exports the singleton `db` instance.
- `schema/` — schema definitions (auth tables + domain tables).
- `migrations/` — SQL migrations generated by `drizzle-kit`.

All database queries must go through Drizzle ORM using `db.select()`, `db.insert()`,
`db.update()`. Never run untracked raw SQL in route handlers. Every user-owned entity
must be filtered by `userId` and `isNull(deletedAt)`.
```

- [x] **Step 7: Verify**

```bash
pnpm build
```

Expected: build succeeds and route handler compiles.

- [x] **Step 8: Commit**

```bash
git add .env.example src/db src/lib/auth.ts src/lib/auth-client.ts src/app/api/auth
git commit -m "feat: add PostgreSQL Drizzle client and Better Auth JWT server/client"
```

---

### Task 6: Next.js 16 `proxy.ts` session guard

**Files:**
- Create/Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `better-auth/cookies` (Task 5)
- Produces: fast, optimistic route protection before page requests reach components.

- [x] **Step 1: Write `src/proxy.ts`**

Next.js 16 replaces `middleware.ts` with `proxy.ts`. We perform an optimistic session cookie check to redirect unauthenticated traffic away from private routes without overhead:

```ts
import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request)
    const { pathname } = request.nextUrl

    const isAuthPage = pathname === '/login' || pathname === '/cadastro'
    const isAppPage =
        pathname.startsWith('/inicio') ||
        pathname.startsWith('/mes') ||
        pathname.startsWith('/relatorios') ||
        pathname.startsWith('/ajustes')

    if (!sessionCookie && isAppPage) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (sessionCookie && isAuthPage) {
        return NextResponse.redirect(new URL('/inicio', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|webp)$).*)'],
}
```

- [x] **Step 2: Verify**

```bash
pnpm dev
```

Confirm static assets and API routes are unaffected and `proxy.ts` executes without runtime errors.

- [x] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: add Next.js 16 proxy session guard using Better Auth cookies"
```

---

### Task 7: `/login` + `/cadastro` pages (email/password via Better Auth)

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/cadastro/page.tsx`
- Create: `src/components/app/password-checklist.tsx`
- Create: `src/lib/schemas/auth-schema.ts`

**Interfaces:**
- Consumes: `authClient` from `src/lib/auth-client.ts` (Task 5), shadcn `Input`/`Label`/`Button`/`Card` (Task 2)
- Produces: working sign-up/sign-in flow with live password validation.

- [x] **Step 1: Write `src/lib/schemas/auth-schema.ts`**

```ts
import { z } from 'zod'

export const passwordRequirements = [
    { key: 'length', label: 'Mínimo de 8 caracteres', test: (v: string) => v.length >= 8 },
    { key: 'lower', label: 'Uma letra minúscula', test: (v: string) => /[a-z]/.test(v) },
    { key: 'upper', label: 'Uma letra maiúscula', test: (v: string) => /[A-Z]/.test(v) },
    { key: 'number', label: 'Um número', test: (v: string) => /[0-9]/.test(v) },
    { key: 'symbol', label: 'Um símbolo', test: (v: string) => /[^a-zA-Z0-9]/.test(v) },
] as const

export const signUpSchema = z.object({
    name: z.string().min(2, 'Informe seu nome'),
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().refine((v) => passwordRequirements.every((r) => r.test(v)), {
        message: 'A senha não atende aos requisitos',
    }),
})

export const signInSchema = z.object({
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().min(1, 'Informe sua senha'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
```

- [x] **Step 2: Write `src/components/app/password-checklist.tsx`**

```tsx
import { Check, X } from 'lucide-react'
import { passwordRequirements } from '@/lib/schemas/auth-schema'

export interface PasswordChecklistProps {
    password: string
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
    return (
        <ul data-slot="password-checklist" className="flex flex-col gap-1 text-sm">
            {passwordRequirements.map((req) => {
                const passed = req.test(password)
                return (
                    <li key={req.key} className="flex items-center gap-2" data-passed={passed ? '' : undefined}>
                        {passed ? (
                            <Check className="size-3.5 text-success" aria-hidden="true" />
                        ) : (
                            <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className={passed ? 'text-foreground' : 'text-muted-foreground'}>{req.label}</span>
                    </li>
                )
            })}
        </ul>
    )
}
```

- [x] **Step 3: Write `src/app/(auth)/cadastro/page.tsx`**

Client Component form using `react-hook-form` + `zodResolver(signUpSchema)`. On submit:
```tsx
const { data, error } = await authClient.signUp.email({
    email: values.email,
    password: values.password,
    name: values.name,
})
if (error) {
    toast.error(error.message || 'Erro ao criar conta')
    return
}
toast.success('Conta criada com sucesso!')
router.push('/inicio')
```
Render `<PasswordChecklist password={watch('password')} />` live under the password field.

- [x] **Step 4: Write `src/app/(auth)/login/page.tsx`**

Client Component form using `react-hook-form` + `zodResolver(signInSchema)`. On submit:
```tsx
const { data, error } = await authClient.signIn.email({
    email: values.email,
    password: values.password,
})
if (error) {
    toast.error('E-mail ou senha inválidos')
    return
}
router.push('/inicio')
```

- [x] **Step 5: Verify manually**

Run `pnpm dev`, visit `/cadastro`, verify password validation feedback, register a user, then log in.

- [x] **Step 6: Commit**

```bash
git add src/app/\(auth\) src/components/app/password-checklist.tsx src/lib/schemas/auth-schema.ts
git commit -m "feat: add Better Auth email/password login and registration pages"
```

---

### Task 8: `(app)` route guard + bottom-nav shell

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/app/bottom-nav.tsx`

**Interfaces:**
- Consumes: `auth.api.getSession` from `src/lib/auth.ts` (Task 5)
- Produces: authenticated layout shell for all pages in Section G (`/inicio`, `/mes`, `/relatorios`, `/ajustes`).

- [x] **Step 1: Write `src/components/app/bottom-nav.tsx`**

```tsx
'use client'

import { Home, Calendar, PieChart, Settings, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const tabs = [
    { href: '/inicio', label: 'Início', icon: Home },
    { href: '/mes', label: 'Mês', icon: Calendar },
    { href: '/relatorios', label: 'Relatórios', icon: PieChart },
    { href: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function BottomNav() {
    const pathname = usePathname()

    return (
        <nav data-slot="bottom-nav" className="fixed inset-x-0 bottom-0 flex items-center justify-between border-t border-border bg-surface px-2 py-1">
            {tabs.slice(0, 2).map((tab) => (
                <NavLink key={tab.href} {...tab} active={pathname === tab.href} />
            ))}
            <Link
                href="/inicio?focus=quick-add"
                aria-label="Adicionar despesa"
                className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
                <Plus className="size-5" />
            </Link>
            {tabs.slice(2).map((tab) => (
                <NavLink key={tab.href} {...tab} active={pathname === tab.href} />
            ))}
        </nav>
    )
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
    return (
        <Link
            href={href}
            data-active={active ? '' : undefined}
            className={twMerge('flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground data-[active]:text-primary')}
        >
            <Icon className="size-5" />
            {label}
        </Link>
    )
}
```

- [x] **Step 2: Write `src/app/(app)/layout.tsx`**

Server Component validating the authenticated session via `auth.api.getSession`:

```tsx
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { BottomNav } from '@/components/app/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session?.user) {
        redirect('/login')
    }

    return (
        <div className="flex min-h-screen flex-col pb-16">
            {children}
            <BottomNav />
        </div>
    )
}
```

- [x] **Step 3: Verify**

```bash
pnpm dev
```

Visit `/inicio` logged out — confirm redirect to `/login`. Sign in, confirm `/inicio` loads with the bottom navigation shell.

- [x] **Step 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/app/bottom-nav.tsx
git commit -m "feat: add Better Auth server route guard and bottom nav shell"
```
