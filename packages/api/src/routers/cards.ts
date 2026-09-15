import { z } from 'zod'
import { cardInputSchema, updateCardInputSchema } from '@contai/domain'
import { protectedProcedure, router, mapServiceError } from '../trpc'
import { listCards, createCard, updateCard, deleteCard } from '../services/cards-service'

export const cardsRouter = router({
    list: protectedProcedure.query(({ ctx }) => listCards(ctx.db, ctx.userId)),

    create: protectedProcedure
        .input(cardInputSchema)
        .mutation(({ ctx, input }) => createCard(ctx.db, ctx.userId, input)),

    update: protectedProcedure
        .input(z.object({ id: z.uuid(), data: updateCardInputSchema }))
        .mutation(({ ctx, input }) => updateCard(ctx.db, ctx.userId, input.id, input.data).catch(mapServiceError)),

    delete: protectedProcedure
        .input(z.object({ id: z.uuid() }))
        .mutation(({ ctx, input }) => deleteCard(ctx.db, ctx.userId, input.id).catch(mapServiceError)),
})
