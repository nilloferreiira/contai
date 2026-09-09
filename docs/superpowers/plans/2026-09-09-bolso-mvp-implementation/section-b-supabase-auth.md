# Bolso MVP Implementation Plan — Section B: Supabase & Auth

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

- [x] **Step 1: Create the Supabase project**

Via the Supabase dashboard (or `supabase projects create` with the CLI if already authenticated), create a new project for Bolso. Copy the Project URL and the publishable/anon API key.

- [x] **Step 2: Enable email/password auth**

In the dashboard under Authentication → Providers, confirm Email is enabled. Leave all OAuth providers (Google included) disabled — out of MVP scope.

- [x] **Step 3: Write env files**

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

- [x] **Step 4: Write `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}
```

- [x] **Step 5: Write `src/lib/supabase/server.ts`**

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

- [x] **Step 6: Write `src/lib/supabase/CLAUDE.md`**

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

- [x] **Step 7: Verify**

```bash
pnpm build
```

Expected: build succeeds (no runtime call yet, just confirms the files typecheck and env vars are read without throwing).

- [x] **Step 8: Commit**

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

- [x] **Step 1: Write `src/middleware.ts`**

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

- [x] **Step 2: Verify**

```bash
pnpm dev
```

Open the app, open devtools → Application → Cookies, confirm `sb-*` cookies appear after any page load (even unauthenticated — they hold the anonymous/no-session state).

- [x] **Step 3: Commit**

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

Client Component form using `react-hook-form` + `zodResolver(signUpSchema)`. On submit: `createClient().auth.signUp({ email, password })`. Render `<PasswordChecklist password={watch('password')} />` below the password field, updating live. On Supabase error, map known messages to Portuguese (`"Password should be at least"` → point at the checklist instead of a generic toast; `"User already registered"` → `"Este e-mail já está cadastrado"`) via `toast.error(...)` from `sonner`. On success, `toast.success('Conta criada! Verifique seu e-mail.')` and redirect to `/login`.

- [x] **Step 4: Write `src/app/(auth)/login/page.tsx`**

Same structure with `signInSchema`, calling `createClient().auth.signInWithPassword({ email, password })`. On success, `router.push('/inicio')` (client-side `useRouter` from `next/navigation`). On error, `toast.error('E-mail ou senha inválidos')`.

- [x] **Step 5: Verify manually**

```bash
pnpm dev
```

Go to `/cadastro`, type a weak password, confirm the checklist shows unmet items in real time; type a strong one, submit, confirm a Supabase user is created (check the dashboard's Authentication → Users list). Go to `/login` and sign in with those credentials, confirm no error toast.

- [x] **Step 6: Commit**

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

- [x] **Step 3: Verify**

```bash
pnpm dev
```

Visit `/inicio` while logged out — confirm redirect to `/login`. Log in, visit `/inicio` again — confirm the bottom nav renders with 4 tabs + center `+` button and the active tab is highlighted.

- [x] **Step 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/app/bottom-nav.tsx
git commit -m "feat: add authenticated route guard and bottom nav shell"
```

