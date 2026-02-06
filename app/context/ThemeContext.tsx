'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Available themes - easy to extend with more themes later
export const themes = {
  light: {
    id: 'light',
    name: 'Light',
    nameHe: 'בהיר',
    nameAr: 'فاتح',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    nameHe: 'כהה',
    nameAr: 'داكن',
  },
  system: {
    id: 'system',
    name: 'System',
    nameHe: 'מערכת',
    nameAr: 'النظام',
  },
} as const;

export type ThemeId = keyof typeof themes;

const THEME_STORAGE_KEY = 'calendi_theme';
const DEFAULT_THEME: ThemeId = 'system';

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: typeof themes;
  resolvedTheme: 'light' | 'dark'; // The actual applied theme (resolves 'system')
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Resolve the actual theme to apply
  const resolveTheme = useCallback((themeId: ThemeId): 'light' | 'dark' => {
    if (themeId === 'system') {
      return getSystemTheme();
    }
    return themeId;
  }, [getSystemTheme]);

  // Apply theme to document
  const applyTheme = useCallback((themeId: ThemeId) => {
    const resolved = resolveTheme(themeId);
    setResolvedTheme(resolved);
    
    // Apply to document
    document.documentElement.setAttribute('data-theme', themeId);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0a0a0b' : '#faf9f7');
    }
  }, [resolveTheme]);

  // Set theme and persist
  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  // Initialize theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    const initialTheme = stored && themes[stored] ? stored : DEFAULT_THEME;
    
    // Ensure theme is always persisted so offline page can read it
    if (!stored) {
      localStorage.setItem(THEME_STORAGE_KEY, initialTheme);
    }
    
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, [applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted, applyTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Export context for direct access (like we did with LanguageContext)
export { ThemeContext };
