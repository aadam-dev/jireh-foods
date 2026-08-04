import { Fraunces, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { AdminShell } from '@/src/components/admin/AdminShell';

/* Fresh Ledger type. Loaded here rather than in the root layout so the public
   marketing site keeps its two-font budget — data cost matters to our visitors. */
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`fresh-ledger ${fraunces.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
