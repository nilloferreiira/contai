import { mapServiceError, protectedProcedure, router } from '../trpc'
import { createExpenseInputSchema, createExpense } from '../services/expenses-service'

export const expensesRouter = router({
    create: protectedProcedure
        .input(createExpenseInputSchema)
        .mutation(({ ctx, input }) => createExpense(ctx.db, ctx.userId, input).catch(mapServiceError)),
})
