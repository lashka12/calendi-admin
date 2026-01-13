"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  BusinessSettings, 
  DEFAULT_SETTINGS, 
  subscribeToBusinessSettings 
} from '@/app/lib/firebase/settings';

interface SettingsContextType {
  settings: BusinessSettings;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
});

/**
 * Provider component that wraps the app and provides settings globally
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToBusinessSettings((newSettings) => {
      setSettings(newSettings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Hook to access business settings anywhere in the app
 * 
 * Usage:
 * const { settings, loading } = useSettings();
 * console.log(settings.businessName);
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
