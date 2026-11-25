import { brandColorVars, defaultBrandColors, type BrandColor } from '@/design-system/tokens/colors';

/** Theme as returned by GET /site/config (edited in Admin › Settings › Theme). */
export interface SiteTheme {
  colors: Record<BrandColor, string>;
  font: string;
  radius: 'none' | 'small' | 'medium' | 'large';
  logoText: string;
  logoUrl: string | null;
}

export interface SiteConfig {
  theme: SiteTheme;
  features: {
    sellPage: boolean;
    referralProgram: boolean;
    internationalAddresses: boolean;
    pincodeLookup: boolean;
  };
  account: { deleteReasons: string[] };
  sell: { callbackDays: number };
  contentVersion: number;
}

export const FONT_CHOICES = [
  'Inter',
  'Poppins',
  'Roboto',
  'Open Sans',
  'Lato',
  'Nunito',
  'Montserrat',
  'Noto Sans',
] as const;

export const RADIUS_PX: Record<SiteTheme['radius'], number> = {
  none: 0,
  small: 4,
  medium: 8,
  large: 14,
};

export const DEFAULT_CONFIG: SiteConfig = {
  theme: {
    colors: { ...defaultBrandColors },
    font: 'Inter',
    radius: 'medium',
    logoText: 'Trustlon',
    logoUrl: null,
  },
  features: {
    sellPage: true,
    referralProgram: true,
    internationalAddresses: true,
    pincodeLookup: true,
  },
  account: {
    deleteReasons: [
      'I have another account',
      'I don’t shop here any more',
      'Privacy concerns',
      'Too many messages',
      'Something else',
    ],
  },
  sell: { callbackDays: 2 },
  contentVersion: 0,
};

/** Noto fonts for every script the storefront speaks, after the brand font. */
const SCRIPT_FONTS = [
  'Noto Sans Devanagari',
  'Noto Sans Bengali',
  'Noto Sans Tamil',
  'Noto Sans Telugu',
  'Noto Sans Kannada',
  'Noto Sans Malayalam',
  'Noto Sans Arabic',
  'Noto Sans SC',
  'Noto Sans JP',
];

const channels = (hex: string) => {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)).join(' ');
};

/** CSS variables for the theme, for a <style> tag or document.documentElement. */
export function themeVariables(theme: SiteTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [color, name] of Object.entries(brandColorVars) as Array<[BrandColor, string]>) {
    vars[name] = channels(theme.colors[color] ?? defaultBrandColors[color]);
  }
  vars['--tl-radius'] = `${RADIUS_PX[theme.radius] ?? 8}px`;
  const font = (FONT_CHOICES as readonly string[]).includes(theme.font) ? theme.font : 'Inter';
  vars['--tl-font-stack'] = [font, ...SCRIPT_FONTS].map((f) => `'${f}'`).join(', ');
  return vars;
}

export function themeCss(theme: SiteTheme): string {
  const body = Object.entries(themeVariables(theme))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  return `:root{${body}}`;
}

/** One Google Fonts stylesheet: the brand font plus the script fonts (loaded only when used). */
export function fontsUrl(theme: SiteTheme): string {
  const font = (FONT_CHOICES as readonly string[]).includes(theme.font) ? theme.font : 'Inter';
  const families = [...new Set([font, ...SCRIPT_FONTS])];
  return `https://fonts.googleapis.com/css2?${families
    .map((family) => `family=${family.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&')}&display=swap`;
}

/** Applies a theme in the browser straight away (used by the admin preview and after saving). */
export function applyTheme(theme: SiteTheme): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeVariables(theme)))
    root.style.setProperty(name, value);
  let link = document.getElementById('tl-theme-fonts') as HTMLLinkElement | null;
  const href = fontsUrl(theme);
  if (link && link.href !== href) link.href = href;
  if (!link) {
    link = document.createElement('link');
    link.id = 'tl-theme-fonts';
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}
