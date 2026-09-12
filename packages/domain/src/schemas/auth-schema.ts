import { z } from 'zod'

export const passwordRequirements = [
    { key: 'length', label: 'Mínimo de 8 caracteres', test: (v: string) => v.length >= 8 },
    { key: 'lower', label: 'Uma letra minúscula', test: (v: string) => /[a-z]/.test(v) },
    { key: 'upper', label: 'Uma letra maiúscula', test: (v: string) => /[A-Z]/.test(v) },
    { key: 'number', label: 'Um número', test: (v: string) => /[0-9]/.test(v) },
    { key: 'symbol', label: 'Um símbolo', test: (v: string) => /[^a-zA-Z0-9]/.test(v) },
] as const

export const signUpSchema = z.object({
    name: z.string().min(2, 'Informe seu nome'),
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().refine((v) => passwordRequirements.every((r) => r.test(v)), {
        message: 'A senha não atende aos requisitos',
    }),
})

export const signInSchema = z.object({
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().min(1, 'Informe sua senha'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
