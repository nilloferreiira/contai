# Bolso MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

## Section A: Foundation

### Task 1: Dependencies, ESLint rules, root CLAUDE.md

**Files:**
- Modify: `package.json` (via `pnpm add`)
- Create: `eslint.config.mjs` rules addition (modify existing file)
- Create: `CLAUDE.md` (root — currently just `@AGENTS.md`)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: all packages below available to every later task; ESLint fails the build on `export default` (outside `page.tsx`/`layout.tsx`/`route.ts`) and on `any`.

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-query-devtools zod react-hook-form @hookform/resolvers tailwind-variants tailwind-merge lucide-react sonner date-fns
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react
```

- [ ] **Step 2: Read current `eslint.config.mjs`**

Run: `cat eslint.config.mjs` — confirm it's the default flat-config array exported from `create-next-app` before editing, so the added rules merge into the existing array rather than replacing it.

- [ ] **Step 3: Add the no-default-export and no-any rules**

Add a new config object to the exported array in `eslint.config.mjs`:

```js
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/**/route.ts"],
  rules: {
    "import/no-default-export": "error",
    "@typescript-eslint/no-explicit-any": "error",
  },
},
```

If `eslint-plugin-import` isn't already pulled in by `eslint-config-next`, add it: `pnpm add -D eslint-plugin-import` and add `"plugins": { import }` with the plugin imported at the top of the config file (`import importPlugin from "eslint-plugin-import"`, used as `import: importPlugin` in the plugins map for that config object).

- [ ] **Step 4: Verify the rule fires**

Create a scratch file `src/app/scratch-test.ts` containing `export default function scratch() {}` and run:

```bash
pnpm lint
```

Expected: lint fails on `scratch-test.ts` with the `import/no-default-export` error. Delete the scratch file after confirming.

- [ ] **Step 5: Write root CLAUDE.md**

```markdown
# Bolso

Mobile-first personal finance manager. Core feature: register an expense
in under 15 seconds via a deterministic (regex, no AI) natural-language
parser. Next.js App Router + Supabase (Postgres + Auth, email/password
only — no Google OAuth in MVP).

## Structure

- `src/app/(auth)/` — login/cadastro pages
- `src/app/(app)/` — authenticated pages (inicio, mes, relatorios, ajustes) behind a session guard
- `src/app/api/` — REST-ish route handlers, see `src/app/api/CLAUDE.md`
- `src/components/ui/` — shadcn components
- `src/components/app/` — app-specific components (quick-add, occurrence list, card-visual, ...)
- `src/components/forms/` — react-hook-form + zod forms
- `src/hooks/` — React Query hooks
- `src/lib/finance/` — pure domain logic, see `src/lib/finance/CLAUDE.md`
- `src/lib/supabase/` — Supabase clients, see `src/lib/supabase/CLAUDE.md`
- `src/lib/schemas/` — zod schemas, see `src/lib/schemas/CLAUDE.md`
- `supabase/migrations/` — SQL migrations

## Conventions

- Files: lowercase-with-hyphens. Always named exports (except `page.tsx`/`layout.tsx`/`route.ts`). No barrel files.
- Components: `twMerge('base', className)`, `data-slot="name"`, state via `data-*` attributes, icons sized explicitly, icon-only buttons have `aria-label`.
- No hardcoded colors — only tokens from `globals.css` (`bg-surface`, `text-foreground`, etc).
- All occurrence data (UI + reports) reads `expense_installments`, never `expenses` directly.
- Full design spec: `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`.
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml eslint.config.mjs CLAUDE.md
git commit -m "chore: add MVP dependencies, ESLint export/any rules, root CLAUDE.md"
```

---

### Task 2: shadcn/ui init, color tokens, fonts

**Files:**
- Create: `components.json` (via shadcn init)
- Create: `src/components/ui/*` (via shadcn add)
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx` (fonts only, providers come in Task 3)

**Interfaces:**
- Consumes: nothing new
- Produces: `bg-surface`, `bg-primary`, `text-foreground`, etc. Tailwind utility classes usable by every later component; `Button`, `Card`, `Input`, `Label`, `Select`, `Dialog`, `Sheet`, `Drawer`, `Tabs`, `Badge`, `Switch`, `Separator`, `Skeleton`, `Popover`, `Calendar`, `Command`, `ScrollArea` in `src/components/ui/`.

- [ ] **Step 1: Init shadcn**

```bash
pnpm dlx shadcn@latest init
```

- [ ] **Step 2: Add the component set**

```bash
pnpm dlx shadcn@latest add button card input label select dialog sheet drawer tabs badge switch separator skeleton popover calendar command scroll-area
```

- [ ] **Step 3: Replace `src/app/globals.css` color tokens**

Replace the `@theme`/`:root` block generated by shadcn init with the exact tokens from the spec (`docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`, section 3) — copy the full `:root`, `.dark`, and `@theme inline` blocks verbatim, keeping the `@import 'tailwindcss'` and `@custom-variant dark` lines shadcn generated above them (merge, don't duplicate).

- [ ] **Step 4: Add Figtree/Fraunces fonts in `src/app/layout.tsx`**

```tsx
import { Figtree, Fraunces } from 'next/font/google'

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans-override' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display-override' })
```

Apply `figtree.variable` and `fraunces.variable` as classes on the `<html>` or `<body>` tag so the `--font-sans` / `--font-display` theme tokens resolve to them.

- [ ] **Step 5: Verify visually**

```bash
pnpm dev
```

Open the app in a browser, confirm the background/foreground read from tokens (inspect an element and check the computed `background-color` matches the `--surface` oklch value), and toggle OS dark mode to confirm `.dark` tokens apply.

- [ ] **Step 6: Commit**

```bash
git add components.json src/components/ui src/app/globals.css src/app/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat: add shadcn/ui components and Bolso color tokens/fonts"
```

---

### Task 3: QueryProvider + Toaster

**Files:**
- Create: `src/providers/query-provider.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `@tanstack/react-query`, `sonner` (Task 1)
- Produces: `QueryProvider` component wrapping `children`; every later hook (`useQuery`/`useMutation`) and `toast.*()` call assumes this is mounted at the root.

- [ ] **Step 1: Write `query-provider.tsx`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
```

- [ ] **Step 2: Wire into `src/app/layout.tsx`**

Wrap `{children}` with `<QueryProvider>` and add `<Toaster />` from `sonner` as a sibling inside `<body>`:

```tsx
import { Toaster } from 'sonner'
import { QueryProvider } from '@/providers/query-provider'
// ...
<body className={...}>
    <QueryProvider>
        {children}
    </QueryProvider>
    <Toaster />
</body>
```

- [ ] **Step 3: Verify**

```bash
pnpm dev
```

Confirm the app still renders with no console errors, and that the React Query devtools icon appears in the bottom corner.

- [ ] **Step 4: Commit**

```bash
git add src/providers src/app/layout.tsx
git commit -m "feat: add QueryProvider and Toaster to root layout"
```

---

### Task 4: Vitest setup + placeholder domain test

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script)
- Create: `src/tests/sanity.test.ts`

**Interfaces:**
- Consumes: `vitest`, `jsdom` (Task 1)
- Produces: `pnpm test` runs and passes; every later domain-layer task (Section C) adds a file under `src/tests/` that this config discovers.

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
    },
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
})
```

- [ ] **Step 2: Add the `test` script to `package.json`**

```json
"scripts": {
    "test": "vitest run"
}
```

- [ ] **Step 3: Write the failing sanity test**

```ts
// src/tests/sanity.test.ts
import { describe, expect, it } from 'vitest'

describe('vitest setup', () => {
    it('runs and resolves the @ alias', () => {
        expect(1 + 1).toBe(3)
    })
})
```

- [ ] **Step 4: Run and confirm it fails**

```bash
pnpm test
```

Expected: FAIL — `expected 2 to be 3`.

- [ ] **Step 5: Fix the assertion**

```ts
expect(1 + 1).toBe(2)
```

- [ ] **Step 6: Run and confirm it passes**

```bash
pnpm test
```

Expected: PASS, 1 test.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts package.json src/tests/sanity.test.ts
git commit -m "chore: add vitest config and sanity test"
```

---

---

## Section B: Supabase & Auth (email/password only)

### Task 5: Create Supabase project + env vars + clients

**Files:**
- Create: `.env.local` (untracked — add to `.gitignore` if not already)
- Create: `.env.example`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/CLAUDE.md`

**Interfaces:**
- Consumes: `@supabase/supabase-js`, `@supabase/ssr` (Task 1)
- Produces: `createBrowserClient()` and `createClient()` (async, server) used by every later client/server call to Supabase.

- [ ] **Step 1: Create the Supabase project**

Via the Supabase dashboard (or `supabase projects create` with the CLI if already authenticated), create a new project for Bolso. Copy the Project URL and the publishable/anon API key.

- [ ] **Step 2: Enable email/password auth**

In the dashboard under Authentication → Providers, confirm Email is enabled. Leave all OAuth providers (Google included) disabled — out of MVP scope.

- [ ] **Step 3: Write env files**

```
# .env.local (untracked, real values)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

```
# .env.example (tracked, placeholders)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Confirm `.env.local` is listed in `.gitignore` (it is by default in `create-next-app`'s gitignore — verify with `grep .env.local .gitignore`).

- [ ] **Step 4: Write `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}
```

- [ ] **Step 5: Write `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                    } catch {
                        // called from a Server Component — middleware refreshes the session instead
                    }
                },
            },
        },
    )
}
```

- [ ] **Step 6: Write `src/lib/supabase/CLAUDE.md`**

```markdown
# src/lib/supabase

Two Supabase client factories:
- `client.ts` — `createClient()` for Client Components (browser cookies).
- `server.ts` — async `createClient()` for Server Components/Route Handlers (reads cookies via `next/headers`).

Never read `NEXT_PUBLIC_SUPABASE_*` outside these two files. Every route
handler and Server Component must call `supabase.auth.getUser()` itself —
RLS enforces row ownership, but 401s must be returned explicitly before
querying.
```

- [ ] **Step 7: Verify**

```bash
pnpm build
```

Expected: build succeeds (no runtime call yet, just confirms the files typecheck and env vars are read without throwing).

- [ ] **Step 8: Commit**

```bash
git add .env.example src/lib/supabase
git commit -m "feat: add Supabase browser/server clients and env config"
```

---

### Task 6: `middleware.ts` session refresh

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `@supabase/ssr`, env vars (Task 5)
- Produces: refreshed session cookies on every non-static request; Task 8's route guard relies on this running first.

- [ ] **Step 1: Write `src/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
                },
            },
        },
    )

    await supabase.auth.getUser()

    return response
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|webp)$).*)'],
}
```

- [ ] **Step 2: Verify**

```bash
pnpm dev
```

Open the app, open devtools → Application → Cookies, confirm `sb-*` cookies appear after any page load (even unauthenticated — they hold the anonymous/no-session state).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Supabase session-refresh middleware"
```

---

### Task 7: `/login` + `/cadastro` pages (email/password)

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/cadastro/page.tsx`
- Create: `src/components/app/password-checklist.tsx`
- Create: `src/lib/schemas/auth-schema.ts`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/client.ts` (Task 5), shadcn `Input`/`Label`/`Button`/`Card` (Task 2)
- Produces: working sign-up/sign-in flow; Task 8 assumes a session exists after this.

- [ ] **Step 1: Write `src/lib/schemas/auth-schema.ts`**

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

- [ ] **Step 2: Write `src/components/app/password-checklist.tsx`**

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

- [ ] **Step 3: Write `src/app/(auth)/cadastro/page.tsx`**

Client Component form using `react-hook-form` + `zodResolver(signUpSchema)`. On submit: `createClient().auth.signUp({ email, password })`. Render `<PasswordChecklist password={watch('password')} />` below the password field, updating live. On Supabase error, map known messages to Portuguese (`"Password should be at least"` → point at the checklist instead of a generic toast; `"User already registered"` → `"Este e-mail já está cadastrado"`) via `toast.error(...)` from `sonner`. On success, `toast.success('Conta criada! Verifique seu e-mail.')` and redirect to `/login`.

- [ ] **Step 4: Write `src/app/(auth)/login/page.tsx`**

Same structure with `signInSchema`, calling `createClient().auth.signInWithPassword({ email, password })`. On success, `router.push('/inicio')` (client-side `useRouter` from `next/navigation`). On error, `toast.error('E-mail ou senha inválidos')`.

- [ ] **Step 5: Verify manually**

```bash
pnpm dev
```

Go to `/cadastro`, type a weak password, confirm the checklist shows unmet items in real time; type a strong one, submit, confirm a Supabase user is created (check the dashboard's Authentication → Users list). Go to `/login` and sign in with those credentials, confirm no error toast.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\) src/components/app/password-checklist.tsx src/lib/schemas/auth-schema.ts
git commit -m "feat: add email/password login and signup pages"
```

---

### Task 8: `(app)` route guard + bottom-nav shell

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/app/bottom-nav.tsx`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/server.ts` (Task 5)
- Produces: every page in Section G (`/inicio`, `/mes`, `/relatorios`, `/ajustes`) is rendered as `children` of this layout and can assume a logged-in user.

- [ ] **Step 1: Write `src/components/app/bottom-nav.tsx`**

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

- [ ] **Step 2: Write `src/app/(app)/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/app/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()

    if (!data.user) {
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

- [ ] **Step 3: Verify**

```bash
pnpm dev
```

Visit `/inicio` while logged out — confirm redirect to `/login`. Log in, visit `/inicio` again — confirm the bottom nav renders with 4 tabs + center `+` button and the active tab is highlighted.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/app/bottom-nav.tsx
git commit -m "feat: add authenticated route guard and bottom nav shell"
```

---

## Section C: Database

### Task 9: `supabase/migrations/0001_init.sql`

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Consumes: nothing (raw SQL)
- Produces: `profiles`, `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, `expense_installments` tables — every task in Sections D onward (API routes, domain layer's DB-facing callers) assumes these columns exist exactly as named here.

This is one atomic task — a migration file can't be half-applied.

- [ ] **Step 1: Write the full migration**

```sql
-- supabase/migrations/0001_init.sql

create type expense_type as enum ('single','installment','recurring');
create type expense_status as enum ('pending','paid','cancelled');
create type frequency as enum ('weekly','monthly','yearly');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy "select own profile" on public.profiles for select
  to authenticated using ( (select auth.uid()) = id );
create policy "insert own profile" on public.profiles for insert
  to authenticated with check ( (select auth.uid()) = id );
create policy "update own profile" on public.profiles for update
  to authenticated using ( (select auth.uid()) = id ) with check ( (select auth.uid()) = id );

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  credit_limit numeric(12,2),
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cards enable row level security;
grant select, insert, update, delete on public.cards to authenticated;
grant all on public.cards to service_role;
create policy "select own cards" on public.cards for select
  to authenticated using ( (select auth.uid()) = user_id );
create policy "insert own cards" on public.cards for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own cards" on public.cards for update
  to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own cards" on public.cards for delete
  to authenticated using ( (select auth.uid()) = user_id );

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz not null default now()
);
create unique index categories_user_name_unique on public.categories (user_id, lower(name));
alter table public.categories enable row level security;
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
create policy "select own categories" on public.categories for select
  to authenticated using ( (select auth.uid()) = user_id );
create policy "insert own categories" on public.categories for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own categories" on public.categories for update
  to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own categories" on public.categories for delete
  to authenticated using ( (select auth.uid()) = user_id );

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_name text not null,
  display_name text not null,
  default_category_id uuid references public.categories(id) on delete set null,
  default_card_id uuid references public.cards(id) on delete set null,
  usage_count int not null default 0,
  created_at timestamptz not null default now()
);
create unique index merchants_user_normalized_unique on public.merchants (user_id, normalized_name);
alter table public.merchants enable row level security;
grant select, insert, update, delete on public.merchants to authenticated;
grant all on public.merchants to service_role;
create policy "select own merchants" on public.merchants for select
  to authenticated using ( (select auth.uid()) = user_id );
create policy "insert own merchants" on public.merchants for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own merchants" on public.merchants for update
  to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own merchants" on public.merchants for delete
  to authenticated using ( (select auth.uid()) = user_id );

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  frequency frequency not null,
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.recurrences enable row level security;
grant select, insert, update, delete on public.recurrences to authenticated;
grant all on public.recurrences to service_role;
create policy "select own recurrences" on public.recurrences for select
  to authenticated using ( (select auth.uid()) = user_id );
create policy "insert own recurrences" on public.recurrences for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own recurrences" on public.recurrences for update
  to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own recurrences" on public.recurrences for delete
  to authenticated using ( (select auth.uid()) = user_id );

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type expense_type not null,
  description text not null,
  merchant_id uuid references public.merchants(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  total_amount numeric(12,2) not null,
  purchase_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
create policy "select own expenses" on public.expenses for select
  to authenticated using ( (select auth.uid()) = user_id );
create policy "insert own expenses" on public.expenses for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own expenses" on public.expenses for update
  to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own expenses" on public.expenses for delete
  to authenticated using ( (select auth.uid()) = user_id );

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  installments_total int not null check (installments_total between 2 and 48),
  created_at timestamptz not null default now()
);
alter table public.installment_plans enable row level security;
grant select, insert, update, delete on public.installment_plans to authenticated;
grant all on public.installment_plans to service_role;
create policy "select own installment_plans" on public.installment_plans for select
  to authenticated using ( (select auth.uid()) = user_id );
create policy "insert own installment_plans" on public.installment_plans for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own installment_plans" on public.installment_plans for update
  to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own installment_plans" on public.installment_plans for delete
  to authenticated using ( (select auth.uid()) = user_id );

create table public.expense_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  installment_plan_id uuid references public.installment_plans(id) on delete cascade,
  recurrence_id uuid references public.recurrences(id) on delete cascade,
  merchant_id uuid references public.merchants(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  description text not null,
  installment_number int,
  installments_total int,
  amount numeric(12,2) not null,
  occurrence_date date not null,
  due_date date not null,
  invoice_month text not null,
  status expense_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index expense_installments_user_occurrence_idx on public.expense_installments (user_id, occurrence_date);
create index expense_installments_user_status_due_idx on public.expense_installments (user_id, status, due_date);
create index expense_installments_user_invoice_month_idx on public.expense_installments (user_id, invoice_month);
alter table public.expense_installments enable row level security;
grant select, insert, update, delete on public.expense_installments to authenticated;
grant all on public.expense_installments to service_role;
create policy "select own expense_installments" on public.expense_installments for select
  to authenticated using ( (select auth.uid()) = user_id );
create policy "insert own expense_installments" on public.expense_installments for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own expense_installments" on public.expense_installments for update
  to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own expense_installments" on public.expense_installments for delete
  to authenticated using ( (select auth.uid()) = user_id );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Apply the migration locally**

```bash
supabase link --project-ref <project-ref>
supabase db push
```

- [ ] **Step 3: Run the advisors**

```bash
supabase db advisors
```

Expected: no security warnings (every table has RLS enabled with per-command, ownership-scoped policies; `set_updated_at` is `security invoker`, not `security definer`).

- [ ] **Step 4: Verify manually**

In the Supabase SQL editor, run `select * from public.cards;` while impersonating a test user (or via the app once Task 19 exists) and confirm rows from other users never appear.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial database schema with RLS policies"
```

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

Pure domain logic — no Supabase import allowed here. Every function is a
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

    const { data, error } = await supabase.from('cards').update(parsed.data).eq('id', id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { error } = await supabase.from('cards').update({ active: false }).eq('id', id)
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

    const { data: existing, error } = await supabase.from('categories').select('*').order('name')
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

    const { data, error } = await supabase.from('categories').update(parsed.data).eq('id', id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { error } = await supabase.from('categories').delete().eq('id', id)
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

    const { data, error } = await supabase.from('merchants').select('*').order('usage_count', { ascending: false })
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
        const { data: cardRow } = await supabase.from('cards').select('closing_day, due_day').eq('id', input.cardId).single()
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
    let query = supabase.from('expense_installments').select('*').order('occurrence_date', { ascending: false })

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
        const { data, error } = await supabase.from('expense_installments').update(patch).eq('id', id).select('*').single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    const { data: current } = await supabase.from('expense_installments').select('*').eq('id', id).single()
    if (!current) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })

    let query = supabase.from('expense_installments').update(patch)

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

    if (scope === 'occurrence') {
        const { error } = await supabase.from('expense_installments').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true })
    }

    const { data: current } = await supabase.from('expense_installments').select('*').eq('id', id).single()
    if (!current) return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })

    let query = supabase.from('expense_installments').delete()

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

Reuse the installment expense created in Task 22's verification. `fetch('/api/occurrences?status=pending')` — confirm all 3 rows. `PATCH /api/occurrences/<id-of-2nd>?scope=future` with `{ status: 'paid' }` — confirm installments 2 and 3 flip to paid, installment 1 stays pending.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/occurrences src/hooks/use-occurrences.ts
git commit -m "feat: add occurrences API with scoped edit/delete"
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

    const { data, error } = await supabase.from('expense_installments').select('amount, category_id, card_id, status').eq('invoice_month', month)
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

---

## Section G: Pages

### Task 32: `/inicio`

**Files:**
- Create: `src/app/(app)/inicio/page.tsx`

**Interfaces:**
- Consumes: `QuickAdd` (Task 26), `ManualExpenseDialog` (Task 27), `OccurrenceList` (Task 28), `OccurrenceSheet` (Task 29), `SummaryTiles`/`useOccurrences`/`apiClient` for summary (Tasks 23-24, 30)
- Produces: the home page — no further tasks consume this directly, it's a leaf.

- [ ] **Step 1: Write the page**

Client Component (needs `useSearchParams` for the `focus=quick-add` param and local state for the selected occurrence / manual dialog open state). Structure:

```tsx
'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { QuickAdd } from '@/components/app/quick-add'
import { ManualExpenseDialog } from '@/components/app/manual-expense-dialog'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Button } from '@/components/ui/button'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { formatBRL } from '@/lib/finance/money'
import { toISODate } from '@/lib/finance/date'

export default function InicioPage() {
    const searchParams = useSearchParams()
    const shouldFocus = searchParams.get('focus') === 'quick-add'
    const [manualOpen, setManualOpen] = useState(false)
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    const today = toISODate(new Date())
    const month = today.slice(0, 7)

    const { data: summary } = useQuery({
        queryKey: queryKeys.summary(month),
        queryFn: () => apiClient.get<{ total: number }>(`/api/reports/summary?month=${month}`),
    })

    const { data: todayOccurrences = [] } = useOccurrences({ from: today, to: today })

    return (
        <main className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-semibold text-foreground">{summary ? formatBRL(summary.total) : '—'}</h1>
            <QuickAdd autoFocus={shouldFocus} />
            <Button variant="secondary" onClick={() => setManualOpen(true)}>
                Adicionar manualmente
            </Button>
            <h2 className="text-lg font-medium text-foreground">Hoje</h2>
            <OccurrenceList occurrences={todayOccurrences} onSelect={setSelected} />
            <ManualExpenseDialog open={manualOpen} onOpenChange={setManualOpen} />
            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
```

- [ ] **Step 2: Verify manually (golden path + edge case)**

```bash
pnpm dev
```

Golden path: land on `/inicio` via the bottom-nav `+`, confirm the quick-add is focused, type an expense, press Enter, confirm it appears under "Hoje" and the total updates. Edge case: with zero expenses ever created, confirm "Hoje" shows the `OccurrenceList` empty state ("Nenhuma despesa encontrada.") instead of crashing.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/inicio
git commit -m "feat: add /inicio page with quick-add and today's expenses"
```

---

### Task 33: `/mes`

**Files:**
- Create: `src/app/(app)/mes/page.tsx`

**Interfaces:**
- Consumes: `MonthSwitcher` (Task 30), `OccurrenceList` (Task 28), `OccurrenceSheet` (Task 29), `useOccurrences` (Task 23), `useCategories`/`useCards` (Tasks 19-20)
- Produces: the month page — leaf.

- [ ] **Step 1: Write the page**

Client Component with local state: `month` (default current, via `MonthSwitcher`), `search` (text input, debounced or plain controlled — plain is fine for MVP), `categoryFilter`/`cardFilter`/`typeFilter`/`statusFilter` (shadcn `Select`s populated from `useCategories()`/`useCards()`). Compute `from`/`to` as the first/last day of `month` and pass all filters into `useOccurrences({ from, to, q: search, categoryId: categoryFilter, cardId: cardFilter, status: statusFilter })`. Render `<OccurrenceList occurrences={data} showDateHeaders onSelect={setSelected} />` and `<OccurrenceSheet occurrence={selected} onOpenChange={...} />`.

- [ ] **Step 2: Verify manually (golden path + edge case)**

```bash
pnpm dev
```

Golden path: navigate to a month with known expenses (from Task 22's manual testing), confirm they're grouped by date. Edge case: filter by a category with zero matches, confirm the empty state shows instead of a blank screen; navigate to next/previous month via `MonthSwitcher` and confirm the list refetches (check the network tab for a new `/api/occurrences` call with updated `from`/`to`).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/mes
git commit -m "feat: add /mes page with month navigation, search, and filters"
```

---

### Task 34: `/relatorios`

**Files:**
- Create: `src/app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `SummaryTiles` (Task 30), `MonthSwitcher` (Task 30), `useCategories`/`useCards` (Tasks 19-20, to resolve IDs to names), `apiClient`/`queryKeys` for `/api/reports/summary` (Task 24)
- Produces: the reports page — leaf.

- [ ] **Step 1: Write the page**

Client Component: `month` state via `MonthSwitcher`, fetch `useQuery({ queryKey: queryKeys.summary(month), queryFn: () => apiClient.get(\`/api/reports/summary?month=${month}\`) })`. Resolve `byCategory`/`byCard` IDs to display names by cross-referencing `useCategories()`/`useCards()` data before passing into `<SummaryTiles>` — build a lookup map (`Object.fromEntries(categories.map(c => [c.id, c.name]))`) and remap the summary's keys, or extend `SummaryTiles` usage inline with a small wrapper that does the remap in this page (keep `SummaryTiles` itself ID-keyed and presentational, per Task 30's note).

- [ ] **Step 2: Verify manually (golden path + edge case)**

```bash
pnpm dev
```

Golden path: view the month used in Task 22's testing, confirm totals match what was verified there and category/card names (not raw UUIDs) are shown. Edge case: a month with zero occurrences shows `R$ 0,00` and empty category/card sections without crashing.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/relatorios
git commit -m "feat: add /relatorios page with monthly aggregations"
```

---

### Task 35: `/ajustes` (+ `forms/card-form.tsx` + `forms/category-form.tsx`)

**Files:**
- Create: `src/components/forms/card-form.tsx`
- Create: `src/components/forms/category-form.tsx`
- Create: `src/app/(app)/ajustes/page.tsx`

**Interfaces:**
- Consumes: `createCardSchema`/`createCategorySchema` (Task 18); `useCards`/`useCreateCard`/`useUpdateCard`/`useDeleteCard` (Task 19); `useCategories`/`useCreateCategory`/`useUpdateCategory`/`useDeleteCategory` (Task 20); `CardVisual`/`CardColorPicker` (Task 25); `createClient` (browser, Task 5) for sign-out
- Produces: the settings page — leaf.

- [ ] **Step 1: Write `src/components/forms/card-form.tsx`**

RHF + zod form (`zodResolver(createCardSchema)`) with fields: name (text), closing_day/due_day (number 1-31), credit_limit (optional number), color (`CardColorPicker`). Render a live `<CardVisual size="lg" color={watch('color')} name={watch('name')} />` preview above the fields as the user types/picks, per the spec's "seletor de cor com preview" requirement. On submit, call `useCreateCard()` or `useUpdateCard()` depending on whether an `id` prop was passed in.

- [ ] **Step 2: Write `src/components/forms/category-form.tsx`**

RHF + zod form (`zodResolver(createCategorySchema)`) with a single `name` text field (icon picker is out of scope for MVP — omit the `icon` field from the form, leave it `null`). Calls `useCreateCategory()`/`useUpdateCategory()`.

- [ ] **Step 3: Write `src/app/(app)/ajustes/page.tsx`**

Client Component with three sections: Cards (list via `useCards()`, each rendered with `<CardVisual size="sm">` + edit/delete buttons, plus an "add card" button opening `<CardForm>` in a `Dialog`), Categories (list via `useCategories()` with edit/delete, plus an "add category" button opening `<CategoryForm>` in a `Dialog`), and a "Sair" button calling `createClient().auth.signOut()` then `router.push('/login')`. Theme toggle: a `Switch` reading/writing a `dark` class on `document.documentElement` persisted to `localStorage` (no next-themes dependency needed for MVP's single light/dark toggle).

- [ ] **Step 4: Verify manually (golden path + edge case)**

```bash
pnpm dev
```

Golden path: create a card with a chosen color, confirm the `lg` preview updates live before submit and the card appears in the list afterward with the right color. Edge case: try deleting a category that's referenced by an existing occurrence — confirm the FK is `on delete set null` (per the Task 9 migration) so the delete succeeds and the occurrence's `category_id` becomes null rather than erroring. Toggle the theme switch, reload the page, confirm the choice persisted.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/card-form.tsx src/components/forms/category-form.tsx src/app/\(app\)/ajustes
git commit -m "feat: add /ajustes page with cards/categories CRUD and theme toggle"
```

---

## Section H: Polish

### Task 36: Loading/empty/error states + accessibility audit

**Files:**
- Modify: `src/components/app/occurrence-list.tsx` (loading/error variants)
- Modify: `src/app/(app)/inicio/page.tsx`, `src/app/(app)/mes/page.tsx`, `src/app/(app)/relatorios/page.tsx`, `src/app/(app)/ajustes/page.tsx` (loading/error rendering)
- Create: `src/components/ui/skeleton-list.tsx` (small shared skeleton block if not already covered by shadcn's `Skeleton`)

**Interfaces:**
- Consumes: `Skeleton` from shadcn (Task 2); `isLoading`/`isError` flags already returned by every `useQuery` hook from Sections E
- Produces: nothing new consumed later — this is the last content task before the final quality pass.

- [ ] **Step 1: Add loading skeletons**

In each of the four pages, destructure `isLoading` from the relevant `useQuery`/`useOccurrences`/etc. call and render 3-4 `<Skeleton className="h-11 w-full rounded-lg" />` rows in place of the list/tiles while `isLoading` is true.

- [ ] **Step 2: Add error states**

Destructure `isError` and render a short inline message (`"Não foi possível carregar. Tente novamente."`) with a `Button` that calls the query's `refetch()`.

- [ ] **Step 3: Accessibility pass**

Grep the codebase for icon-only interactive elements missing `aria-label`:

```bash
grep -rn "className=\"[^\"]*size-" src/components src/app | grep -B2 "onClick\|<button" | grep -L "aria-label"
```

Manually inspect each match (the grep is a starting point, not exhaustive) and add `aria-label` where missing. Confirm every interactive element (`button`, `a`, form controls) has `min-h-11 min-w-11` or equivalent 44px touch target via Tailwind's `size-11`/`min-h-11` utilities, and that focus-visible rings (`focus-visible:ring-2 focus-visible:ring-ring`) are present on every custom interactive element (shadcn components already have this).

- [ ] **Step 4: Verify**

```bash
pnpm dev
```

Tab through `/inicio`, `/mes`, `/relatorios`, `/ajustes` using only the keyboard — confirm every interactive element is reachable and shows a visible focus ring. Throttle network to "Slow 3G" in devtools and reload each page — confirm skeletons show before content.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: add loading/error states and accessibility touch-ups across pages"
```

---

### Task 37: Metadata, PWA basics, final quality pass

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/(app)/inicio/page.tsx`, `src/app/(app)/mes/page.tsx`, `src/app/(app)/relatorios/page.tsx`, `src/app/(app)/ajustes/page.tsx` (add `export const metadata`)
- Create: `public/manifest.webmanifest`
- Modify: `src/app/layout.tsx` (link the manifest)
- Modify: root `CLAUDE.md` (final structure overview)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Add per-page metadata**

Since these pages are Client Components (`'use client'`), add a sibling `export const metadata = { title: '...', description: '...' }` is not valid in a client file — instead, for each of the 6 pages, keep the page itself as the client component and move metadata to a `layout.tsx` in the same route segment if one doesn't already exist, or convert the page to export metadata from a co-located server wrapper only if needed. Simplest MVP-correct approach: add `export const metadata: Metadata = { title: 'Bolso — Início', description: '...' }` to `src/app/(app)/layout.tsx` and `src/app/(auth)/login/page.tsx`/`cadastro/page.tsx` if those two remain Server Components (they can be — only the form needs `'use client'`, which should be a child component, not the page itself; if Task 7 made the whole page a client component, split out a small `<LoginForm />`/`<CadastroForm />` client child now so the page file itself can stay a Server Component and export `metadata`).

- [ ] **Step 2: Write `public/manifest.webmanifest`**

```json
{
  "name": "Bolso",
  "short_name": "Bolso",
  "start_url": "/inicio",
  "display": "standalone",
  "background_color": "#FDF9F3",
  "theme_color": "#D97B33",
  "icons": []
}
```

Link it in `src/app/layout.tsx`'s `<head>` via `<link rel="manifest" href="/manifest.webmanifest" />` (or the `metadata.manifest` field if using the App Router `Metadata` API).

- [ ] **Step 3: Final root `CLAUDE.md` update**

Re-read the full `src/` tree (`find src -type f | sort`) and update the "Structure" section of root `CLAUDE.md` to match reality exactly — remove anything planned-but-unbuilt, add anything built that wasn't in the original list.

- [ ] **Step 4: Run the full quality gate**

```bash
pnpm typecheck
pnpm test
pnpm lint
```

Expected: all three clean. Fix any failures before proceeding — do not skip or suppress.

- [ ] **Step 5: Full manual walkthrough**

```bash
pnpm dev
```

Sign up with a new email → confirm redirected/prompted appropriately → log in → add an expense via quick-add → see it on `/inicio` and `/mes` → check `/relatorios` totals match → go to `/ajustes`, edit a card's color, confirm it's reflected everywhere the card appears → sign out → confirm redirected to `/login` and `/inicio` is no longer reachable without logging in again.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add page metadata, PWA manifest, and final CLAUDE.md update"
```

---

## Self-Review

**Spec coverage:** every numbered section of the design spec maps to at least one task — stack/setup → Task 1-4; naming/component rules → Global Constraints (enforced throughout); color tokens → Task 2; file tree → realized progressively across all tasks; data model → Task 9; domain layer (invoice/installments/recurrence/parser/merchants/dashboard) → Tasks 10-17; Supabase clients/guard → Tasks 5,6,8; API contract → Tasks 19-24; idempotent category seed → Task 20; forms/password checklist → Tasks 7,27,35; React Query → Task 18 (`query-keys.ts`) + every hook task; pages → Tasks 32-35; card-visual → Task 25; checklist section 13 → covered end-to-end; out-of-scope list → honored (no Open Finance/AI/bank integration/investments/multi-user/payments/Google OAuth anywhere in the plan).

**Placeholder scan:** no TBD/TODO; every code step has real, complete code; no "similar to Task N" cross-references without inline code.

**Type consistency:** `OccurrenceRow` (Task 23) is the single shared name for occurrence rows, reused identically in Tasks 28, 29, 32, 33 rather than redefined. `CreateExpenseInput`/`CreateCardInput`/`CreateCategoryInput` (Task 18) are the single source for those shapes, reused in Tasks 19, 20, 22, 26, 27, 35. `CardCycle` (Task 11) is reused unchanged through Tasks 12 and 22.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

