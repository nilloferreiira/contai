import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt } from 'better-auth/plugins'
import { db, user, session, account, verification, jwks } from '@contai/db'
import { env } from './env'

export const auth = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins:
        process.env.NODE_ENV === 'production'
            ? undefined
            : async (request) => {
                  // Dev-only: trust whatever Host the request arrived on (e.g. a LAN IP
                  // when testing from a phone), in addition to BETTER_AUTH_URL. Never
                  // enabled in production.
                  const host = request?.headers.get('host')
                  return host ? [`http://${host}`, `https://${host}`] : []
              },
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: { user, session, account, verification, jwks },
    }),
    emailAndPassword: {
        enabled: true,
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes cache
            strategy: 'jwt',
        },
    },
    plugins: [
        jwt({
            sessionCookieCache: true,
        }),
    ],
})

export type Session = typeof auth.$Infer.Session
