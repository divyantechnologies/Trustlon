import { en, type Dictionary, type PartialDictionary } from './en';
import type { Language } from './languages';

/**
 * Server-safe access to the built-in dictionaries (no React), used by the /i18n endpoints that
 * the admin panel's Settings › Localisation reads.
 */
const loaders: Record<Language, () => Promise<PartialDictionary>> = {
  en: async () => en,
  hi: () => import('./hi').then((m) => m.hi),
  bn: () => import('./bn').then((m) => m.bn),
  mr: () => import('./mr').then((m) => m.mr),
  ta: () => import('./ta').then((m) => m.ta),
  te: () => import('./te').then((m) => m.te),
  kn: () => import('./kn').then((m) => m.kn),
  ml: () => import('./ml').then((m) => m.ml),
  ar: () => import('./ar').then((m) => m.ar),
  fr: () => import('./fr').then((m) => m.fr),
  es: () => import('./es').then((m) => m.es),
  de: () => import('./de').then((m) => m.de),
  pt: () => import('./pt').then((m) => m.pt),
  ru: () => import('./ru').then((m) => m.ru),
  zh: () => import('./zh').then((m) => m.zh),
  ja: () => import('./ja').then((m) => m.ja),
};

function merge(
  base: Record<string, unknown>,
  over: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    const replacement = over?.[key];
    out[key] =
      typeof value === 'string'
        ? typeof replacement === 'string' && replacement
          ? replacement
          : value
        : merge(
            value as Record<string, unknown>,
            replacement as Record<string, unknown> | undefined,
          );
  }
  return out;
}

/** A language's built-in text with English filling any gaps. */
export async function builtInDictionary(language: Language): Promise<Dictionary> {
  const partial = await loaders[language]();
  return merge(en as Record<string, unknown>, partial as Record<string, unknown>) as Dictionary;
}
