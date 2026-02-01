/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom warm gray palette - sophisticated taupe/mocha tones
        // Perfectly harmonizes with #faf9f7 background
        gray: {
          50: '#faf9f7',   // Your existing bg - perfect warm off-white
          100: '#f3f2ef',  // Warmer cream - cards, subtle backgrounds
          200: '#e8e5e0',  // Warm beige-gray - borders, dividers
          300: '#d5d0c9',  // Taupe - inactive states, light text
          400: '#b0a9a0',  // Warm mid-gray - secondary text, icons
          500: '#847d73',  // Warm brown-gray - body text, medium emphasis
          600: '#5f574e',  // Warm charcoal-brown - headings, important text
          700: '#48423a',  // Deep taupe - strong emphasis
          800: '#332e28',  // Warm dark - primary buttons, active states
          900: '#1e1a16',  // Darkest warm tone - highest contrast text
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in',
        'slide-up': 'slideUp 0.5s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'gradient': 'gradient 8s ease infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};

module.exports = config;





