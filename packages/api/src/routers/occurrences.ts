import { z } from 'zod'
import { protectedProcedure, router, mapServiceError } from '../trpc'
import {
    occurrenceFiltersSchema,
    occurrencePatchSchema,
    scopeSchema,
    listOccurrences,
    updateOccurrence,
    deleteOccurrence,
} from '../services/occurrences-service'

export const occurrencesRouter = router({
    list: protectedProcedure
        .input(occurrenceFiltersSchema)
        .query(({ ctx, input }) => listOccurrences(ctx.db, ctx.userId, input)),

    update: protectedProcedure
        .input(z.object({ id: z.string().uuid(), scope: scopeSchema, data: occurrencePatchSchema }))
        .mutation(({ ctx, input }) =>
            updateOccurrence(ctx.db, ctx.userId, input.id, input.scope, input.data).catch(mapServiceError),
        ),

    delete: protectedProcedure
        .input(z.object({ id: z.string().uuid(), scope: scopeSchema }))
        .mutation(({ ctx, input }) => deleteOccurrence(ctx.db, ctx.userId, input.id, input.scope).catch(mapServiceError)),
})
