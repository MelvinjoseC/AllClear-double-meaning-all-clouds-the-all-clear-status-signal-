/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0f19',
        darkCard: '#151c2c',
        darkBorder: '#222e47',
        brandPrimary: '#2563eb',
        brandSecondary: '#3b82f6',
      }
    },
  },
  plugins: [],
}
