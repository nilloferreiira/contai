# Bolso MVP Implementation Plan — Section C: Database

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
- Soft deletes only: `cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, and `expense_installments` all carry a `deleted_at timestamptz` column. Nothing under `authenticated` ever issues a real `DELETE` on these tables — a "delete" always means `update({ deleted_at: <now> })`. `deleted_at is null` is enforced twice: at the RLS level (`select`/`update` policies exclude soft-deleted rows by default, so a query that forgets the filter still can't see or touch them) and explicitly in every app-level query that reads or writes one of these tables (`.is('deleted_at', null)` on selects, `.eq(...)` targets that assume a live row) — RLS is the backstop, not a replacement for the explicit filter.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/lib/supabase/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

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
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cards enable row level security;
grant select, insert, update on public.cards to authenticated;
grant all on public.cards to service_role;
create policy "select own cards" on public.cards for select
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null );
create policy "insert own cards" on public.cards for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own cards" on public.cards for update
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null ) with check ( (select auth.uid()) = user_id );

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index categories_user_name_unique on public.categories (user_id, lower(name)) where deleted_at is null;
alter table public.categories enable row level security;
grant select, insert, update on public.categories to authenticated;
grant all on public.categories to service_role;
create policy "select own categories" on public.categories for select
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null );
create policy "insert own categories" on public.categories for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own categories" on public.categories for update
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null ) with check ( (select auth.uid()) = user_id );

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_name text not null,
  display_name text not null,
  default_category_id uuid references public.categories(id) on delete set null,
  default_card_id uuid references public.cards(id) on delete set null,
  usage_count int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index merchants_user_normalized_unique on public.merchants (user_id, normalized_name) where deleted_at is null;
alter table public.merchants enable row level security;
grant select, insert, update on public.merchants to authenticated;
grant all on public.merchants to service_role;
create policy "select own merchants" on public.merchants for select
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null );
create policy "insert own merchants" on public.merchants for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own merchants" on public.merchants for update
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null ) with check ( (select auth.uid()) = user_id );

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  frequency frequency not null,
  start_date date not null,
  end_date date,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.recurrences enable row level security;
grant select, insert, update on public.recurrences to authenticated;
grant all on public.recurrences to service_role;
create policy "select own recurrences" on public.recurrences for select
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null );
create policy "insert own recurrences" on public.recurrences for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own recurrences" on public.recurrences for update
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null ) with check ( (select auth.uid()) = user_id );

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
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
grant select, insert, update on public.expenses to authenticated;
grant all on public.expenses to service_role;
create policy "select own expenses" on public.expenses for select
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null );
create policy "insert own expenses" on public.expenses for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own expenses" on public.expenses for update
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null ) with check ( (select auth.uid()) = user_id );

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  installments_total int not null check (installments_total between 2 and 48),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.installment_plans enable row level security;
grant select, insert, update on public.installment_plans to authenticated;
grant all on public.installment_plans to service_role;
create policy "select own installment_plans" on public.installment_plans for select
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null );
create policy "insert own installment_plans" on public.installment_plans for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own installment_plans" on public.installment_plans for update
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null ) with check ( (select auth.uid()) = user_id );

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
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index expense_installments_user_occurrence_idx on public.expense_installments (user_id, occurrence_date) where deleted_at is null;
create index expense_installments_user_status_due_idx on public.expense_installments (user_id, status, due_date) where deleted_at is null;
create index expense_installments_user_invoice_month_idx on public.expense_installments (user_id, invoice_month) where deleted_at is null;
alter table public.expense_installments enable row level security;
grant select, insert, update on public.expense_installments to authenticated;
grant all on public.expense_installments to service_role;
create policy "select own expense_installments" on public.expense_installments for select
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null );
create policy "insert own expense_installments" on public.expense_installments for insert
  to authenticated with check ( (select auth.uid()) = user_id );
create policy "update own expense_installments" on public.expense_installments for update
  to authenticated using ( (select auth.uid()) = user_id and deleted_at is null ) with check ( (select auth.uid()) = user_id );

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

In the Supabase SQL editor, run `select * from public.cards;` while impersonating a test user (or via the app once Task 19 exists) and confirm rows from other users never appear. Then set `deleted_at = now()` on a test row via `update` and re-run the same `select` — confirm the row disappears from the result even with no `deleted_at` filter in the query, proving the RLS policy (not just app-level filtering) hides soft-deleted rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial database schema with soft-delete RLS policies"
```

