'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { useCards, useDeleteCard } from '@/hooks/use-cards'
import { useCategories, useDeleteCategory } from '@/hooks/use-categories'
import { CardVisual } from '@/components/app/card-visual'
import { CardForm } from '@/components/forms/card-form'
import { CategoryForm } from '@/components/forms/category-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

export default function AjustesPage() {
    const router = useRouter()
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const deleteCard = useDeleteCard()
    const deleteCategory = useDeleteCategory()

    const [cardDialogOpen, setCardDialogOpen] = useState(false)
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
    const [dark, setDark] = useState(() => typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark')

    function toggleTheme(checked: boolean) {
        setDark(checked)
        document.documentElement.classList.toggle('dark', checked)
        localStorage.setItem('theme', checked ? 'dark' : 'light')
    }

    async function handleSignOut() {
        await authClient.signOut()
        router.push('/login')
    }

    return (
        <main className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium text-foreground">Cartões</h2>
                {cards.map((card) => (
                    <div key={card.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <CardVisual size="sm" color={card.color} name={card.name} />
                            <span className="text-foreground">{card.name}</span>
                        </div>
                        <Button variant="ghost" onClick={() => deleteCard.mutate({ id: card.id })}>
                            Remover
                        </Button>
                    </div>
                ))}
                <Button variant="secondary" onClick={() => setCardDialogOpen(true)}>
                    Adicionar cartão
                </Button>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium text-foreground">Categorias</h2>
                {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{category.name}</span>
                        <Button variant="ghost" onClick={() => deleteCategory.mutate({ id: category.id })}>
                            Remover
                        </Button>
                    </div>
                ))}
                <Button variant="secondary" onClick={() => setCategoryDialogOpen(true)}>
                    Adicionar categoria
                </Button>
            </section>

            <section className="flex items-center justify-between">
                <span className="text-foreground">Modo escuro</span>
                <Switch checked={dark} onCheckedChange={toggleTheme} />
            </section>

            <Button variant="destructive" onClick={handleSignOut}>
                Sair
            </Button>

            <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo cartão</DialogTitle>
                    </DialogHeader>
                    <CardForm onSuccess={() => setCardDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova categoria</DialogTitle>
                    </DialogHeader>
                    <CategoryForm onSuccess={() => setCategoryDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </main>
    )
}
