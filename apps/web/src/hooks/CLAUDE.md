# src/hooks

React Query hooks over `@trpc/tanstack-react-query` — one file per resource
(`use-<resource>.ts`), named `use<Resource>()` for lists, `useCreate<Resource>()`/
`useUpdate<Resource>()`/`useDelete<Resource>()` for mutations. Every mutation
invalidates the resource's `queryKey()` on success and toasts via `sonner`. Never call
`fetch` directly here — always go through `useTRPC()`.
