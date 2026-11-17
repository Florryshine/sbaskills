module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx,mdx}',
    './components/**/*.{js,jsx,ts,tsx,mdx}',
    './lib/**/*.{js,jsx,ts,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1a73e8',
          yellow: '#FFCC00',
          dark: '#1a1a1a',
          light: '#FFFFFF'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(26, 115, 232, 0.08)'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};