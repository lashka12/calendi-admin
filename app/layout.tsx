"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "./components/DashboardLayout";
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

  // Use ref to always get current pathname in auth callback
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Register service worker for PWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('Service worker registration failed:', err);
      });
    }
  }, []);

  // Check authentication state and handle redirects
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      const currentPathname = pathnameRef.current;
      const currentIsLoginPage = currentPathname === "/login";
      
      if (!user && !currentIsLoginPage) {
        router.push("/login");
        return;
      }
      
      if (user && currentIsLoginPage) {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // PWA meta tags component
  const PwaHead = () => (
    <head>
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#3b82f6" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Calendi" />
      <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    </head>
  );

  // Login page - render directly without layout wrapper
  if (isLoginPage) {
    return (
      <html lang="en">
        <PwaHead />
        <body>{children}</body>
      </html>
    );
  }

  // Protected pages - render immediately, pages handle their own loading states
  return (
    <html lang="en">
      <PwaHead />
      <body>
        <LanguageProvider>
          <SettingsProvider>
            <ToastProvider>
              <AppContent>{children}</AppContent>
            </ToastProvider>
          </SettingsProvider>
        </LanguageProvider>
      </body>
    </html>
  );
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
