// <!-- AGENT: DEVOPS -->
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Allow API routes and public submission pages to pass through without session checks.
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/e/') ||
    request.nextUrl.pathname.startsWith('/connect/')
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

  // Validate the session with Supabase instead of trusting cookie contents.
  // This prevents stale local/cloud cookies from reaching protected layouts.
  const { data: { user } } = await supabase.auth.getUser()

  // If trying to access protected route without a valid user
  if (!user) {
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

    const accountRoutes = ['/account', '/portal', '/claim-pending', '/signup', '/auth/callback']
    const isAccountRoute = accountRoutes.some((path) =>
      request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
    )

    if (!isAccountRoute) {
      const [
        { data: membership, error: membershipError },
        { data: isPlatformAdmin, error: platformAdminError },
      ] =
        await Promise.all([
          supabase
            .from('church_memberships')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle(),
          supabase.rpc('is_platform_admin'),
        ])

      if (membershipError || platformAdminError) {
        console.error('[proxy] tenant access lookup failed', {
          membership_error_code: membershipError?.code ?? null,
          platform_admin_error_code: platformAdminError?.code ?? null,
        })
        return response
      }

      if (!membership && !isPlatformAdmin) {
        return NextResponse.redirect(new URL('/account', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
