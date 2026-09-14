import { z } from 'zod'

export const DEFAULT_CATEGORIES = [
    { name: 'Alimentação', icon: '🍔' },
    { name: 'Assinaturas', icon: '📺' },
    { name: 'Casa', icon: '🏠' },
    { name: 'Compras', icon: '🛍️' },
    { name: 'Contas', icon: '🧾' },
    { name: 'Educação', icon: '📚' },
    { name: 'Lazer', icon: '🎮' },
    { name: 'Mercado', icon: '🛒' },
    { name: 'Outros', icon: '📦' },
    { name: 'Saúde', icon: '💊' },
    { name: 'Trabalho', icon: '💻' },
    { name: 'Transporte', icon: '🚗' },
    { name: 'Viagem', icon: '✈️' },
] as const

export const categoryInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    icon: z.string().max(40).nullable().optional(),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>

export const updateCategoryInputSchema = categoryInputSchema.partial()
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>
