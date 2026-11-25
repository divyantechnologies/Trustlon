import defaultTheme from 'tailwindcss/defaultTheme';

/** Keep the native Tailwind scale: h-11 is 2.75rem (44px at the default root size). */
export const spacing = defaultTheme.spacing;
export const dimensions = {
  buttonHeight: spacing[11],
  inputHeight: spacing[11],
};
