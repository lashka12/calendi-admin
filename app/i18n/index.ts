// Main i18n exports
export { LanguageProvider, useLanguage, useTranslation } from './context/LanguageContext';
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
