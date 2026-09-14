import { protectedProcedure, router } from '../trpc'
import { listMerchants } from '../services/merchants-service'

export const merchantsRouter = router({
    list: protectedProcedure.query(({ ctx }) => listMerchants(ctx.db, ctx.userId)),
})
