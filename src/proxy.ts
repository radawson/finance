import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Protect admin routes
    if (path.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Redirect authenticated users away from auth pages
    if ((path === '/login' || path === '/register') && token) {
      const redirectTo = token.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
      return NextResponse.redirect(new URL(redirectTo, req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        
        // Allow public routes
        const publicPaths = [
          '/',
          '/login',
          '/register',
          '/submit-ticket',
          '/enter-bill',
          '/api/auth',
          '/api/tickets/anonymous',
          '/api/tickets/magic',
          '/api/bills/anonymous',
          '/api/init',
        ]
        
        // Check if path starts with any public path
        if (publicPaths.some(publicPath => path.startsWith(publicPath))) {
          return true
        }
        
        // Allow magic link ticket viewing
        if (path.match(/^\/tickets\/view\/[^\/]+$/)) {
          return true
        }

        // Require authentication for all other routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tickets/:path*',
    '/bills/:path*',
    '/categories/:path*',
    '/vendors/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/enter-bill',
  ],
}

