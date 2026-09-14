'use client'

import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '@contai/api'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
