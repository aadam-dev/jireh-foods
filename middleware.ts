import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    '/admin/:path*',
    '/pos/:path*',
    '/login',
    '/api/admin/:path*',
    '/api/pos/:path*',
  ],
};
