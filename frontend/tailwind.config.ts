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
        brand: {
          teal: {
            DEFAULT: "#00B894",
            dark: "#009F80",
          },
          "gradient-from": "#4ACFAC",
          "gradient-to": "#1B5E52",
          ink: "#2D2D2D",
        },
      },
      borderRadius: {
        md: "8px",
        lg: "16px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
        "toast-slide-in": {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        shake: "shake 400ms ease-in-out",
        "toast-slide-in": "toast-slide-in 300ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
