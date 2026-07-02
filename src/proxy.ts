// <!-- AGENT: DEVOPS -->
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Allow API routes and event links to pass through completely without session checks
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/e/')
  ) {
    return NextResponse.next()
  }

  // Check session for all other routes
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // If trying to access protected route without session
  if (!session) {
    // Only redirect to login if it's not a public route
    if (
      request.nextUrl.pathname !== '/' &&
      request.nextUrl.pathname !== '/login' &&
      request.nextUrl.pathname !== '/signup' &&
      request.nextUrl.pathname !== '/auth/callback' &&
      request.nextUrl.pathname !== '/guide'
    ) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } else {
    // If logged in, redirect away from landing page and login page
    if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/account', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
