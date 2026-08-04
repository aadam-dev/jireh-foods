'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/src/components/admin/Sidebar';
import { ErrorBoundary } from '@/src/components/ui/ErrorBoundary';
import { ToastProvider } from '@/src/components/admin/ui/toast';
import { UserRole } from '@prisma/client';

function ShellSpinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-[var(--fl-bg)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--fl-brand)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--fl-ink-2)]">{label}</p>
      </div>
    </div>
  );
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const user = session?.user as
    | { name?: string | null; email?: string | null; role?: UserRole }
    | undefined;

  /* The jwt callback in src/lib/auth.ts re-syncs the role every five minutes
     and returns null if the account has gone missing or inactive. During that
     transition useSession can briefly report "authenticated" with no user
     attached. Redirecting from inside render (as this used to) is also a React
     side-effect-in-render bug, so both cases are handled in an effect. */
  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && !user)) {
      router.replace('/login');
    }
  }, [status, user, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const load = () =>
      fetch('/api/admin/inventory/low-stock')
        .then(r => (r.ok ? r.json() : { count: 0 }))
        .then(d => setLowStockCount(d.count ?? 0))
        .catch(() => {});
    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === 'loading') return <ShellSpinner label="Loading…" />;
  // Never render the shell without a user — Sidebar reads name/role directly.
  if (!user) return <ShellSpinner label="Signing you in…" />;

  return (
    <div className="flex h-screen bg-[var(--fl-bg)] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar user={user} lowStockCount={lowStockCount} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 bg-[rgba(28,36,32,0.45)] backdrop-blur-sm"
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
        <header className="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b border-[var(--fl-line)] bg-[var(--fl-surface)] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="grid h-11 w-11 place-items-center rounded-xl text-[var(--fl-ink-2)] hover:text-[var(--fl-ink)] hover:bg-[var(--fl-surface-2)] transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="fl-display text-[15px] text-[var(--fl-ink)]">Jireh Back Office</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  /* Wraps the whole shell, not just the page. The sidebar used to sit outside
     the boundary, so a single bad field on the signed-in user replaced the
     entire back office with Next's bare "client-side exception" page instead
     of a recoverable in-app error. */
  return (
    <ErrorBoundary>
      <AdminShellInner>{children}</AdminShellInner>
    </ErrorBoundary>
  );
}
