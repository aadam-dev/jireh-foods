import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#111311] flex items-center justify-center">
        <p className="text-sm text-[#aba8a4]">Loading…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
