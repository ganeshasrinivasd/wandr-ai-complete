import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#8B4513" }, // Leather brown as primary
        secondary: { DEFAULT: "#556B2F" }, // Olive green as secondary
        paper: {
          DEFAULT: '#F9F7F2',
          dark: '#E8E6DF',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#2C2C2C', // Main text
          light: '#4A4A4A',
          faint: 'rgba(44, 44, 44, 0.4)',
        },
        pencil: '#5D5D5B',
        leather: {
          DEFAULT: '#8B4513',
          light: '#A0522D',
        },
        stamp: '#D2691E', // Terracotta
        nature: '#556B2F',
      },
      fontFamily: {
        serif: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'sans-serif'],
        hand: ['Patrick Hand', 'cursive'],
        typewriter: ['Special Elite', 'monospace'],
      },
      backgroundImage: {
        'paper-texture': "url('https://www.transparenttextures.com/patterns/cream-paper.png')",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
