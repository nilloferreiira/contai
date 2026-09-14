import { z } from 'zod'

export const categoryInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    icon: z.string().max(40).nullable().optional(),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>

export const updateCategoryInputSchema = categoryInputSchema.partial()
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>
