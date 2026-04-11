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
  title: "Jireh Natural Foods | Adenta",
  description:
    "Natural Ghanaian meals, grilled specials and wholesome juices. No monosodium foods at Jireh Natural Foods, Adenta Housing Down.",
  openGraph: {
    title: "Jireh Natural Foods | Adenta",
    description:
      "Home-style Ghanaian dishes, grilled chicken and fresh juices. No monosodium foods. Adenta Housing Down, Accra.",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "Jireh Natural Foods",
  image: "https://images.unsplash.com/photo-1604908176997-125188eb3dd3?w=800&q=80",
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
        <SessionProvider>
          {children}
        </SessionProvider>
        <StickyCTA />
      </body>
    </html>
  );
}
