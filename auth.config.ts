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
      const isApiRoute = nextUrl.pathname.startsWith('/api/');

      // This callback runs BEFORE the middleware body, so it — not the 401
      // branch in middleware.ts — decides what an unauthenticated API call
      // gets back. Redirecting an API request to the HTML login page makes
      // fetch() resolve 200 with a page body, which the POS offline queue then
      // fails to parse and reports as a generic error instead of "signed out".
      // Answer API routes with JSON and let pages redirect.
      const deny = (status: number, error: string) =>
        isApiRoute
          ? Response.json({ error }, { status })
          : Response.redirect(new URL(status === 403 ? '/pos' : '/login', nextUrl));

      // Redirect logged-in users away from login — respect callbackUrl
      if (isLoggedIn && isLoginPage) {
        const callbackUrl = nextUrl.searchParams.get('callbackUrl') ?? '';
        const wantsPOS = isPosOnlyRole || callbackUrl.includes('/pos');
        return Response.redirect(new URL(wantsPOS ? '/pos' : '/admin', nextUrl));
      }

      // Protect admin routes — POS-only roles are forbidden, not unauthenticated
      if (isAdminRoute) {
        if (!isLoggedIn) return deny(401, 'Unauthorized');
        if (isPosOnlyRole) return deny(403, 'Forbidden');
      }

      // Protect POS routes
      if (isPosRoute && !isLoggedIn) {
        return deny(401, 'Unauthorized');
      }

      return true;
    },
  },
  providers: [], // Filled in by auth.ts
};
