import { z } from 'zod'
import { protectedProcedure, router, mapServiceError } from '../trpc'
import { recurrencePatchSchema, getRecurrence, updateRecurrenceSettings, setRecurrenceActive } from '../services/recurrences-service'

export const recurrencesRouter = router({
    get: protectedProcedure
        .input(z.object({ id: z.uuid() }))
        .query(({ ctx, input }) => getRecurrence(ctx.db, ctx.userId, input.id).catch(mapServiceError)),

    update: protectedProcedure
        .input(z.object({ id: z.uuid(), data: recurrencePatchSchema }))
        .mutation(({ ctx, input }) => updateRecurrenceSettings(ctx.db, ctx.userId, input.id, input.data).catch(mapServiceError)),

    setActive: protectedProcedure
        .input(z.object({ id: z.uuid(), active: z.boolean() }))
        .mutation(({ ctx, input }) => setRecurrenceActive(ctx.db, ctx.userId, input.id, input.active).catch(mapServiceError)),
})
