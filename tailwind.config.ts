import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand = the red the whole app is built on (see DESIGN.md).
        // The old scaffold defined primary as a blue (#2563eb), which kept
        // leaking off-brand blues into new UI — never reintroduce it.
        brand: {
          DEFAULT: "#dc2626", // = red-600
          hover: "#b91c1c", // = red-700
        },
      },
    },
  },
  plugins: [],
};
export default config;
