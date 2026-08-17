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
  userScalable: false,
  // black-translucent puts the web view under the notch; without cover the
  // safe-area insets the sheets rely on all resolve to zero.
  viewportFit: 'cover' as const,   // prevent accidental pinch-zoom on POS tablet
  themeColor: '#349f2d',
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="apple-touch-icon" href="/jireh/logo.jpg" />
      {/* This wrapper owns the app's height and its top inset, so the eight
          full-screen views inside it do not each redeclare the viewport.
          statusBarStyle black-translucent plus viewportFit cover makes the
          page full-bleed on iOS, which puts the header under the notch
          without this padding. Border-box means the padding comes out of the
          height rather than adding to it, so children still fit exactly. */}
      <div
        className="h-app bg-[#111311] overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {children}
      </div>
    </>
  );
}
