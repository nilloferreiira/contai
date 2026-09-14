import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt } from 'better-auth/plugins'
import { db, user, session, account, verification, jwks } from '@contai/db'
import { env } from './env'

export const auth = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins:
        process.env.NODE_ENV !== 'production' || process.env.TRUST_REQUEST_HOST === 'true'
            ? async (request) => {
                  // Trusts whatever Host the request arrived on (e.g. a LAN IP when
                  // testing from a phone), in addition to BETTER_AUTH_URL. Always on
                  // outside production; in production only when TRUST_REQUEST_HOST=true
                  // is explicitly set (e.g. a local `next start` used for LAN testing) —
                  // never set that in a real deployment.
                  const host = request?.headers.get('host')
                  return host ? [`http://${host}`, `https://${host}`] : []
              }
            : undefined,
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
