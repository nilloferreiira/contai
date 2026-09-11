import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request)
    const { pathname } = request.nextUrl

    const isAuthPage = pathname === '/login' || pathname === '/cadastro'
    const isAppPage =
        pathname.startsWith('/inicio') ||
        pathname.startsWith('/mes') ||
        pathname.startsWith('/relatorios') ||
        pathname.startsWith('/ajustes')

    if (!sessionCookie && isAppPage) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (sessionCookie && isAuthPage) {
        return NextResponse.redirect(new URL('/inicio', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|webp)$).*)'],
}
