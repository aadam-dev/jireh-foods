'use client';

/* One toast system for the whole back office.
   ────────────────────────────────────────────────────────────────────────────
   Admin screens used to fire mutations and ignore the response: if the server
   rejected a save, the modal closed anyway and the owner walked away believing
   it worked. That is the worst failure mode in a business system — silent data
   loss — and it was repeated across 15 call sites.

   Rather than bolt a different error banner onto every page, mutations now
   throw (see api-client) and land here. Errors persist until dismissed;
   successes fade. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type ToastTone = 'success' | 'error';
interface Toast { id: number; tone: ToastTone; message: string }

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Errors stay put — a failed save is not something to blink and miss. */
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    setToasts(prev => [...prev, { id: Date.now() + Math.random(), tone, message }]);
  }, []);

  // Memoised: a fresh object here would re-render every consumer on each toast.
  const api = useMemo<ToastApi>(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
    }),
    [push],
  );

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.tone === 'error') return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast.tone, onDismiss]);

  const isError = toast.tone === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_8px_28px_-12px_rgba(28,36,32,0.35)]"
      style={{
        background: isError ? '#FBEAE8' : 'var(--fl-brand-soft, #E4F0E8)',
        borderColor: isError ? 'rgba(192,57,43,0.3)' : 'rgba(30,92,58,0.28)',
      }}
    >
      {isError ? (
        <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--fl-bad, #C0392B)' }} />
      ) : (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--fl-brand, #1E5C3A)' }} />
      )}
      <p className="flex-1 text-[13px] leading-snug" style={{ color: 'var(--fl-ink, #1C2420)' }}>
        {toast.message}
      </p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
        style={{ color: 'var(--fl-ink, #1C2420)' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Outside the provider (e.g. the POS, which has its own dark shell) fall
    // back to a no-op rather than crashing the screen the user is standing at.
    return { success: () => {}, error: () => {} };
  }
  return ctx;
}
