"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "./components/DashboardLayout";
import SplashScreen from "./components/SplashScreen";
import { ToastProvider, useToast } from "./lib/hooks/useToast";
import { ToastContainer } from "./components/Toast";
import { onAuthChange } from "./lib/firebase/auth";
import { SettingsProvider } from "./context/SettingsContext";
import { Loader2 } from "lucide-react";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [showSplash, setShowSplash] = useState(false);
  const [splashShown, setSplashShown] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = checking
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication state
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setIsAuthenticated(!!user);
      setIsCheckingAuth(false);
      
      // If not authenticated and not on login page, redirect to login
      if (!user && !isLoginPage) {
        router.push("/login");
      }
      
      // If authenticated and on login page, redirect to dashboard
      if (user && isLoginPage) {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [isLoginPage, router]);

  useEffect(() => {
    // Only show splash screen once per session when entering the app (not on login page)
    if (!isLoginPage && !splashShown && isAuthenticated) {
      setShowSplash(true);
      setSplashShown(true);
      
      // Hide splash after it completes
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 1700);

      return () => clearTimeout(timer);
    }
  }, [isLoginPage, splashShown, isAuthenticated]);

  // Show loading state while checking auth (only for protected pages)
  if (!isLoginPage && isCheckingAuth) {
    return (
      <html lang="en">
        <body>
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  // If not authenticated and not on login page, show loading (redirect will happen)
  if (!isLoginPage && isAuthenticated === false) {
    return (
      <html lang="en">
        <body>
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Redirecting to login...</p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (isLoginPage) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  // Only render protected content if authenticated
  if (isAuthenticated) {
    return (
      <html lang="en">
        <body>
          <SettingsProvider>
            <ToastProvider>
              <AppContent showSplash={showSplash}>{children}</AppContent>
            </ToastProvider>
          </SettingsProvider>
        </body>
      </html>
    );
  }

  // Fallback loading state
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </body>
    </html>
  );
}

function AppContent({ children, showSplash }: { children: React.ReactNode; showSplash: boolean }) {
  const { toasts, removeToast } = useToast();
  
  return (
    <>
      {showSplash && <SplashScreen />}
      <DashboardLayout>{children}</DashboardLayout>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
