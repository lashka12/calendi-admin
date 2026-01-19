"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LanguageCode, 
  Direction, 
  defaultLanguage, 
  LANGUAGE_STORAGE_KEY, 
  languages,
  getDirection,
  isRTL 
} from '../config';
import type { Translations } from '../types';
import en from '../locales/en';
import he from '../locales/he';
import ar from '../locales/ar';

// All translations
const translations: Record<LanguageCode, Translations> = {
  en,
  he,
  ar,
};

interface LanguageContextType {
  language: LanguageCode;
  direction: Direction;
  isRTL: boolean;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  languages: typeof languages;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(defaultLanguage);
  const [mounted, setMounted] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as LanguageCode | null;
    if (saved && languages[saved]) {
      setLanguageState(saved);
    }
    setMounted(true);
  }, []);

  // Update document direction when language changes
  useEffect(() => {
    if (mounted) {
      const dir = getDirection(language);
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', language);
    }
  }, [language, mounted]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  // Translation function with dot notation support
  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fallback to English
        value = translations.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = (value as Record<string, unknown>)[fallbackKey];
          } else {
            // Return key if not found
            console.warn(`Translation key not found: ${key}`);
            return key;
          }
        }
        break;
      }
    }
    
    return typeof value === 'string' ? value : key;
  }, [language]);

  const contextValue = useMemo(() => ({
    language,
    direction: getDirection(language),
    isRTL: isRTL(language),
    setLanguage,
    t,
    languages,
  }), [language, setLanguage, t]);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Shorthand hook for just translations
export function useTranslation() {
  const { t, language, isRTL, direction, setLanguage, languages } = useLanguage();
  return { t, language, isRTL, direction, setLanguage, languages };
}
