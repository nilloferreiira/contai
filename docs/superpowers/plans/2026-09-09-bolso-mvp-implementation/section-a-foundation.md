# Bolso MVP Implementation Plan — Section A: Foundation

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
pnpm add @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-query-devtools zod react-hook-form @hookform/resolvers tailwind-variants tailwind-merge lucide-react sonner date-fns
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react
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

