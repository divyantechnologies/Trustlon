import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Standard corners use rounded-lg; circles continue to use rounded-full. The corner size comes
 * from --tl-radius (set from /admin > Theme), 8px by default.
 */
export const radius = {
  ...defaultTheme.borderRadius,
  md: 'calc(var(--tl-radius, 8px) * 0.75)',
  lg: 'var(--tl-radius, 8px)',
  xl: 'calc(var(--tl-radius, 8px) * 1.5)',
};
