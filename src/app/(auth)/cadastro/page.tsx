'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { signUpSchema, type SignUpInput } from '@/lib/schemas/auth-schema'
import { PasswordChecklist } from '@/components/app/password-checklist'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CadastroPage() {
    const router = useRouter()
    const {
        control,
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignUpInput>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    })

    const password = useWatch({ control, name: 'password', defaultValue: '' })

    const onSubmit = async (data: SignUpInput) => {
        const supabase = createClient()
        const { error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
        })

        if (error) {
            const msg = error.message.toLowerCase()
            if (msg.includes('password should be at least') || msg.includes('weak password')) {
                toast.error('A senha não atende aos requisitos mínimos')
            } else if (msg.includes('already registered') || msg.includes('already in use')) {
                toast.error('Este e-mail já está cadastrado')
            } else {
                toast.error(error.message || 'Erro ao criar conta')
            }
            return
        }

        toast.success('Conta criada! Verifique seu e-mail.')
        router.push('/login')
    }

    return (
        <div data-slot="cadastro-page" className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Criar conta</CardTitle>
                    <CardDescription>Cadastre-se para começar a controlar seus gastos no Bolso</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu@email.com"
                                autoComplete="email"
                                aria-invalid={errors.email ? 'true' : undefined}
                                {...register('email')}
                            />
                            {errors.email?.message ? (
                                <p className="text-xs text-destructive">{errors.email.message}</p>
                            ) : null}
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                autoComplete="new-password"
                                aria-invalid={errors.password ? 'true' : undefined}
                                {...register('password')}
                            />
                            <PasswordChecklist password={password} />
                            {errors.password?.message ? (
                                <p className="text-xs text-destructive">{errors.password.message}</p>
                            ) : null}
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Criando conta...' : 'Cadastrar'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">
                        Já tem uma conta?{' '}
                        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                            Entrar
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
