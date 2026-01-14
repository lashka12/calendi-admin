"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "./components/DashboardLayout";
import { ToastProvider, useToast } from "./lib/hooks/useToast";
import { ToastContainer } from "./components/Toast";
import { onAuthChange } from "./lib/firebase/auth";
import { SettingsProvider } from "./context/SettingsContext";
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

  // Login page - render directly without layout wrapper
  if (isLoginPage) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  // Protected pages - render immediately, pages handle their own loading states
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          <ToastProvider>
            <AppContent>{children}</AppContent>
          </ToastProvider>
        </SettingsProvider>
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
