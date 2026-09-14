import { db } from '@contai/db'
import { auth } from './auth'

export async function createContext({ headers }: { headers: Headers }) {
    const session = await auth.api.getSession({ headers })
    return { session, userId: session?.user.id ?? null, db }
}

export type Context = Awaited<ReturnType<typeof createContext>>
