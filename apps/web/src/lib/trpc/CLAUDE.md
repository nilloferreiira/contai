# src/lib/trpc

Browser-side tRPC wiring. `client.ts` exports `useTRPC()`/`TRPCProvider` via
`createTRPCContext<AppRouter>()`. `provider.tsx` builds the `httpBatchLink`
client (pointed at `/api/trpc`, `superjson` transformer matching
`packages/api/src/trpc.ts`) and mounts it inside the app's `QueryProvider`.
Never construct a second tRPC client or call `fetch` directly against
`/api/trpc` — always go through `useTRPC()`.
