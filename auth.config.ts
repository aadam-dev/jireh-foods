// Lightweight auth config used by middleware (no Prisma/bcrypt – edge-safe)
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as any)?.role;
      const isLoginPage = nextUrl.pathname === '/login';
      const isAdminRoute = nextUrl.pathname.startsWith('/admin') || nextUrl.pathname.startsWith('/api/admin');
      const isPosRoute = nextUrl.pathname.startsWith('/pos') || nextUrl.pathname.startsWith('/api/pos');
      const isPosOnlyRole = role === 'CASHIER' || role === 'STAFF';

      // Redirect logged-in users away from login
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL(isPosOnlyRole ? '/pos' : '/admin', nextUrl));
      }

      // Protect admin routes — redirect POS-only roles to /pos
      if (isAdminRoute) {
        if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl));
        if (isPosOnlyRole) return Response.redirect(new URL('/pos', nextUrl));
      }

      // Protect POS routes
      if (isPosRoute && !isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      return true;
    },
  },
  providers: [], // Filled in by auth.ts
};
