import { auth } from '@/src/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;

  const isLoginPage = nextUrl.pathname === '/login';
  const isAdminRoute = nextUrl.pathname.startsWith('/admin');
  const isPosRoute = nextUrl.pathname.startsWith('/pos');
  const isApiAdmin = nextUrl.pathname.startsWith('/api/admin');
  const isApiPos = nextUrl.pathname.startsWith('/api/pos');

  // Redirect logged-in users away from login
  if (isLoggedIn && isLoginPage) {
    if (role === 'CASHIER' || role === 'STAFF') {
      return NextResponse.redirect(new URL('/pos', nextUrl));
    }
    return NextResponse.redirect(new URL('/admin', nextUrl));
  }

  // Protect admin routes
  if (isAdminRoute || isApiAdmin) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', nextUrl));
    }
    if (role === 'CASHIER' || role === 'STAFF') {
      return NextResponse.redirect(new URL('/pos', nextUrl));
    }
  }

  // Protect POS routes
  if (isPosRoute || isApiPos) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/pos/:path*',
    '/login',
    '/api/admin/:path*',
    '/api/pos/:path*',
  ],
};
