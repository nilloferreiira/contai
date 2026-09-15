import Link from 'next/link'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/forms/login-form'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
    title: 'Entrar',
}

export default function LoginPage() {
    return (
        <div data-slot="login-page" className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Entrar no Contai</CardTitle>
                    <CardDescription>Entre com seu e-mail e senha para continuar</CardDescription>
                </CardHeader>
                <CardContent>
                    <LoginForm />
                </CardContent>
                <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">
                        Não tem uma conta?{' '}
                        <Link href="/cadastro" className="text-primary underline-offset-4 hover:underline">
                            Cadastre-se
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
