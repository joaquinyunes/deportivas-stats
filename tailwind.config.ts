import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0b0d",
        surface: "#111318",
        "surface-2": "#171a21",
        line: "#232733",
        "line-strong": "#333a49",
        ink: "#e8eaf0",
        "ink-dim": "#9aa3b2",
        "ink-faint": "#5c6472",
        over: "#34d399",
        under: "#f87171",
        push: "#fbbf24",
        accent: "#5b9dff",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
