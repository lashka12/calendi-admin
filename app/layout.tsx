"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "./components/DashboardLayout";
import OfflineDetector from "./components/OfflineDetector";
import { ToastProvider, useToast } from "./lib/hooks/useToast";
import { ToastContainer } from "./components/Toast";
import { onAuthChange } from "./lib/firebase/auth";
import { SettingsProvider } from "./context/SettingsContext";
import { LanguageProvider } from "./i18n";
import { ThemeProvider } from "./context/ThemeContext";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Register service worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
        console.log('Service worker registration failed:', err);
      });
    }
  }, []);

  // Check authentication state and handle redirects
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      const currentPathname = pathnameRef.current;
      const currentIsLoginPage = currentPathname === "/login";
      
      setIsAuthenticated(!!user);
      
      if (!user && !currentIsLoginPage) {
        router.push("/login");
      } else if (user && currentIsLoginPage) {
        setTimeout(() => setShowContent(true), 100);
      } else {
        setTimeout(() => setShowContent(true), 100);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // When pathname changes (redirect complete), check if we should show content
  useEffect(() => {
    if (isAuthenticated === null) return;
    
    const shouldShowContent = 
      (isAuthenticated && !isLoginPage) ||
      (!isAuthenticated && isLoginPage);
    
    if (shouldShowContent) {
      setTimeout(() => setShowContent(true), 100);
    }
  }, [pathname, isAuthenticated, isLoginPage]);

  // Safety timeout: remove splash even if onTransitionEnd doesn't fire
  useEffect(() => {
    if (showContent && !splashDone) {
      const timer = setTimeout(() => setSplashDone(true), 600);
      return () => clearTimeout(timer);
    }
  }, [showContent, splashDone]);

  // PWA meta tags + theme initialization
  const PwaHead = () => (
    <head>
      {/* Theme init - runs SYNCHRONOUSLY before body renders */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          try {
            var theme = localStorage.getItem('calendi_theme') || 'system';
            if (!localStorage.getItem('calendi_theme')) localStorage.setItem('calendi_theme', 'system');
            document.documentElement.setAttribute('data-theme', theme);
            var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', isDark ? '#0a0a0b' : '#faf9f7');
          } catch(e) {}
        })();
      `}} />

      {/* Theme backgrounds + splash overlay */}
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { margin: 0; padding: 0; }

        html { background-color: #faf9f7; }
        html[data-theme="dark"] { background-color: #0a0a0b; }
        @media (prefers-color-scheme: dark) {
          html[data-theme="system"], html:not([data-theme]) { background-color: #0a0a0b; }
        }
        @media (prefers-color-scheme: light) {
          html[data-theme="system"] { background-color: #faf9f7; }
        }

        :root { --splash-bg: #faf9f7; }
        :root[data-theme="dark"] { --splash-bg: #0a0a0b; }
        @media (prefers-color-scheme: dark) {
          :root[data-theme="system"], :root:not([data-theme]) { --splash-bg: #0a0a0b; }
        }

        #app-splash {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: var(--splash-bg);
          transition: opacity .3s ease;
        }
      `}} />

      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#faf9f7" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Calendi" />
      <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png?v=2" />
      <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png?v=2" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    </head>
  );

  // Simple solid-color splash — just the theme background, fades out when ready
  const splashOverlay = !splashDone ? (
    <div
      id="app-splash"
      style={{ opacity: showContent ? 0 : 1 }}
      onTransitionEnd={(e) => {
        if (e.propertyName === 'opacity') setSplashDone(true);
      }}
    />
  ) : null;

  // Login page
  if (isLoginPage) {
    return (
      <html lang="en" suppressHydrationWarning>
        <PwaHead />
        <body>
          {splashOverlay}
          <ThemeProvider>
            <OfflineDetector>
              {showContent && children}
            </OfflineDetector>
          </ThemeProvider>
        </body>
      </html>
    );
  }

  // Protected pages
  return (
    <html lang="en" suppressHydrationWarning>
      <PwaHead />
      <body>
        {splashOverlay}
        <ThemeProvider>
          <OfflineDetector>
            {showContent && (
              <>
                <IOSPWAViewportFix />
                <LanguageProvider>
                  <SettingsProvider>
                    <ToastProvider>
                      <AppContent>{children}</AppContent>
                    </ToastProvider>
                  </SettingsProvider>
                </LanguageProvider>
              </>
            )}
          </OfflineDetector>
        </ThemeProvider>
      </body>
    </html>
  );
}

/** One-time viewport correction when first showing app after splash (PWA resume). */
function IOSPWAViewportFix() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      (navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return;

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        window.scrollTo(0, y + 1);
        window.scrollTo(0, y);
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { toasts, removeToast } = useToast();
  
  return (
    <>
      <DashboardLayout>{children}</DashboardLayout>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
