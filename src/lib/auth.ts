import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        // Normalize email to lowercase — all emails are stored lowercase
        const normalizedEmail = email.toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          passwordResetRequired: user.passwordResetRequired,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.passwordResetRequired = (user as any).passwordResetRequired;
      }
      // Sync role every 5 minutes
      if (token.id && (!token.lastSync || Date.now() - (token.lastSync as number) > 5 * 60 * 1000)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isActive: true, passwordResetRequired: true },
        });
        if (!dbUser || !dbUser.isActive) return null as any;
        token.role = dbUser.role;
        token.passwordResetRequired = dbUser.passwordResetRequired;
        token.lastSync = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).passwordResetRequired = token.passwordResetRequired;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
});
