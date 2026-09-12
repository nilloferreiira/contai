import { router } from '../trpc'
import { cardsRouter } from './cards'
import { categoriesRouter } from './categories'
import { merchantsRouter } from './merchants'
import { expensesRouter } from './expenses'

export const appRouter = router({
    cards: cardsRouter,
    categories: categoriesRouter,
    merchants: merchantsRouter,
    expenses: expensesRouter,
})

export type AppRouter = typeof appRouter
