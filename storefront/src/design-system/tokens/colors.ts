import tailwindColors from 'tailwindcss/colors';

/**
 * Brand colours come from CSS variables (set in app/layout.tsx from Admin › Settings › Theme), so the
 * whole site can be re-coloured without a deploy. These hex values are the defaults.
 */
export const defaultBrandColors = {
  navy: '#13233F',
  navyDark: '#1C3157',
  navyLight: '#EEF2F8',
  teal: '#1F9E8C',
  tealDark: '#178374',
  tealLight: '#E6F6F3',
  cream: '#F5F3EE',
  logoAccent: '#3CCBB4',
} as const;

export type BrandColor = keyof typeof defaultBrandColors;

/** CSS variable for each brand colour, holding "r g b" so Tailwind opacity (bg-navy/50) works. */
export const brandColorVars: Record<BrandColor, string> = {
  navy: '--tl-navy',
  navyDark: '--tl-navy-700',
  navyLight: '--tl-navy-50',
  teal: '--tl-teal',
  tealDark: '--tl-teal-600',
  tealLight: '--tl-teal-50',
  cream: '--tl-cream',
  logoAccent: '--tl-logo-accent',
};

const v = (color: BrandColor) => `rgb(var(${brandColorVars[color]}) / <alpha-value>)`;

/** The only custom colour definitions. Keep Tailwind neutral/error scales intact. */
export const colors = {
  navy: { DEFAULT: v('navy'), 700: v('navyDark'), 50: v('navyLight') },
  teal: { DEFAULT: v('teal'), 600: v('tealDark'), 50: v('tealLight') },
  cream: v('cream'),
  white: tailwindColors.white,
  // Logo mark and icons on navy panels only.
  'logo-accent': v('logoAccent'),
  slate: tailwindColors.slate,
  red: tailwindColors.red,
};
