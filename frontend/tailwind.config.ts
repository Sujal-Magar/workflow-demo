import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#e5e7eb",
        background: "#f7f8fa",
        primary: {
          DEFAULT: "#007bff",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#4f46e5",
        },
        foreground: {
          DEFAULT: "#111827",
          muted: "#6b7280",
          subtle: "#9ca3af",
        },
      },
      borderRadius: {
        md: "8px",
        lg: "16px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
