/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slack: {
          purple: '#4A154B',
          blue: '#1264A3',
          green: '#2BAC76',
          red: '#E01E5A',
          yellow: '#ECB22E',
        },
      },
    },
  },
  plugins: [],
}
