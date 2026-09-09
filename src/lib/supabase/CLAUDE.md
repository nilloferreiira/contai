# src/lib/supabase

Two Supabase client factories:
- `client.ts` — `createClient()` for Client Components (browser cookies).
- `server.ts` — async `createClient()` for Server Components/Route Handlers (reads cookies via `next/headers`).

Never read `NEXT_PUBLIC_SUPABASE_*` outside these two files. Every route
handler and Server Component must call `supabase.auth.getUser()` itself —
RLS enforces row ownership, but 401s must be returned explicitly before
querying.
