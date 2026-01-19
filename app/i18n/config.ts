// Supported languages configuration
export const languages = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr' as const,
  },
  he: {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    direction: 'rtl' as const,
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl' as const,
  },
} as const;

export type LanguageCode = keyof typeof languages;
export type Direction = 'ltr' | 'rtl';

export const defaultLanguage: LanguageCode = 'en';
export const LANGUAGE_STORAGE_KEY = 'calendi_language';

export const isRTL = (lang: LanguageCode): boolean => {
  return languages[lang].direction === 'rtl';
};

export const getDirection = (lang: LanguageCode): Direction => {
  return languages[lang].direction;
};
