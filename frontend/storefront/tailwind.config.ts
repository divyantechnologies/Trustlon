import type { Config } from 'tailwindcss';
import { colors, typography, spacing, radius, shadows } from './src/design-system/tokens';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors,
      fontFamily: typography.fontFamily,
      spacing,
      borderRadius: radius,
      boxShadow: shadows,
    },
  },
  plugins: [],
} satisfies Config;
