import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Jireh POS',
  description: 'Jireh Natural Foods — Point of Sale',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jireh POS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,   // prevent accidental pinch-zoom on POS tablet
  themeColor: '#349f2d',
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="apple-touch-icon" href="/jireh/logo.jpg" />
      <div className="h-screen bg-[#111311] overflow-hidden">
        {children}
      </div>
    </>
  );
}
