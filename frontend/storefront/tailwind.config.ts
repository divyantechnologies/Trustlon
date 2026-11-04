import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#13233f', 700: '#1c3157', 50: '#eef2f8' },
        teal: { DEFAULT: '#1f9e8c', 600: '#178374', 50: '#e6f6f3' },
        cream: '#f5f3ee',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
