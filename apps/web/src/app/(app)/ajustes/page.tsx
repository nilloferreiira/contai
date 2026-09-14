'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_CATEGORIES } from '@contai/domain'
import { authClient } from '@/lib/auth-client'
import { useCards, useDeleteCard } from '@/hooks/use-cards'
import { useCategories, useDeleteCategory } from '@/hooks/use-categories'
import { CardVisual } from '@/components/app/card-visual'
import { CardForm } from '@/components/forms/card-form'
import { CategoryForm } from '@/components/forms/category-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

// Minimal external store for the `dark` class on <html>. The root layout
// applies that class before paint via an inline script (reading
// localStorage), so reading it back through useSyncExternalStore keeps the
// server snapshot (`false`) and the client's first render in sync, avoiding
// a hydration mismatch, and lets toggleTheme notify this component to
// re-render without calling setState from an effect.
const themeListeners = new Set<() => void>()

function subscribeTheme(listener: () => void) {
    themeListeners.add(listener)
    return () => themeListeners.delete(listener)
}

function getThemeSnapshot() {
    return document.documentElement.classList.contains('dark')
}

function getThemeServerSnapshot() {
    return false
}

export default function AjustesPage() {
    const router = useRouter()
    const { data: cards = [], isError: cardsError } = useCards()
    const { data: categories = [], isError: categoriesError } = useCategories()
    const defaultCategoryNames = new Set(DEFAULT_CATEGORIES.map((name) => name.toLowerCase()))
    const deleteCard = useDeleteCard()
    const deleteCategory = useDeleteCategory()

    const [cardDialogOpen, setCardDialogOpen] = useState(false)
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
    const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)

    function toggleTheme(checked: boolean) {
        document.documentElement.classList.toggle('dark', checked)
        localStorage.setItem('theme', checked ? 'dark' : 'light')
        themeListeners.forEach((listener) => listener())
    }

    async function handleSignOut() {
        await authClient.signOut()
        router.push('/login')
    }

    return (
        <main className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium text-foreground">Cartões</h2>
                {cardsError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}
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
                {categoriesError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}
                {categories.map((category) => {
                    const isDefault = defaultCategoryNames.has(category.name.toLowerCase())
                    return (
                        <div key={category.id} className="flex items-center justify-between gap-2">
                            <span className="text-foreground">{category.name}</span>
                            {!isDefault && (
                                <Button variant="ghost" onClick={() => deleteCategory.mutate({ id: category.id })}>
                                    Remover
                                </Button>
                            )}
                        </div>
                    )
                })}
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
