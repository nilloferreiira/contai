import 'server-only'
import { headers } from 'next/headers'
import { appRouter, createContext } from '@contai/api'

export async function getServerCaller() {
    const ctx = await createContext({ headers: await headers() })
    return appRouter.createCaller(ctx)
}
