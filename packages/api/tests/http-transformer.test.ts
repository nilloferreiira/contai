import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import superjson from 'superjson'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppRouter } from '../src'
import type { Context } from '../src/context'
import { appRouter } from '../src/routers/_app'
import { createTestUser, db, getCaller, truncateAll } from './helpers'

// Exercises the real fetch-adapter route (as used by apps/web's
// app/api/trpc/[trpc]/route.ts) end-to-end over an actual HTTP Request/Response
// pair, with a real @trpc/client link — the only thing bypassed is Better Auth's
// cookie-based session lookup, replaced with a fixed test userId. This is the
// wire format apps/web's future browser client will actually use.
function testFetchFor(userId: string) {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        return fetchRequestHandler({
            endpoint: '/api/trpc',
            req: request,
            router: appRouter,
            createContext: async (): Promise<Context> => ({ session: null, userId, db }),
        })
    }
}

describe('HTTP fetch-adapter + superjson transformer', () => {
    afterEach(async () => {
        await truncateAll()
    })

    it('a Date field survives a real HTTP round trip as an actual Date instance', async () => {
        const user = await createTestUser()
        await getCaller(user.id).cards.create({ name: 'Nubank', closingDay: 5, dueDay: 12, color: '#820ad1' })

        const client = createTRPCClient<AppRouter>({
            links: [
                httpBatchLink({
                    url: 'http://localhost/api/trpc',
                    transformer: superjson,
                    fetch: testFetchFor(user.id) as typeof fetch,
                }),
            ],
        })

        const result = await client.cards.list.query()

        expect(result).toHaveLength(1)
        expect(result[0].createdAt).toBeInstanceOf(Date)
    })
})
