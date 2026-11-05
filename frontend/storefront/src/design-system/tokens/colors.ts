import tailwindColors from 'tailwindcss/colors';

/** The only custom colour definitions. Keep Tailwind neutral/error scales intact. */
export const colors = {
  navy: { DEFAULT: '#13233F', 700: '#1C3157', 50: '#EEF2F8' },
  teal: { DEFAULT: '#1F9E8C', 600: '#178374', 50: '#E6F6F3' },
  cream: '#F5F3EE',
  white: tailwindColors.white,
  // Logo mark and icons on navy panels only.
  'logo-accent': '#3CCBB4',
  slate: tailwindColors.slate,
  red: tailwindColors.red,
};
