import Link from 'next/link'
import type { Metadata } from 'next'
import { CadastroForm } from '@/components/forms/cadastro-form'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
    title: 'Criar conta',
}

export default function CadastroPage() {
    return (
        <div data-slot="cadastro-page" className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Criar conta</CardTitle>
                    <CardDescription>Cadastre-se para começar a controlar seus gastos no Contai</CardDescription>
                </CardHeader>
                <CardContent>
                    <CadastroForm />
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
