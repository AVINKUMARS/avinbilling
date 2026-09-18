/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#18201d',
        canvas: '#f4f7f5',
        brand: {
          50: '#edfdf8',
          100: '#d4f7ea',
          500: '#159775',
          600: '#0f766e',
          700: '#115e59',
          900: '#123d38'
        },
      },
      boxShadow: {
        card: '0 16px 40px rgba(25, 46, 39, 0.08)',
      },
    },
  },
  plugins: [],
};
