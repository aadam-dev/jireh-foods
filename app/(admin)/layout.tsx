'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/src/components/admin/Sidebar';
import { ErrorBoundary } from '@/src/components/ui/ErrorBoundary';
import { UserRole } from '@prisma/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/admin/inventory/low-stock')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setLowStockCount(d.count ?? 0))
      .catch(() => {});
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      fetch('/api/admin/inventory/low-stock')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setLowStockCount(d.count ?? 0))
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#111311] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#aba8a4]">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const user = session!.user as { name: string; email: string; role: UserRole };

  return (
    <div className="flex h-screen bg-[#111311] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar user={user} lowStockCount={lowStockCount} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10">
            <Sidebar user={user} lowStockCount={lowStockCount} onClose={() => setSidebarOpen(false)} mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[#2b2f2b] bg-[#0a0b0a] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-[#aba8a4] hover:text-[#f4efeb] hover:bg-white/5 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-[#f4efeb]">Jireh Natural Foods</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
