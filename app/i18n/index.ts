// Main i18n exports
export { LanguageContext, LanguageProvider, useLanguage, useTranslation } from './context/LanguageContext';
export { 
  languages, 
  defaultLanguage, 
  isRTL, 
  getDirection,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
  type Direction 
} from './config';
export type { Translations } from './types';
