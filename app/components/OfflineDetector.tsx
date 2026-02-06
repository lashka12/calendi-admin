'use client';

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Import translations directly
import en from '../i18n/locales/en';
import he from '../i18n/locales/he';
import ar from '../i18n/locales/ar';

type LanguageCode = 'en' | 'he' | 'ar';
type ThemeId = 'light' | 'dark' | 'system';

const translations = { en, he, ar };
const LANGUAGE_STORAGE_KEY = 'calendi_language';
const THEME_STORAGE_KEY = 'calendi_theme';

// Helper to get stored language
const getStoredLanguage = (): LanguageCode => {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'en' || stored === 'he' || stored === 'ar') {
    return stored;
  }
  return 'en';
};

// Helper to get resolved theme
const getResolvedTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
  const theme = stored || 'light';
  
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
};

export default function OfflineDetector({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Read language and theme from localStorage on mount
  useEffect(() => {
    setLanguage(getStoredLanguage());
    setResolvedTheme(getResolvedTheme());
    setMounted(true);
  }, []);

  // Also listen for storage changes (language/theme)
  useEffect(() => {
    const handleStorage = () => {
      setLanguage(getStoredLanguage());
      setResolvedTheme(getResolvedTheme());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setResolvedTheme(getResolvedTheme());
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const isRTL = language === 'he' || language === 'ar';
  const t = translations[language].offline;
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    // Check initial state after mount
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [mounted]);

  const handleRetry = () => {
    setIsRetrying(true);
    
    if (navigator.onLine) {
      setIsOnline(true);
      setIsRetrying(false);
    } else {
      setTimeout(() => setIsRetrying(false), 1000);
    }
  };

  return (
    <>
      {children}
      
      <AnimatePresence>
        {mounted && !isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{ 
              backgroundColor: isDark ? '#0a0a0b' : '#faf9f7',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              paddingTop: 'env(safe-area-inset-top, 0px)'
            }}
          >
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              className="flex flex-col items-center px-8"
            >
              {/* Icon */}
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                style={{ backgroundColor: isDark ? '#27272a' : '#f3f4f6' }}
              >
                <WifiOff 
                  className="w-7 h-7" 
                  strokeWidth={1.5} 
                  style={{ color: isDark ? '#a1a1aa' : '#9ca3af' }}
                />
              </div>

              {/* Title */}
              <h1 
                className="text-xl font-semibold mb-2 text-center"
                style={{ color: isDark ? '#fafafa' : '#111827' }}
              >
                {t.title}
              </h1>
              
              {/* Description */}
              <p 
                className="text-[15px] text-center max-w-[260px] leading-relaxed mb-8"
                style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
              >
                {t.description}
              </p>

              {/* Retry Button */}
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 px-6 py-3 text-[15px] font-medium rounded-full active:scale-[0.98] transition-all disabled:opacity-60"
                style={{ 
                  backgroundColor: isDark ? '#fafafa' : '#111827',
                  color: isDark ? '#0a0a0b' : '#ffffff'
                }}
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? t.checking : t.tryAgain}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
