'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { DEVELOPER_CREDIT } from '@/src/lib/developer-credit';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

function resolvePostLoginPath(role: string, callbackUrl: string | null): string {
  const posOnly = role === 'CASHIER' || role === 'STAFF';
  if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('/login')) {
    if (posOnly && callbackUrl.startsWith('/admin')) return '/pos';
    return callbackUrl;
  }
  return posOnly ? '/pos' : '/admin';
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    setServerError('');
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError('Invalid email or password. Please try again.');
      } else {
        const session = await getSession();
        const role = (session?.user as { role?: string } | undefined)?.role ?? '';
        const destination = resolvePostLoginPath(role, searchParams.get('callbackUrl'));
        window.location.assign(destination);
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111311] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#349f2d]/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-[#5ecf4f]/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden border border-[#349f2d]/40 mb-4 bg-white">
            <Image src="/jireh/logo.jpg" alt="Jireh Natural Foods" width={64} height={64} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Jireh Natural Foods</h1>
          <p className="text-sm text-[#aba8a4] mt-1">Staff sign in — register &amp; back office</p>
        </div>

        <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-7">
          <h2 className="text-base font-semibold text-[#f4efeb] mb-1">Welcome back</h2>
          <p className="text-sm text-[#aba8a4] mb-6">Sign in to your account to continue</p>

          {serverError && (
            <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@jireh.com"
              autoComplete="email"
              inputMode="email"
              // Phone keyboards capitalise and autocorrect by default, which
              // silently mangles the address and reads as a wrong password.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              icon={<Mail size={15} />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              icon={<Lock size={15} />}
              iconRight={
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="text-[#aba8a4] hover:text-[#f4efeb] transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
              Sign in
            </Button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <a
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm text-[#aba8a4] transition-colors hover:text-[#f4efeb]"
          >
            ← Back to the website
          </a>
        </div>

        <div className="text-center mt-2 space-y-1">
          <p className="text-xs text-[#aba8a4]/60">
            © {new Date().getFullYear()} Jireh Natural Foods · Adenta, Accra
          </p>
          <p className="text-[11px] text-[#aba8a4]/40">
            {DEVELOPER_CREDIT.tagline} by{' '}
            <a
              href={DEVELOPER_CREDIT.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-[#aba8a4]/70"
            >
              {DEVELOPER_CREDIT.domain}
            </a>
            {' · '}
            <a
              href={`tel:${DEVELOPER_CREDIT.phoneE164}`}
              className="underline underline-offset-2 transition-colors hover:text-[#aba8a4]/70"
            >
              {DEVELOPER_CREDIT.phoneDisplay}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
