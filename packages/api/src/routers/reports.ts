import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'
import { getMonthSummary } from '../services/reports-service'

export const reportsRouter = router({
    summary: protectedProcedure
        .input(z.object({ month: z.string() }))
        .query(({ ctx, input }) => getMonthSummary(ctx.db, ctx.userId, input.month)),
})
