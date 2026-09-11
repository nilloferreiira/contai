# Bolso MVP Implementation Plan — Section A: Foundation

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

## Section A: Foundation

### Task 1: Dependencies, ESLint rules, root CLAUDE.md

**Files:**
- Modify: `package.json` (via `pnpm add`)
- Create: `eslint.config.mjs` rules addition (modify existing file)
- Create: `CLAUDE.md` (root — currently just `@AGENTS.md`)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: all packages below available to every later task; ESLint fails the build on `export default` (outside `page.tsx`/`layout.tsx`/`route.ts`) and on `any`.

- [x] **Step 1: Install runtime + dev dependencies**

```bash
pnpm add better-auth drizzle-orm postgres @tanstack/react-query @tanstack/react-query-devtools zod react-hook-form @hookform/resolvers tailwind-variants tailwind-merge lucide-react sonner date-fns
pnpm add -D drizzle-kit vitest @vitejs/plugin-react jsdom @testing-library/react
```

- [x] **Step 2: Read current `eslint.config.mjs`**

Run: `cat eslint.config.mjs` — confirm it's the default flat-config array exported from `create-next-app` before editing, so the added rules merge into the existing array rather than replacing it.

- [x] **Step 3: Add the no-default-export and no-any rules**

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

- [x] **Step 4: Verify the rule fires**

Create a scratch file `src/app/scratch-test.ts` containing `export default function scratch() {}` and run:

```bash
pnpm lint
```

Expected: lint fails on `scratch-test.ts` with the `import/no-default-export` error. Delete the scratch file after confirming.

- [x] **Step 5: Write root CLAUDE.md**

```markdown
# Bolso

Mobile-first personal finance manager. Core feature: register an expense
in under 15 seconds via a deterministic (regex, no AI) natural-language
parser. Next.js App Router + PostgreSQL (Drizzle ORM) + Better Auth (with
JWT plugin, email/password only — no Google OAuth in MVP).

## Structure

- `src/app/(auth)/` — login/cadastro pages
- `src/app/(app)/` — authenticated pages (inicio, mes, relatorios, ajustes) behind a session guard
- `src/app/api/` — REST-ish route handlers, see `src/app/api/CLAUDE.md`
- `src/app/api/auth/[...all]/` — Better Auth route handlers
- `src/components/ui/` — shadcn components
- `src/components/app/` — app-specific components (quick-add, occurrence list, card-visual, ...)
- `src/components/forms/` — react-hook-form + zod forms
- `src/hooks/` — React Query hooks
- `src/lib/finance/` — pure domain logic, see `src/lib/finance/CLAUDE.md`
- `src/lib/auth.ts` — Better Auth server instance
- `src/lib/auth-client.ts` — Better Auth client instance
- `src/lib/schemas/` — zod schemas, see `src/lib/schemas/CLAUDE.md`
- `src/db/` — Drizzle ORM client, schema, and migrations
- `drizzle.config.ts` — Drizzle Kit configuration

## Conventions

- Files: lowercase-with-hyphens. Always named exports (except `page.tsx`/`layout.tsx`/`route.ts`). No barrel files.
- Components: `twMerge('base', className)`, `data-slot="name"`, state via `data-*` attributes, icons sized explicitly, icon-only buttons have `aria-label`.
- No hardcoded colors — only tokens from `globals.css` (`bg-surface`, `text-foreground`, etc).
- Multi-tenant isolation: every query explicitly filters `userId` matching `session.user.id` and `isNull(deletedAt)`.
- All occurrence data (UI + reports) reads `expense_installments`, never `expenses` directly.
- Full design spec: `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`.
```

- [x] **Step 6: Commit**

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

- [x] **Step 1: Init shadcn**

```bash
pnpm dlx shadcn@latest init
```

- [x] **Step 2: Add the component set**

```bash
pnpm dlx shadcn@latest add button card input label select dialog sheet drawer tabs badge switch separator skeleton popover calendar command scroll-area
```

- [x] **Step 3: Replace `src/app/globals.css` color tokens**

Replace the `@theme`/`:root` block generated by shadcn init with the exact tokens from the spec (`docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`, section 3) — copy the full `:root`, `.dark`, and `@theme inline` blocks verbatim, keeping the `@import 'tailwindcss'` and `@custom-variant dark` lines shadcn generated above them (merge, don't duplicate).

> **Superseded (2026-09-11):** the tokens above were self-authored and never
> actually matched `swift-spend` — the existing MVP whose visual identity is
> the real design reference. Tokens were re-themed to swift-spend's actual
> OKLCH palette (forest-green primary, vivid lime accent, warm cream
> background) and `--radius` bumped from `0.75rem` to `1rem`, keeping contai's
> existing variable names (`--surface`, `--surface-raised`,
> `--foreground-subtle`, `--primary-hover`, `--success`, `--warning`) so no
> component needed a class-name rename:
>
> ```css
> :root {
>     --background: oklch(0.975 0.008 95);
>     --surface: oklch(1 0 0);
>     --surface-raised: oklch(0.965 0.01 100);
>
>     --foreground: oklch(0.24 0.03 160);
>     --foreground-subtle: oklch(0.45 0.02 150);
>     --muted: oklch(0.945 0.01 100);
>     --muted-foreground: oklch(0.52 0.025 150);
>
>     --primary: oklch(0.33 0.06 163);            /* deep forest green */
>     --primary-hover: oklch(0.28 0.06 163);
>     --primary-foreground: oklch(0.98 0.02 110);
>
>     --secondary: oklch(0.94 0.015 120);
>     --secondary-foreground: oklch(0.3 0.05 163);
>
>     --destructive: oklch(0.6 0.2 25);
>     --destructive-foreground: oklch(0.98 0.01 95);
>
>     --success: oklch(0.6 0.15 150);
>     --warning: oklch(0.75 0.14 80);
>
>     --border: oklch(0.9 0.012 120);
>     --input: oklch(0.9 0.012 120);
>     --ring: oklch(0.55 0.09 160);
>
>     --radius: 1rem;
>
>     --card: var(--surface);
>     --card-foreground: var(--foreground);
>     --popover: var(--surface-raised);
>     --popover-foreground: var(--foreground);
>     --accent: oklch(0.88 0.17 118);             /* vivid lime */
>     --accent-foreground: oklch(0.26 0.05 150);
> }
>
> .dark {
>     --background: oklch(0.19 0.02 160);
>     --surface: oklch(0.23 0.02 160);
>     --surface-raised: oklch(0.27 0.02 160);
>     --foreground: oklch(0.96 0.01 110);
>     --foreground-subtle: oklch(0.78 0.015 120);
>     --muted: oklch(0.29 0.02 150);
>     --muted-foreground: oklch(0.66 0.02 140);
>     --border: oklch(0.32 0.02 150);
>     --input: oklch(0.34 0.02 150);
> }
> ```
>
> `@theme inline` also gained `--font-heading: var(--font-display)` (fixes
> `card.tsx`'s `CardTitle` which referenced an undefined `font-heading` class).
> Because Tailwind v4 resolves `rounded-lg`/`rounded-xl`/etc. to
> `var(--radius-lg)` etc. — themselves derived from `--radius` — this single
> file change re-themes every shadcn primitive project-wide with no other code
> changes. `swift-spend`'s own `.dark` block is unmodified shadcn boilerplate
> (never actually reskinned), so contai's dark palette keeps deriving from the
> light one via the same relationships it already had, just shifted to green.

- [x] **Step 4: Add Figtree/Fraunces fonts in `src/app/layout.tsx`**

```tsx
import { Figtree, Fraunces } from 'next/font/google'

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans-override' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display-override' })
```

Apply `figtree.variable` and `fraunces.variable` as classes on the `<html>` or `<body>` tag so the `--font-sans` / `--font-display` theme tokens resolve to them.

- [x] **Step 5: Verify visually**

```bash
pnpm dev
```

Open the app in a browser, confirm the background/foreground read from tokens (inspect an element and check the computed `background-color` matches the `--surface` oklch value), and toggle OS dark mode to confirm `.dark` tokens apply.

- [x] **Step 6: Commit**

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

- [x] **Step 1: Write `query-provider.tsx`**

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

- [x] **Step 2: Wire into `src/app/layout.tsx`**

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

- [x] **Step 3: Verify**

```bash
pnpm dev
```

Confirm the app still renders with no console errors, and that the React Query devtools icon appears in the bottom corner.

- [x] **Step 4: Commit**

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

- [x] **Step 1: Write `vitest.config.ts`**

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

- [x] **Step 2: Add the `test` script to `package.json`**

```json
"scripts": {
    "test": "vitest run"
}
```

- [x] **Step 3: Write the failing sanity test**

```ts
// src/tests/sanity.test.ts
import { describe, expect, it } from 'vitest'

describe('vitest setup', () => {
    it('runs and resolves the @ alias', () => {
        expect(1 + 1).toBe(3)
    })
})
```

- [x] **Step 4: Run and confirm it fails**

```bash
pnpm test
```

Expected: FAIL — `expected 2 to be 3`.

- [x] **Step 5: Fix the assertion**

```ts
expect(1 + 1).toBe(2)
```

- [x] **Step 6: Run and confirm it passes**

```bash
pnpm test
```

Expected: PASS, 1 test.

- [x] **Step 7: Commit**

```bash
git add vitest.config.ts package.json src/tests/sanity.test.ts
git commit -m "chore: add vitest config and sanity test"
```

