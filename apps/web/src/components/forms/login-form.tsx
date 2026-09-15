'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { signInSchema, type SignInInput } from '@contai/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInInput>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    })

    const onSubmit = async (data: SignInInput) => {
        const { error } = await authClient.signIn.email({
            email: data.email,
            password: data.password,
        })

        if (error) {
            toast.error('E-mail ou senha inválidos')
            return
        }

        router.push('/inicio')
    }

    return (
        <form data-slot="login-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
                {errors.email?.message ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={errors.password ? 'true' : undefined}
                    {...register('password')}
                />
                {errors.password?.message ? (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
        </form>
    )
}
