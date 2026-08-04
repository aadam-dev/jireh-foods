import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { StickyCTA } from "./components/StickyCTA";
import { SessionProvider } from "next-auth/react";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Jireh Natural Foods | Award-Winning Natural Food in Adenta",
  description:
    "Start-Up Food Business of the Year 2026. Natural Ghanaian meals, grilled specials and wholesome juices. No monosodium foods at Jireh Natural Foods, Adenta Housing Down.",
  openGraph: {
    title: "Jireh Natural Foods | Award-Winning Natural Food in Adenta",
    description:
      "Winner — Start-Up Food Business of the Year 2026. Home-style Ghanaian dishes, grilled chicken and fresh juices. No monosodium foods. Adenta Housing Down, Accra.",
    images: ["/jireh/hero.jpg"],
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "Jireh Natural Foods",
  image: "/jireh/hero.jpg",
  servesCuisine: "Ghanaian",
  award: "Start-Up Food Business of the Year 2026 — Feleb Concepts Honours",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Adenta Housing Down",
    addressLocality: "Adenta, Accra",
    addressCountry: "GH",
  },
  telephone: "+233551133481",
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "11:00",
    closes: "20:00",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.3",
    reviewCount: "3114",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
        <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
          {children}
        </SessionProvider>
        <StickyCTA />
      </body>
    </html>
  );
}
