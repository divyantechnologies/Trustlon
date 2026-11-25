export const typography = {
  // --tl-font-stack is set in app/layout.tsx: the font chosen in Admin › Settings › Theme, then the
  // Noto fonts for each supported script.
  fontFamily: {
    sans: ['var(--tl-font-stack)', 'system-ui', 'sans-serif'],
  },
  pageTitle: 'text-2xl font-semibold text-navy',
  body: 'text-sm text-navy',
  secondary: 'text-sm text-slate-500',
};
