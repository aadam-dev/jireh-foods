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
    const userId = req.auth?.user?.id ?? ip;
    const { success } = await orderLimiter.limit(`order:${userId}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many orders submitted. Please slow down.' },
        { status: 429 },
      );
    }
  }

  // Auth routing handled by NextAuth authorized() callback in auth.config.ts
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/pos/:path*',
    '/login',
    '/api/admin/:path*',
    '/api/pos/:path*',
    '/api/auth/callback/credentials',
  ],
};
