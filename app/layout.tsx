"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "./components/DashboardLayout";
import SplashScreen from "./components/SplashScreen";
import OfflineDetector from "./components/OfflineDetector";
import { ToastProvider, useToast } from "./lib/hooks/useToast";
import { ToastContainer } from "./components/Toast";
import { onAuthChange } from "./lib/firebase/auth";
import { SettingsProvider } from "./context/SettingsContext";
import { LanguageProvider } from "./i18n";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  
  // Track both auth state and whether we should show content
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showContent, setShowContent] = useState(false);

  // Use ref to always get current pathname in auth callback
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Register service worker for PWA + Push Notifications
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
        // Not authenticated, not on login page - redirect to login
        // Keep splash visible during redirect
        router.push("/login");
      } else if (user && currentIsLoginPage) {
        // Authenticated, on login page - DON'T redirect here!
        // Let the login page handle its own success animation and navigation
        setTimeout(() => setShowContent(true), 100);
      } else {
        // We're on the correct page - show content
        // Small delay for smooth transition
        setTimeout(() => setShowContent(true), 100);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // When pathname changes (redirect complete), check if we should show content
  useEffect(() => {
    if (isAuthenticated === null) return; // Auth not checked yet
    
    const shouldShowContent = 
      (isAuthenticated && !isLoginPage) || // Authenticated on protected page
      (!isAuthenticated && isLoginPage);    // Not authenticated on login page
    
    if (shouldShowContent) {
      setTimeout(() => setShowContent(true), 100);
    }
  }, [pathname, isAuthenticated, isLoginPage]);

  // PWA meta tags component
  const PwaHead = () => (
    <head>
      {/* Prevent flash of wrong color - this loads BEFORE React */}
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { 
          background-color: #faf9f7 !important; 
          margin: 0; 
          padding: 0;
        }
      `}} />
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#faf9f7" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Calendi" />
      <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    </head>
  );

  // Determine if splash should be visible
  const showSplash = !showContent;

  // Login page
  if (isLoginPage) {
    return (
      <html lang="en">
        <PwaHead />
        <body style={{ backgroundColor: '#faf9f7' }}>
          <OfflineDetector>
            <SplashScreen isVisible={showSplash} />
            {showContent && children}
          </OfflineDetector>
        </body>
      </html>
    );
  }

  // Protected pages
  return (
    <html lang="en">
      <PwaHead />
      <body style={{ backgroundColor: '#faf9f7' }}>
        <OfflineDetector>
          <SplashScreen isVisible={showSplash} />
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
