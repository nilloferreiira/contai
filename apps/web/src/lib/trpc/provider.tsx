'use client'

import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import superjson from 'superjson'
import type { AppRouter } from '@contai/api'
import { TRPCProvider } from './client'

export function TRPCReactProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient()
    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
        }),
    )

    return (
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            {children}
        </TRPCProvider>
    )
}
