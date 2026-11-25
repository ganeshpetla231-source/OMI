/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1200px', '2xl': '1280px' },
    },
    extend: {
      colors: {
        primary: { DEFAULT: '#4f46e5', dark: '#4338ca', light: '#eef2ff' },
        success: { DEFAULT: '#15803d', light: '#f0fdf4' },
        warning: { DEFAULT: '#b45309', light: '#fffbeb' },
        danger: { DEFAULT: '#b91c1c', light: '#fef2f2' },
        surface: { DEFAULT: '#ffffff', dark: '#111827' },
        muted: { DEFAULT: '#64748b', dark: '#9ca3af' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
};
