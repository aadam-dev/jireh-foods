import { SessionProvider } from 'next-auth/react';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="h-screen bg-[#111311] overflow-hidden">
        {children}
      </div>
    </SessionProvider>
  );
}
