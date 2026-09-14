'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_CATEGORIES } from '@contai/domain'
import { authClient } from '@/lib/auth-client'
import { useCards, useDeleteCard, useUpdateCard } from '@/hooks/use-cards'
import { useCategories, useDeleteCategory } from '@/hooks/use-categories'
import { CardVisual } from '@/components/app/card-visual'
import { CardColorPicker } from '@/components/app/card-color-picker'
import { resolveCardColor } from '@/lib/finance/card-colors'
import { CardForm } from '@/components/forms/card-form'
import { CategoryForm } from '@/components/forms/category-form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

function CardsListSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-16 rounded-lg" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                </div>
            ))}
        </div>
    )
}

function CategoriesListSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
            ))}
        </div>
    )
}

export default function AjustesPage() {
    const router = useRouter()
    const { data: cards = [], isLoading: cardsLoading, isError: cardsError } = useCards()
    const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError } = useCategories()
    const defaultCategoryNames = new Set(DEFAULT_CATEGORIES.map((name) => name.toLowerCase()))
    const deleteCard = useDeleteCard()
    const updateCard = useUpdateCard()
    const deleteCategory = useDeleteCategory()

    // The forms stay mounted after a successful create (no more Dialog
    // unmount to discard react-hook-form state), so force a remount via key
    // change to reset them back to defaults and avoid a stray re-submit.
    const [cardFormKey, setCardFormKey] = useState(0)
    const [categoryFormKey, setCategoryFormKey] = useState(0)

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
            <Tabs defaultValue="cards">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="cards">Cartões</TabsTrigger>
                    <TabsTrigger value="categories">Categorias</TabsTrigger>
                </TabsList>

                <TabsContent value="cards" className="flex flex-col gap-6">
                    <CardForm key={cardFormKey} onSuccess={() => setCardFormKey((k) => k + 1)} />

                    <section className="flex flex-col gap-3">
                        {cardsError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}
                        {cardsLoading ? (
                            <CardsListSkeleton />
                        ) : (
                            cards.map((card) => (
                                <div key={card.id} className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <CardVisual size="sm" color={card.color} name={card.name} />
                                        <span className="text-foreground">{card.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CardColorPicker
                                            value={resolveCardColor(card.color)}
                                            onChange={(color) => updateCard.mutate({ id: card.id, data: { color } })}
                                        />
                                        <Button variant="ghost" onClick={() => deleteCard.mutate({ id: card.id })}>
                                            Remover
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                </TabsContent>

                <TabsContent value="categories" className="flex flex-col gap-6">
                    <CategoryForm key={categoryFormKey} onSuccess={() => setCategoryFormKey((k) => k + 1)} />

                    <section className="flex flex-col gap-3">
                        {categoriesError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}
                        {categoriesLoading ? (
                            <CategoriesListSkeleton />
                        ) : (
                            categories.map((category) => {
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
                            })
                        )}
                    </section>
                </TabsContent>
            </Tabs>

            <section className="flex items-center justify-between">
                <span className="text-foreground">Modo escuro</span>
                <Switch checked={dark} onCheckedChange={toggleTheme} />
            </section>

            <Button variant="destructive" onClick={handleSignOut}>
                Sair
            </Button>
        </main>
    )
}
