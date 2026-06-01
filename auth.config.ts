// Lightweight auth config used by middleware (no Prisma/bcrypt – edge-safe)
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    // Edge-safe token passthrough — keeps `role`/`id` on the token so middleware
    // can read them. (The full jwt callback with DB role-sync lives in
    // src/lib/auth.ts and runs at sign-in; here we only preserve the claims.)
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    // CRITICAL: surface `role` (and id) from the JWT onto `auth.user` so the
    // `authorized` callback AND the middleware role checks actually see the role.
    // Without this, role is undefined in the edge context and CASHIER/STAFF are
    // never redirected away from /admin (they could load the admin shell).
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = (token.id ?? token.sub) as string;
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as any)?.role;
      const isLoginPage = nextUrl.pathname === '/login';
      const isAdminRoute = nextUrl.pathname.startsWith('/admin') || nextUrl.pathname.startsWith('/api/admin');
      const isPosRoute = nextUrl.pathname.startsWith('/pos') || nextUrl.pathname.startsWith('/api/pos');
      const isPosOnlyRole = role === 'CASHIER' || role === 'STAFF';

      // Redirect logged-in users away from login — respect callbackUrl
      if (isLoggedIn && isLoginPage) {
        const callbackUrl = nextUrl.searchParams.get('callbackUrl') ?? '';
        const wantsPOS = isPosOnlyRole || callbackUrl.includes('/pos');
        return Response.redirect(new URL(wantsPOS ? '/pos' : '/admin', nextUrl));
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
