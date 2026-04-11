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
      const isAdminRoute = nextUrl.pathname.startsWith('/admin');
      const isPosRoute = nextUrl.pathname.startsWith('/pos');
      const isLoginPage = nextUrl.pathname === '/login';
      const role = (auth?.user as any)?.role;

      if (isLoggedIn && isLoginPage) return Response.redirect(new URL('/admin', nextUrl));
      if ((isAdminRoute || isPosRoute) && !isLoggedIn) return Response.redirect(new URL('/login', nextUrl));
      return true;
    },
  },
  providers: [], // Filled in by auth.ts
};
