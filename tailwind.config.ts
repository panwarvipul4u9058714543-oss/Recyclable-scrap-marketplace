import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        // Semantic tokens are driven by CSS variables in globals.css so the
        // same class names read the right value in light vs dark mode.
        paper: "hsl(var(--paper) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        sand: "hsl(var(--sand) / <alpha-value>)",
        dune: "hsl(var(--dune) / <alpha-value>)",
        ash: "hsl(var(--ash) / <alpha-value>)",
        rust: {
          DEFAULT: "hsl(var(--rust) / <alpha-value>)",
          soft: "hsl(var(--rust-soft) / <alpha-value>)",
          ink: "hsl(var(--rust-ink) / <alpha-value>)",
        },
        moss: {
          DEFAULT: "hsl(var(--moss) / <alpha-value>)",
          soft: "hsl(var(--moss-soft) / <alpha-value>)",
        },
        signal: {
          warn: "hsl(var(--signal-warn) / <alpha-value>)",
          err: "hsl(var(--signal-err) / <alpha-value>)",
          ok: "hsl(var(--signal-ok) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // A slightly tighter display scale — feels editorial, not marketing.
        display: ["clamp(2.5rem, 5vw, 4rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        hero: ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
      },
      borderRadius: {
        // Deliberately mixed — softer for buttons/cards, sharper for chips.
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        // Prefer soft, low-elevation shadows and rely on borders for structure.
        soft: "0 1px 0 0 hsl(var(--ink) / 0.04), 0 1px 3px hsl(var(--ink) / 0.06)",
        lift: "0 2px 0 0 hsl(var(--ink) / 0.03), 0 8px 24px -12px hsl(var(--ink) / 0.18)",
        inset: "inset 0 1px 0 hsl(var(--paper) / 0.6)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        "slide-in": "slide-in 320ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        shimmer: "shimmer 2.4s linear infinite",
      },
      backgroundImage: {
        grain:
          "radial-gradient(hsl(var(--ink) / 0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        grain: "4px 4px",
      },
    },
  },
  plugins: [animate],
};

export default config;
