import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'
import { ServiceError } from './services/errors'

const t = initTRPC.context<Context>().create({ transformer: superjson })

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
    return next({ ctx: { ...ctx, userId: ctx.userId } })
})

const TRPC_ERROR_CODE = {
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INVALID_SCOPE: 'UNPROCESSABLE_CONTENT',
} as const

export function mapServiceError(error: unknown): never {
    if (error instanceof ServiceError) {
        throw new TRPCError({ code: TRPC_ERROR_CODE[error.code], message: error.message })
    }
    throw error
}
