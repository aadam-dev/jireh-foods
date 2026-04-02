"use client";

import { useEffect, useState } from "react";
import { SectionReveal } from "./components/SectionReveal";
import { HeroBackground } from "./components/HeroBackground";
import { JirehLogo } from "./components/JirehLogo";
import { MapEmbed } from "./components/MapEmbed";
import { MapPin, Phone, MessageCircle, Mail, ShoppingBag, Utensils, CupSoda } from "lucide-react";

const PHONE_DISPLAY = "055 113 3481";
const PHONE_TEL = "tel:+233551133481";
const MAPS = "https://maps.app.goo.gl/kfRUcx2bjwNJUWs79?g_st=ic";
const BOLT_FOOD = "https://food.bolt.eu/en/137-accra/p/182474-jireh-natural-foods/";
const WHATSAPP_ORDER = "https://wa.me/233551133481?text=Hello%20Jireh%20Natural%20Foods!%20I%20would%20like%20to%20place%20an%20order...";
const WHATSAPP_INQUIRY = "https://wa.me/233551133481?text=Hello%20Jireh%20Natural%20Foods!%20I%20would%20like%20to%20make%20an%20inquiry...";
const WHATSAPP = "https://wa.me/233551133481";
const EMAIL = "mailto:jirehnaturalfoodsgh@gmail.com";
const INSTAGRAM = "https://instagram.com/danquahkusi";
const FACEBOOK = "https://facebook.com/danquahkusi";
const YOUTUBE = "https://www.youtube.com/results?search_query=Chef+Princekay";

const FOOD_MENU = [
  { name: "Asian Fried Rice with Grilled Chicken", price: 80, desc: "Aromatic and perfectly seasoned." },
  { name: "Sea Food Fried Rice", price: 120, desc: "Loaded with fresh ocean catch." },
  { name: "Jollof Rice with Grilled Chicken", price: 65, desc: "Our bestselling classic." },
  { name: "Boiled Yam with Palava Sauce", price: 49, desc: "Rich spanich stew with fish and protein." },
  { name: "Japanese Fried Chicken", price: 60, desc: "Crispy bites of perfection." },
  { name: "Coriander Coleslaw", price: 60, desc: "Fresh, crunchy, and tangy side." },
  { name: "Banku with Okro/Groundnut Soup", price: 40, desc: "Served fresh and hot." },
  { name: "Fufu with Meat, Goat Light Soup", price: 60, desc: "Authentic comfort food." },
];

const JUICE_MENU = [
  { name: "Burkina", price: 15 },
  { name: "Sobolo", price: 10 },
  { name: "Millet drink", price: 10 },
  { name: "Pineapple drink", price: 10 },
];

const FEATURED_ITEMS = [
  {
    name: "Jollof Rice with Grilled Chicken",
    note: "Smoky, spicy and balanced with fresh herbs.",
    tag: "Bestseller",
    price: 65,
    image: "/jireh/food1.jpg",
  },
  {
    name: "Sea Food Fried Rice",
    note: "Loaded with seafood and aromatic spices.",
    tag: "Chef's Pick",
    price: 120,
    image: "/jireh/food2.jpg",
  },
  {
    name: "Fufu with Goat Light Soup",
    note: "Comforting soup with deep traditional flavor.",
    tag: "Classic",
    price: 60,
    image: "/jireh/fufu.png",
  },
];

const EXPERIENCE_PILLARS = [
  {
    title: "Natural Ingredients",
    body: "Fresh produce, quality proteins and no monosodium additives.",
  },
  {
    title: "Cooked with Care",
    body: "Home-style methods, bold Ghanaian taste and consistent quality.",
  },
  {
    title: "Fast, Friendly Service",
    body: "Quick dine-in and reliable online ordering in Adenta.",
  },
];

const GALLERY_ITEMS = [
  { src: "/jireh/food1.jpg", alt: "Jollof rice and grilled chicken plate" },
  { src: "/jireh/food2.jpg", alt: "Seafood fried rice close up" },
  { src: "/jireh/juice1.jpg", alt: "Fresh bottled sobolo drinks" },
  { src: "/jireh/juice2.jpg", alt: "Fresh bottled pineapple juice" },
];

export default function Home() {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-30% 0px -70% 0px" } 
    );

    const sections = document.querySelectorAll("section[id], div[id]");
    sections.forEach((section) => observer.observe(section));

    return () => sections.forEach((section) => observer.unobserve(section));
  }, []);

  const navItemClass = (id: string) =>
    `transition-colors duration-200 ${
      activeSection === id ? "text-[var(--accent)] font-semibold" : "text-white/80 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div id="home" className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[var(--surface-dark)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#" className="flex items-center gap-2" aria-label="Jireh Natural Foods home">
            <JirehLogo size={42} />
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="#about" className={navItemClass("about")}>About</a>
            <a href="#menu" className={navItemClass("menu")}>Menu</a>
            <a href="#visit" className={navItemClass("visit")}>Visit</a>
            <a href="#contact" className={navItemClass("contact")}>Contact</a>
            
            <div className="flex items-center gap-3 border-l border-white/20 pl-7">
              <a
                href={BOLT_FOOD}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10"
              >
                <ShoppingBag className="w-4 h-4" /> Bolt Food
              </a>
              <a
                href={WHATSAPP_ORDER}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-white shadow-lg transition hover:bg-[var(--accent-hover)]"
              >
                <MessageCircle className="w-4 h-4" /> Order WhatsApp
              </a>
            </div>
          </nav>
        </div>
      </div>

      <HeroBackground>
        <div className="flex flex-col items-center gap-6 pt-10">
          <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-bright)]">
            Adenta's natural food spot
          </span>
          <div className="hidden md:block">
            <JirehLogo size={108} />
          </div>
          <h1 className="max-w-3xl text-balance font-serif text-4xl font-semibold tracking-tight drop-shadow-sm md:text-6xl">
            Jireh Natural Foods
          </h1>
          <p className="max-w-2xl text-balance font-sans text-lg text-white/95 md:text-xl">
            Modern Ghanaian dining with grilled specials, wholesome juices and authentic flavor.
          </p>
          <p className="text-sm text-white/80 md:text-base">
            No monosodium foods. Fresh, home-style cooking in Adenta Housing Down.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 z-20">
            <a
              href={WHATSAPP_ORDER}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-white shadow-[0_0_20px_rgba(52,159,45,0.4)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-[0_0_25px_rgba(52,159,45,0.6)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--surface-dark)]"
            >
              <MessageCircle className="w-5 h-5" /> Order via WhatsApp
            </a>
            <a
              href={BOLT_FOOD}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 font-semibold backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--surface-dark)]"
            >
              <ShoppingBag className="w-5 h-5" /> Order on Bolt Food
            </a>
            <a
              href={MAPS}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 font-semibold backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--surface-dark)]"
            >
              <MapPin className="w-5 h-5" /> Get directions
            </a>
            <a
              href={PHONE_TEL}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 font-semibold backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--surface-dark)]"
            >
              <Phone className="w-5 h-5" /> Call now
            </a>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-black/40 px-4 py-2 text-sm backdrop-blur">
            <span className="font-semibold text-[var(--accent-bright)]">★ 4.3</span>
            <span className="text-white/90">Bolt Food favourite in Adenta</span>
          </div>
          <div className="mt-5 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 z-20">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur shadow-lg">
              <p className="text-xl font-semibold text-white">9am - 8:30pm</p>
              <p className="text-xs text-white/70">Mon - Sat (Sun 12-8pm)</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur shadow-lg">
              <p className="text-2xl font-semibold text-white">100%</p>
              <p className="text-sm text-white/70">No monosodium foods</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur shadow-lg">
              <p className="text-2xl font-semibold text-white">Fast</p>
              <p className="text-sm text-white/70">Pickup and delivery</p>
            </div>
          </div>
        </div>
      </HeroBackground>

      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <SectionReveal className="mb-20 md:mb-28" delay={0.1}>
          <div id="about" className="grid gap-8 rounded-3xl border border-white/5 bg-[var(--card)] p-8 shadow-[var(--shadow-soft)] md:grid-cols-[1.4fr_1fr] md:p-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-light)]/50 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <p className="form-serif text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                About Jireh
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
                Built for comfort, flavor and quality
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                Jireh Natural Foods serves honest, home-style Ghanaian meals with a focus on natural
                ingredients. Every dish is prepared for rich taste, clean eating and memorable dining.
              </p>
            </div>
            <div className="grid gap-3 relative z-10">
              {EXPERIENCE_PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-white/5 bg-[var(--surface-light)] p-5 shadow-sm transition hover:bg-[var(--surface-light)]/80"
                >
                  <h3 className="font-semibold text-[var(--foreground)]">{pillar.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        <SectionReveal className="mb-20 md:mb-28" delay={0.1}>
          <div className="grid gap-8 rounded-3xl border border-white/5 bg-gradient-to-r from-[var(--surface-light)] to-[var(--surface-dark-soft)] p-8 shadow-[var(--shadow-soft)] md:grid-cols-[1fr_1.4fr] md:p-10 items-center">
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)] flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Our Spot
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
                Our Adenta Location
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">
                Where the magic happens. Our spotless Adenta location where we serve hundreds of our community members with authentic, monosodium-free Ghanaian dishes. Stop by and feel the warmth.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[20px] shadow-[var(--shadow-dark)] ring-1 ring-white/10 group">
              <img src="/jireh/hero.jpg" alt="Jireh Natural Foods Kiosk" className="w-full object-cover h-64 md:h-[400px] transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </SectionReveal>

        <SectionReveal className="mb-20 md:mb-28" delay={0.15}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Signature picks
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
                Featured dishes loved by guests
              </h2>
            </div>
            <a
              href="#menu"
              className="rounded-full border border-white/10 bg-[var(--card)] px-5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              View full menu
            </a>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {FEATURED_ITEMS.map((item) => (
              <article
                key={item.name}
                className="group rounded-3xl border border-white/5 bg-[var(--card)] p-3 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-dark)]"
              >
                <div className="mb-4 overflow-hidden rounded-2xl relative">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-48 w-full object-cover transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                </div>
                <div className="px-3 pb-3">
                  <span className="inline-flex rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-bright)] border border-[var(--accent)]/20">
                    {item.tag}
                  </span>
                  <h3 className="mt-4 font-serif text-2xl font-semibold text-[var(--foreground)]">
                    {item.name}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.note}</p>
                  <p className="mt-5 text-xl font-semibold text-[var(--accent)]">
                    GH₵ {item.price.toFixed(2)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </SectionReveal>

        <SectionReveal className="mb-20 md:mb-28" delay={0.1}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Real food, real moments
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
                From our kitchen and juice bar
              </h2>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {GALLERY_ITEMS.map((item) => (
              <div
                key={item.src}
                className="overflow-hidden rounded-2xl border border-white/5 bg-[var(--card)] shadow-[var(--shadow-soft)]"
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  className="h-36 w-full object-cover transition duration-500 hover:scale-105 md:h-52"
                />
              </div>
            ))}
          </div>
        </SectionReveal>

        <SectionReveal className="mb-20 md:mb-28" delay={0.1}>
          <div id="menu" className="flex flex-wrap items-center gap-4">
            <h2 className="font-serif text-4xl font-semibold text-[var(--foreground)] md:text-5xl">
              Our Full Menu
            </h2>
            <span className="rounded-full bg-[var(--accent)]/10 px-4 py-1.5 text-sm font-semibold text-[var(--accent-bright)] ring-1 ring-[var(--accent)]/20">
              No monosodium foods
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
            Wholesome Ghanaian meals, grilled specials and fresh juices made daily. Hand-crafted with natural ingredients.
          </p>
          
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            
            {/* Food Menu Card */}
            <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-[1px] shadow-[var(--shadow-soft)] group">
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/5 to-transparent rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full rounded-[2rem] bg-[var(--card)]/90 backdrop-blur-xl p-8 md:p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-[var(--accent)]/10 text-[var(--accent)] rounded-2xl border border-[var(--accent)]/20">
                    <Utensils className="w-8 h-8" />
                  </div>
                  <h3 className="font-serif text-3xl font-semibold text-[var(--foreground)]">Food</h3>
                </div>
                
                <ul className="space-y-6" role="list">
                  {FOOD_MENU.map((item) => (
                    <li key={item.name} className="group/item relative pb-6 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-medium text-[var(--foreground)] group-hover/item:text-[var(--accent-bright)] transition-colors">
                            {item.name}
                          </h4>
                          {item.desc && (
                            <p className="mt-1 text-sm text-[var(--muted)]">{item.desc}</p>
                          )}
                        </div>
                        <span className="font-semibold tabular-nums text-[var(--accent-bright)] text-lg whitespace-nowrap bg-[var(--surface-dark)] px-3 py-1 rounded-lg">
                          GH₵ {item.price.toFixed(2)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Juice Menu Card */}
            <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-[1px] shadow-[var(--shadow-soft)] group">
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/5 to-transparent rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full rounded-[2rem] bg-[var(--card)]/90 backdrop-blur-xl p-8 md:p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-[var(--accent)]/10 text-[var(--accent)] rounded-2xl border border-[var(--accent)]/20">
                    <CupSoda className="w-8 h-8" />
                  </div>
                  <h3 className="font-serif text-3xl font-semibold text-[var(--foreground)]">Juices</h3>
                </div>
                
                <ul className="space-y-6" role="list">
                  {JUICE_MENU.map((item) => (
                    <li key={item.name} className="group/item relative pb-6 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-lg font-medium text-[var(--foreground)] group-hover/item:text-[var(--accent-bright)] transition-colors">
                          {item.name}
                        </h4>
                        <span className="font-semibold tabular-nums text-[var(--accent-bright)] text-lg whitespace-nowrap bg-[var(--surface-dark)] px-3 py-1 rounded-lg">
                          GH₵ {item.price.toFixed(2)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </SectionReveal>

        <SectionReveal className="mb-20 md:mb-28" delay={0.1}>
          <div id="visit" className="grid gap-8 md:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Visit us
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
                Hours and location
              </h2>
              <div className="mt-8 grid gap-5">
                <div className="rounded-2xl border border-white/5 bg-[var(--card)] p-6 shadow-[var(--shadow-soft)] flex items-start gap-4">
                  <MapPin className="w-6 h-6 text-[var(--accent)] mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg text-[var(--foreground)]">Address</h3>
                    <p className="mt-2 text-[var(--muted)] leading-relaxed">
                      Jireh Natural Foods,<br/>Adenta Housing Down, Accra, Ghana
                    </p>
                    <a
                      href={MAPS}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1 font-medium text-[var(--accent-bright)] hover:underline focus:outline-none"
                    >
                      Open in Google Maps →
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-[var(--card)] p-6 shadow-[var(--shadow-soft)] flex items-start gap-4">
                  <CupSoda className="w-6 h-6 text-[var(--accent)] mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg text-[var(--foreground)]">Opening hours</h3>
                    <div className="mt-2 flex flex-col gap-2 font-medium text-white/90">
                      <p className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg inline-block text-sm">
                        Mon - Sat: 9:00 AM - 8:30 PM
                      </p>
                      <p className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg inline-block text-sm">
                        Sunday: 12:00 PM - 8:00 PM
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 rounded-[2rem] overflow-hidden shadow-[var(--shadow-dark)] ring-1 ring-white/10 relative">
              <MapEmbed />
            </div>
          </div>
        </SectionReveal>

        <SectionReveal className="mb-20 md:mb-28" delay={0.1}>
          <div
            id="contact"
            className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[var(--surface-dark)] to-[var(--surface-dark-soft)] p-8 text-white shadow-[var(--shadow-dark)] md:p-14 border border-[var(--border-strong)]"
          >
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-3xl" />
            
            <div className="relative z-10 max-w-4xl">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-bright)]">
                <Phone className="w-4 h-4" /> Contact
              </p>
              <h2 className="mt-4 font-serif text-4xl font-semibold md:text-5xl leading-tight">
                Get in Touch or Book your Meal
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-white/70">
                Call ahead for quick pickup, make inquiries, or order online for fresh delivery to your doorstep.
              </p>
              
              <div className="mt-10 flex flex-col gap-8">
                <div className="flex flex-wrap gap-4">
                  <a
                    href={WHATSAPP_INQUIRY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-8 py-5 font-semibold text-white transition hover:bg-[var(--accent-hover)] hover:-translate-y-1 shadow-[0_10px_30px_-5px_rgba(52,159,45,0.4)] ring-1 ring-white/10"
                  >
                    <MessageCircle className="w-6 h-6" />
                    <span>WhatsApp Inquiry</span>
                  </a>
                  <a
                    href={BOLT_FOOD}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-3 rounded-2xl bg-white/10 px-8 py-5 font-semibold text-white transition hover:bg-white/20 hover:-translate-y-1 ring-1 ring-white/10 backdrop-blur-sm shadow-lg"
                  >
                    <ShoppingBag className="w-6 h-6 text-[var(--accent-bright)]" />
                    <span>Bolt Food</span>
                  </a>
                </div>

                <div className="flex items-center gap-2 text-white/50">
                  <div className="h-[1px] flex-1 bg-white/10" />
                  <span className="text-xs uppercase tracking-widest font-semibold px-2">More Ways to Connect</span>
                  <div className="h-[1px] flex-1 bg-white/10" />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6">
                  <a
                    href={PHONE_TEL}
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group"
                    title={PHONE_DISPLAY}
                  >
                    <Phone className="w-6 h-6 text-[var(--accent-bright)] group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href={EMAIL}
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group"
                    title="Email Us"
                  >
                    <Mail className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href={FACEBOOK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group"
                    title="Facebook"
                  >
                    <Facebook className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href={INSTAGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group"
                    title="Instagram"
                  >
                    <Instagram className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href={YOUTUBE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group"
                    title="YouTube"
                  >
                    <Youtube className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      </main>

      <footer className="border-t border-white/5 bg-[var(--card)] px-6 py-12 pb-24 sm:pb-12 text-center md:text-left">
        <div className="mx-auto max-w-6xl grid md:grid-cols-[2fr_1fr] gap-10">
          <div>
            <JirehLogo size={56} dark />
            <p className="mt-6 text-[var(--muted)] max-w-sm">
              Authentic Ghanaian dining with grilled specials, wholesome juices, and a commitment to zero monosodium foods.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/5 text-[var(--muted)] hover:bg-[var(--accent)] hover:text-white transition-colors">
                <MessageCircle className="w-5 h-5" />
              </a>
              <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/5 text-[var(--muted)] hover:bg-[#1877F2] hover:text-white transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/5 text-[var(--muted)] hover:bg-[#E4405F] hover:text-white transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href={YOUTUBE} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/5 text-[var(--muted)] hover:bg-[#FF0000] hover:text-white transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="grid gap-4 md:justify-end">
            <div>
              <h4 className="font-semibold text-[var(--foreground)] mb-4">Location</h4>
              <p className="text-sm text-[var(--muted)]">Adenta Housing Down, <br/>Accra, Ghana</p>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--foreground)] mt-4 mb-4">Hours</h4>
              <p className="text-sm text-[var(--muted)]">Mon - Sat: 9:00 AM - 8:30 PM</p>
              <p className="text-sm text-[var(--muted)]">Sunday: 12:00 PM - 8:00 PM</p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl mt-12 pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[var(--muted)]">
            © {new Date().getFullYear()} Jireh Natural Foods. All rights reserved.
          </p>
          <a
            href={BOLT_FOOD}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--accent-bright)] hover:underline flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Order on Bolt Food
          </a>
        </div>
      </footer>
    </div>
  );
}

const Facebook = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
  </svg>
);

const Instagram = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
  </svg>
);

const Youtube = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z" clipRule="evenodd" />
  </svg>
);
