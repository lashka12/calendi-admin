"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  Clock,
  Briefcase,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  CalendarClock,
  Grid3x3,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeToPendingBookings } from "../lib/firebase/requests";
import { signOutAdmin } from "../lib/firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase/config";
import { useSettings } from "../context/SettingsContext";

// Personal settings interface
interface PersonalSettings {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  theme?: string;
  language?: string;
}

// Helper: Get initials from name
const getInitials = (firstName: string, lastName: string): string => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return first + last || '?';
};

// Avatar color based on name
const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-gray-600', 'bg-gray-700', 'bg-gray-800',
    'bg-slate-600', 'bg-slate-700', 'bg-zinc-600',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userProfile, setUserProfile] = useState<PersonalSettings | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();

  // Subscribe to real-time personal settings
  useEffect(() => {
    const settingsRef = doc(db, "settings", "personal");
    const unsubscribe = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data() as PersonalSettings);
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to real-time pending bookings count
  useEffect(() => {
    const unsubscribe = subscribeToPendingBookings((bookings) => {
      setPendingCount(bookings.length);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Lock body scroll when more menu is open
  useEffect(() => {
    if (moreMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [moreMenuOpen]);

  // Computed user display values
  const userName = userProfile 
    ? `${userProfile.firstName} ${userProfile.lastName}` 
    : 'Loading...';
  const userInitials = userProfile 
    ? getInitials(userProfile.firstName, userProfile.lastName) 
    : '?';
  const avatarColor = getAvatarColor(userName);

  const navigation = [
    { name: "Home", href: "/", icon: Home },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Requests", href: "/requests", icon: Clock, badge: pendingCount > 0 ? pendingCount : undefined },
    { name: "Services", href: "/services", icon: Briefcase },
    { name: "Availability", href: "/availability", icon: CalendarClock },
    { name: "Blacklist", href: "/blacklist", icon: ShieldAlert },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // Reorder for mobile bottom nav - put Requests in the middle, More at the end
  const mobileNavigation = [
    { name: "Home", href: "/", icon: Home },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Requests", href: "/requests", icon: Clock, badge: pendingCount > 0 ? pendingCount : undefined, isCenter: true },
    { name: "Availability", href: "/availability", icon: CalendarClock },
  ];

  // Items shown in the More menu
  const moreMenuItems = [
    { name: "Clients", href: "/clients", icon: Users, description: "Manage your clients" },
    { name: "Services", href: "/services", icon: Briefcase, description: "Your service offerings" },
    { name: "Blacklist", href: "/blacklist", icon: ShieldAlert, description: "Blocked clients" },
    { name: "Settings", href: "/settings", icon: Settings, description: "Account settings" },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    setProfileMenuOpen(false);
    
    try {
      const result = await signOutAdmin();
      if (result.success) {
        router.push("/login");
      } else {
        console.error("Logout error:", result.error);
        // Still redirect to login even if there's an error
        router.push("/login");
      }
    } catch (error) {
      console.error("Error logging out:", error);
      // Still redirect to login even if there's an error
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-gray-800/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-800 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">Calendi</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User profile */}
          <div className="p-4 border-t border-gray-200">
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${avatarColor} text-white font-semibold text-sm`}>
                  {userInitials}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500">{settings.businessName}</p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    profileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Profile menu dropdown */}
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                  >
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-sm"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-900">Settings</span>
                    </Link>
                    <div className="border-t border-gray-200">
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top navbar - hidden on mobile */}
        <header className="hidden lg:block sticky top-0 z-30 h-16 bg-white border-b border-gray-200">
          <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo for mobile */}
              <Link href="/" className="lg:hidden flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-800 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">Calendi</span>
              </Link>

              {/* Search bar */}
              <div className="hidden sm:block relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Mobile search */}
              <button className="sm:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Search className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 pt-1 pb-20 sm:px-6 sm:pt-2 lg:px-8 lg:pt-4 lg:pb-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-inset-bottom">
          <div className="grid grid-cols-5 h-16 relative">
            {mobileNavigation.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const isCenter = item.isCenter;

              if (isCenter) {
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex flex-col items-center justify-center relative"
                  >
                    {/* Elevated circular button */}
                    <div className="absolute -top-3">
                      <div className={`relative w-14 h-14 rounded-full shadow-lg transition-all duration-300 ${
                        isActive
                          ? "bg-gray-800 scale-110"
                          : "bg-gray-800 lg:hover:bg-gray-700 lg:hover:scale-105"
                      }`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-md">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 relative transition-colors ${
                    isActive
                      ? "text-gray-900"
                      : "text-gray-500 lg:hover:text-gray-700"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium">{item.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveTab"
                      className="absolute top-0 left-0 right-0 h-0.5 bg-gray-800"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setMoreMenuOpen(true)}
              className={`flex flex-col items-center justify-center gap-1 relative transition-colors ${
                moreMenuOpen
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="relative">
                <Grid3x3 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>
        </nav>

        {/* More Menu Modal */}
        <AnimatePresence>
          {moreMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMoreMenuOpen(false)}
                className="lg:hidden fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50"
              />

              {/* Modal Sheet */}
              <motion.div
                initial={{ y: "100%", opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
              >
                {/* Card container with margin */}
                <div className="mx-3 mb-3">
                  {/* Main card */}
                  <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Dark header with profile */}
                    <div className="bg-gray-900 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${avatarColor} text-white font-semibold shadow-lg`}>
                          {userInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate">{userName}</p>
                          <p className="text-gray-400 text-sm truncate">{settings.businessName}</p>
                        </div>
                        <button
                          onClick={() => setMoreMenuOpen(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
                        >
                          <X className="w-4 h-4 text-white/70" />
                        </button>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="p-2">
                      {moreMenuItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                          <motion.div
                            key={item.name}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 + index * 0.04 }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setMoreMenuOpen(false)}
                              className={`flex items-center gap-3 px-3 py-3.5 rounded-xl transition-colors active:bg-gray-100 ${
                                isActive ? "bg-gray-100" : ""
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isActive ? "bg-gray-900" : "bg-gray-100"
                              }`}>
                                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-600"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`block font-medium ${isActive ? "text-gray-900" : "text-gray-700"}`}>
                                  {item.name}
                                </span>
                                <span className="block text-xs text-gray-400 truncate">
                                  {item.description}
                                </span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-300" />
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Logout button - separate card */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <button
                      onClick={() => {
                        setMoreMenuOpen(false);
                        handleLogout();
                      }}
                      disabled={isLoggingOut}
                      className="w-full mt-2.5 py-3.5 bg-white rounded-2xl text-gray-600 font-medium active:bg-gray-50 transition-colors disabled:opacity-50 shadow-lg"
                    >
                      {isLoggingOut ? "Signing out..." : "Sign Out"}
                    </button>
                  </motion.div>
                  
                  {/* Safe area for iPhone */}
                  <div className="h-1 pb-safe" />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
