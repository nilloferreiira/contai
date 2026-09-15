import { z } from 'zod'
import { categoryInputSchema, updateCategoryInputSchema } from '@contai/domain'
import { protectedProcedure, router, mapServiceError } from '../trpc'
import { listCategories, createCategory, updateCategory, deleteCategory } from '../services/categories-service'

export const categoriesRouter = router({
    list: protectedProcedure.query(({ ctx }) => listCategories(ctx.db, ctx.userId)),

    create: protectedProcedure
        .input(categoryInputSchema)
        .mutation(({ ctx, input }) => createCategory(ctx.db, ctx.userId, input).catch(mapServiceError)),

    update: protectedProcedure
        .input(z.object({ id: z.uuid(), data: updateCategoryInputSchema }))
        .mutation(({ ctx, input }) => updateCategory(ctx.db, ctx.userId, input.id, input.data).catch(mapServiceError)),

    delete: protectedProcedure
        .input(z.object({ id: z.uuid() }))
        .mutation(({ ctx, input }) => deleteCategory(ctx.db, ctx.userId, input.id).catch(mapServiceError)),
})
