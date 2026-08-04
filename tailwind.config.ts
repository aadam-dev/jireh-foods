import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // Sidebar, shared UI and the Fresh Ledger components all live under src/.
    // Without this they only got the utilities that some app/ file happened to
    // use as well — classes unique to them were silently dropped from the build.
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-cormorant)", "ui-serif", "Georgia", "serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        muted: "var(--muted)",
        card: "var(--card)",
        border: "var(--border)",
      },
    },
  },
  plugins: [],
};
export default config;
