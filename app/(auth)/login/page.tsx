'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Leaf, Lock, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
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
        router.push('/admin');
        router.refresh();
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111311] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#349f2d]/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-[#5ecf4f]/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#349f2d]/20 border border-[#349f2d]/40 mb-4">
            <Leaf className="text-[#5ecf4f]" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Jireh Natural Foods</h1>
          <p className="text-sm text-[#aba8a4] mt-1">Back Office System</p>
        </div>

        {/* Card */}
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

        <p className="text-center text-xs text-[#aba8a4]/60 mt-6">
          © {new Date().getFullYear()} Jireh Natural Foods · Adenta, Accra
        </p>
      </div>
    </div>
  );
}
