/**
 * Languages the storefront offers: the Indian languages large Indian marketplaces support, plus
 * the most used international ones. To add one: add it here, add the value to the Language enum
 * in the API (auth.prisma), and add a dictionary file (missing strings fall back to English).
 */
export const LANGUAGES = [
  {
    code: 'en',
    api: 'EN',
    name: 'English',
    native: 'English',
    sample: 'Shop with confidence',
    group: 'india',
    dir: 'ltr',
    locale: 'en-IN',
  },
  {
    code: 'hi',
    api: 'HI',
    name: 'Hindi',
    native: 'हिन्दी',
    sample: 'भरोसे के साथ खरीदारी करें',
    group: 'india',
    dir: 'ltr',
    locale: 'hi-IN',
  },
  {
    code: 'bn',
    api: 'BN',
    name: 'Bengali',
    native: 'বাংলা',
    sample: 'নিশ্চিন্তে কেনাকাটা করুন',
    group: 'india',
    dir: 'ltr',
    locale: 'bn-IN',
  },
  {
    code: 'mr',
    api: 'MR',
    name: 'Marathi',
    native: 'मराठी',
    sample: 'विश्वासाने खरेदी करा',
    group: 'india',
    dir: 'ltr',
    locale: 'mr-IN',
  },
  {
    code: 'ta',
    api: 'TA',
    name: 'Tamil',
    native: 'தமிழ்',
    sample: 'நம்பிக்கையுடன் வாங்குங்கள்',
    group: 'india',
    dir: 'ltr',
    locale: 'ta-IN',
  },
  {
    code: 'te',
    api: 'TE',
    name: 'Telugu',
    native: 'తెలుగు',
    sample: 'నమ్మకంతో షాపింగ్ చేయండి',
    group: 'india',
    dir: 'ltr',
    locale: 'te-IN',
  },
  {
    code: 'kn',
    api: 'KN',
    name: 'Kannada',
    native: 'ಕನ್ನಡ',
    sample: 'ವಿಶ್ವಾಸದಿಂದ ಖರೀದಿಸಿ',
    group: 'india',
    dir: 'ltr',
    locale: 'kn-IN',
  },
  {
    code: 'ml',
    api: 'ML',
    name: 'Malayalam',
    native: 'മലയാളം',
    sample: 'വിശ്വാസത്തോടെ വാങ്ങൂ',
    group: 'india',
    dir: 'ltr',
    locale: 'ml-IN',
  },
  {
    code: 'ar',
    api: 'AR',
    name: 'Arabic',
    native: 'العربية',
    sample: 'تسوّق بثقة',
    group: 'international',
    dir: 'rtl',
    locale: 'ar',
  },
  {
    code: 'fr',
    api: 'FR',
    name: 'French',
    native: 'Français',
    sample: 'Achetez en toute confiance',
    group: 'international',
    dir: 'ltr',
    locale: 'fr',
  },
  {
    code: 'es',
    api: 'ES',
    name: 'Spanish',
    native: 'Español',
    sample: 'Compra con confianza',
    group: 'international',
    dir: 'ltr',
    locale: 'es',
  },
  {
    code: 'de',
    api: 'DE',
    name: 'German',
    native: 'Deutsch',
    sample: 'Sicher einkaufen',
    group: 'international',
    dir: 'ltr',
    locale: 'de',
  },
  {
    code: 'pt',
    api: 'PT',
    name: 'Portuguese',
    native: 'Português',
    sample: 'Compre com confiança',
    group: 'international',
    dir: 'ltr',
    locale: 'pt',
  },
  {
    code: 'ru',
    api: 'RU',
    name: 'Russian',
    native: 'Русский',
    sample: 'Покупайте с уверенностью',
    group: 'international',
    dir: 'ltr',
    locale: 'ru',
  },
  {
    code: 'zh',
    api: 'ZH',
    name: 'Chinese (Simplified)',
    native: '简体中文',
    sample: '放心购物',
    group: 'international',
    dir: 'ltr',
    locale: 'zh-CN',
  },
  {
    code: 'ja',
    api: 'JA',
    name: 'Japanese',
    native: '日本語',
    sample: '安心してお買い物',
    group: 'international',
    dir: 'ltr',
    locale: 'ja',
  },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];
export type ApiLanguage = (typeof LANGUAGES)[number]['api'];
export type LanguageInfo = (typeof LANGUAGES)[number];

export const LANGUAGE_GROUPS = [
  { key: 'india', label: 'Indian languages' },
  { key: 'international', label: 'International' },
] as const;

export const isLanguage = (value: string): value is Language =>
  LANGUAGES.some((language) => language.code === value);

export const languageInfo = (language: Language): LanguageInfo =>
  LANGUAGES.find((l) => l.code === language)!;

export const toApiLanguage = (language: Language): ApiLanguage => languageInfo(language).api;

export const fromApiLanguage = (api: string): Language =>
  LANGUAGES.find((l) => l.api === api)?.code ?? 'en';
