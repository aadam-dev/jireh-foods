import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// ── CVE-2025-29927 patch ─────────────────────────────────────────────────────
// Strip x-middleware-subrequest before NextAuth sees it — prevents auth bypass
// where an attacker spoofs an internal header to skip auth checks.
function stripPoisonedHeaders(req: NextRequest): NextRequest {
  const patched = req.headers.get('x-middleware-subrequest');
  if (!patched) return req;
  const headers = new Headers(req.headers);
  headers.delete('x-middleware-subrequest');
  return new NextRequest(req.url, { method: req.method, headers, body: req.body });
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Gracefully disabled when UPSTASH_REDIS_REST_URL / TOKEN are not set.
// Activate by adding them to your .env — see .env.example for instructions.

type Limiter = { limit: (id: string) => Promise<{ success: boolean }> };
let loginLimiter: Limiter | null = null;
let orderLimiter: Limiter | null = null;

(async () => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return;
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ]);
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    // 10 login attempts per IP per 15 minutes
    loginLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '15 m'), prefix: 'rl:login' });
    // 120 POS orders per user per minute (covers fast-service peaks)
    orderLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'rl:order' });
  } catch (err: any) {
    console.warn('[rate-limit] Upstash init failed:', err?.message);
  }
})();

// ── Auth middleware (NextAuth v5) ─────────────────────────────────────────────
const { auth } = NextAuth(authConfig);

export default auth(async (req: NextRequest & { auth?: any }) => {
  const safe = stripPoisonedHeaders(req);
  const { pathname } = safe.nextUrl;
  const ip =
    safe.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    safe.headers.get('x-real-ip') ??
    '127.0.0.1';

  // ── Defense-in-depth auth guard ─────────────────────────────────────────────
  // The NextAuth authorized() callback in auth.config.ts is the primary gate.
  // This is a redundant hard-check so we never silently serve protected pages
  // if the callback misbehaves (e.g. NextAuth beta edge cases).
  const isLoggedIn = !!req.auth?.user;
  const role = (req.auth?.user as any)?.role as string | undefined;
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isPosRoute   = pathname === '/pos' || pathname.startsWith('/pos/') || pathname.startsWith('/api/pos');
  const isPosOnlyRole = role === 'CASHIER' || role === 'STAFF';

  if ((isAdminRoute || isPosRoute) && !isLoggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return Response.redirect(loginUrl);
  }

  // CASHIER / STAFF cannot access admin routes
  if (isAdminRoute && isLoggedIn && isPosOnlyRole) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return Response.redirect(new URL('/pos', req.url));
  }

  // Rate-limit login attempts
  if (loginLimiter && pathname === '/api/auth/callback/credentials' && req.method === 'POST') {
    const { success } = await loginLimiter.limit(`login:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
        { status: 429 },
      );
    }
  }

  // Rate-limit POS order creation per user
  if (orderLimiter && pathname === '/api/pos/orders' && req.method === 'POST') {
    const userId = (req.auth?.user as any)?.id ?? ip;
    const { success } = await orderLimiter.limit(`order:${userId}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many orders submitted. Please slow down.' },
        { status: 429 },
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Explicit bare-path entry ensures /pos itself is always matched,
    // not just /pos/* — avoids edge cases in Next.js middleware path matching.
    '/pos',
    '/admin',
    '/admin/:path*',
    '/pos/:path*',
    '/login',
    '/api/admin/:path*',
    '/api/pos/:path*',
    '/api/auth/callback/credentials',
  ],
};
