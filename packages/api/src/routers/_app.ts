import { router } from '../trpc'
import { cardsRouter } from './cards'
import { categoriesRouter } from './categories'

export const appRouter = router({
    cards: cardsRouter,
    categories: categoriesRouter,
})

export type AppRouter = typeof appRouter
