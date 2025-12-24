import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#FF6B35" },
        secondary: { DEFAULT: "#004E89" },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
