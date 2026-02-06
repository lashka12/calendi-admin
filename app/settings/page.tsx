"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  User, Bell, CreditCard, Globe, 
  Building2, AlertTriangle, Camera, 
  X, Download, Upload,
  Shield, Smartphone, Monitor, Mail,
  Calendar, MapPin, Phone, Trash2,
  ExternalLink, Copy, CheckCircle2, Clock, MessageSquare,
  ChevronRight, ArrowLeft, Navigation, ChevronDown, Zap,
  HelpCircle, Send, LogOut, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "../components/ui/CustomSelect";
import { useSettings } from "../context/SettingsContext";
import { useTranslation } from "@/app/i18n";
import { db, requestNotificationPermission, onForegroundMessage } from "../lib/firebase/config";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { updateBusinessSettings } from "../lib/firebase/settings";
import { signOutAdmin } from "../lib/firebase/auth";
import { useRouter } from "next/navigation";

interface DailyReminderSettings {
  enabled: boolean;
  hour: number;
  daysBefore: number;
}

export default function SettingsPage() {
  const { settings } = useSettings();
  const { t, language, setLanguage, languages, isRTL } = useTranslation();
  const router = useRouter();
  // On mobile: null = list view, tab id = detail view
  // On desktop: always show a tab (default to "profile")
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [mobileListMode, setMobileListMode] = useState(true);
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: false,
    bookingConfirm: true,
    bookingReminder: true,
    newRequest: true,
    cancellation: true,
    marketing: false,
  });
  
  // Daily reminder settings
  const [dailyReminder, setDailyReminder] = useState<DailyReminderSettings>({
    enabled: false,
    hour: 8,
    daysBefore: 1,
  });
  const [loadingReminder, setLoadingReminder] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);

  // Admin push notifications state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Booking settings state
  const [advanceBookingLimit, setAdvanceBookingLimit] = useState<number>(90);
  const [minBookingNotice, setMinBookingNotice] = useState<number>(0);
  const [showPrices, setShowPrices] = useState<boolean>(true);
  const [savingBookingSettings, setSavingBookingSettings] = useState(false);
  const [bookingSettingsSaved, setBookingSettingsSaved] = useState(false);

  // Personal profile state
  const [personalData, setPersonalData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
  });
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [whatsappExpanded, setWhatsappExpanded] = useState(false);

  // Sync booking settings from context
  useEffect(() => {
    if (settings.advanceBookingLimit !== undefined) {
      setAdvanceBookingLimit(settings.advanceBookingLimit);
    }
    if (settings.minBookingNotice !== undefined) {
      setMinBookingNotice(settings.minBookingNotice);
    }
    if (settings.showPrices !== undefined) {
      setShowPrices(settings.showPrices);
    }
  }, [settings.advanceBookingLimit, settings.minBookingNotice, settings.showPrices]);

  // Load personal data from Firestore
  useEffect(() => {
    const loadPersonalData = async () => {
      try {
        const docRef = doc(db, "settings", "personal");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPersonalData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
          });
        }
      } catch (error) {
        console.error("Error loading personal data:", error);
      } finally {
        setLoadingPersonal(false);
      }
    };
    loadPersonalData();
  }, []);

  // Load daily reminder settings from Firestore
  useEffect(() => {
    const loadDailyReminderSettings = async () => {
      try {
        const docRef = doc(db, "settings", "notifications");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().dailyReminder) {
          setDailyReminder(docSnap.data().dailyReminder);
        }
      } catch (error) {
        console.error("Error loading daily reminder settings:", error);
      } finally {
        setLoadingReminder(false);
      }
    };
    loadDailyReminderSettings();
  }, []);

  const [reminderSaved, setReminderSaved] = useState(false);

  // Load admin push notification status
  useEffect(() => {
    const loadPushStatus = async () => {
      try {
        const docRef = doc(db, "settings", "adminPushToken");
        const docSnap = await getDoc(docRef);
        setPushEnabled(docSnap.exists() && !!docSnap.data()?.token);
      } catch (error) {
        console.error("Error loading push status:", error);
      } finally {
        setPushLoading(false);
      }
    };
    loadPushStatus();
  }, []);

  // Listen for foreground push messages
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload: any) => {
      console.log("Foreground message received:", payload);
      // You could show a toast notification here
    });
    return unsubscribe;
  }, []);

  // Toggle push notifications
  const togglePushNotifications = async () => {
    setPushSaving(true);
    setPushError(null);

    try {
      if (pushEnabled) {
        // Disable: Delete token from Firestore
        await deleteDoc(doc(db, "settings", "adminPushToken"));
        setPushEnabled(false);
        console.log("Push notifications disabled");
      } else {
        // Check browser support first
        if (!("Notification" in window)) {
          setPushError("This browser doesn't support push notifications.");
          return;
        }

        if (!("serviceWorker" in navigator)) {
          setPushError("Service workers not supported. Try Chrome, Firefox, or Safari.");
          return;
        }

        // Enable: Request permission and save token
        const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
        
        console.log("VAPID_KEY present:", !!VAPID_KEY, VAPID_KEY ? `(${VAPID_KEY.substring(0, 10)}...)` : "");
        
        if (!VAPID_KEY) {
          setPushError("VAPID key missing. Rebuild with: npm run build && firebase deploy --only hosting");
          return;
        }

        // Check current permission status
        const currentPermission = Notification.permission;
        console.log("Current notification permission:", currentPermission);
        
        if (currentPermission === "denied") {
          setPushError("Notifications blocked. Please enable in browser settings and refresh.");
          return;
        }

        const token = await requestNotificationPermission(VAPID_KEY);
        
        if (token) {
          await setDoc(doc(db, "settings", "adminPushToken"), {
            token,
            updatedAt: new Date(),
          });
          setPushEnabled(true);
          console.log("Push notifications enabled, token:", token.substring(0, 20) + "...");
        } else {
          setPushError("Failed to get token. Check browser console for details.");
        }
      }
    } catch (error: any) {
      console.error("Error toggling push notifications:", error);
      setPushError(error.message || "Failed to toggle push notifications");
    } finally {
      setPushSaving(false);
    }
  };

  // Save daily reminder settings to Firestore
  const saveDailyReminderSettings = async () => {
    setSavingReminder(true);
    setReminderSaved(false);
    try {
      const docRef = doc(db, "settings", "notifications");
      await setDoc(docRef, { dailyReminder }, { merge: true });
      setReminderSaved(true);
      setTimeout(() => setReminderSaved(false), 3000);
    } catch (error) {
      console.error("Error saving daily reminder settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setSavingReminder(false);
    }
  };

  // Save booking settings (advance booking limit + min notice)
  const saveBookingSettings = async () => {
    setSavingBookingSettings(true);
    setBookingSettingsSaved(false);
    try {
      await updateBusinessSettings({ advanceBookingLimit, minBookingNotice, showPrices });
      setBookingSettingsSaved(true);
      setTimeout(() => setBookingSettingsSaved(false), 3000);
    } catch (error) {
      console.error("Error saving booking settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setSavingBookingSettings(false);
    }
  };

  // Save personal data to Firestore
  const savePersonalData = async () => {
    setSavingPersonal(true);
    setPersonalSaved(false);
    try {
      const docRef = doc(db, "settings", "personal");
      await setDoc(docRef, {
        firstName: personalData.firstName,
        lastName: personalData.lastName,
        email: personalData.email,
        phone: personalData.phone,
        address: personalData.address,
        updatedAt: new Date(),
      }, { merge: true });
      setPersonalSaved(true);
      setTimeout(() => setPersonalSaved(false), 3000);
    } catch (error) {
      console.error("Error saving personal data:", error);
      alert("Failed to save personal data. Please try again.");
    } finally {
      setSavingPersonal(false);
    }
  };

  // Get current location from device
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert(t('settings.profile.locationNotSupported'));
      return;
    }

    setGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use OpenStreetMap Nominatim for reverse geocoding (free)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=${language}`
          );
          const data = await response.json();
          
          if (data.display_name) {
            setPersonalData(prev => ({ ...prev, address: data.display_name }));
          } else {
            // Fallback to coordinates if geocoding fails
            setPersonalData(prev => ({ ...prev, address: `${latitude}, ${longitude}` }));
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          // Fallback to coordinates
          setPersonalData(prev => ({ ...prev, address: `${latitude}, ${longitude}` }));
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        setGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert(t('settings.profile.locationDenied'));
            break;
          case error.POSITION_UNAVAILABLE:
            alert(t('settings.profile.locationUnavailable'));
            break;
          case error.TIMEOUT:
            alert(t('settings.profile.locationTimeout'));
            break;
          default:
            alert(t('settings.profile.locationError'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Format hour for display (24h format)
  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const tabs = useMemo(() => [
    { id: "profile", name: t('settings.tabs.profile'), icon: User, description: t('settings.tabs.profileDesc') },
    { id: "business", name: t('settings.tabs.business'), icon: Building2, description: t('settings.tabs.businessDesc') },
    { id: "notifications", name: t('settings.tabs.notifications'), icon: Bell, description: t('settings.tabs.notificationsDesc') },
    { id: "billing", name: t('settings.tabs.billing'), icon: CreditCard, description: t('settings.tabs.billingDesc'), comingSoon: true },
    { id: "preferences", name: t('settings.tabs.preferences'), icon: Globe, description: t('settings.tabs.preferencesDesc') },
    { id: "data", name: t('settings.tabs.data'), icon: Download, description: t('settings.tabs.dataDesc') },
  ], [t]);

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      dir="ltr"
      className={`toggle-switch relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-gray-800" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold text-gray-900">{t('settings.title')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Desktop: Tabs sidebar */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-2 sticky top-24">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl transition-all text-left ${
                    tab.comingSoon
                      ? "text-gray-400 cursor-not-allowed"
                      : activeTab === tab.id
                        ? "bg-gray-800 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    tab.comingSoon ? "text-gray-300" : activeTab === tab.id ? "text-white" : "text-gray-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{tab.name}</p>
                      {tab.comingSoon && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">
                          {t('settings.data.comingSoon')}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${
                      tab.comingSoon ? "text-gray-400" : activeTab === tab.id ? "text-gray-300" : "text-gray-500"
                    }`}>
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
            
            {/* Sign Out Button */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <button
                onClick={async () => {
                  const result = await signOutAdmin();
                  if (result.success) {
                    router.push('/login');
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm font-medium text-red-600">{t('nav.signOut')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: Clean settings with consistent coloring */}
        <div className="lg:hidden">
          <AnimatePresence mode="wait">
            {mobileListMode ? (
              // Main settings list view
              <motion.div
                key="settings-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Profile Card - Prominent at top */}
                <motion.button
                  onClick={() => {
                    setActiveTab("profile");
                    setMobileListMode(false);
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-200 active:bg-gray-50 transition-colors"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center text-white text-lg font-semibold">
                      {settings.businessName?.charAt(0) || 'A'}
                    </div>
                    <div className="flex-1 text-start">
                      <p className="text-base font-semibold text-gray-900">
                        {t('settings.tabs.profile')}
                      </p>
                      <p className="text-sm text-gray-500">{settings.businessName || 'Your Business'}</p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 ${isRTL ? 'rotate-180' : ''}`} />
                  </div>
                </motion.button>

                {/* Settings List */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100"
                >
                  {tabs.filter(tab => tab.id !== 'profile').map((tab) => {
                    const Icon = tab.icon;
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (!tab.comingSoon) {
                            setActiveTab(tab.id);
                            setMobileListMode(false);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-4 transition-colors ${
                          tab.comingSoon ? 'opacity-60' : 'active:bg-gray-50'
                        }`}
                        dir={isRTL ? 'rtl' : 'ltr'}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          tab.comingSoon ? 'bg-gray-50' : 'bg-gray-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${tab.comingSoon ? 'text-gray-400' : 'text-gray-600'}`} strokeWidth={2} />
                        </div>
                        <div className="flex-1 text-start">
                          <div className="flex items-center gap-2">
                            <p className={`text-[15px] font-medium ${tab.comingSoon ? 'text-gray-500' : 'text-gray-900'}`}>{tab.name}</p>
                            {tab.comingSoon && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">
                                {t('settings.data.comingSoon')}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 ${tab.comingSoon ? 'text-gray-400' : 'text-gray-500'}`}>{tab.description}</p>
                        </div>
                        {!tab.comingSoon && (
                          <ChevronRight className={`w-5 h-5 text-gray-400 ${isRTL ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Sign Out - integrated at bottom of list */}
                  <div className="border-t border-gray-100 mt-1">
                    <button
                      onClick={async () => {
                        const result = await signOutAdmin();
                        if (result.success) {
                          router.push('/login');
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-4 transition-colors active:bg-red-50"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50">
                        <LogOut className="w-5 h-5 text-red-500" strokeWidth={2} />
                      </div>
                      <div className="flex-1 text-start">
                        <p className="text-[15px] font-medium text-red-600">{t('nav.signOut')}</p>
                      </div>
                    </button>
                  </div>
                </motion.div>

                {/* App Version & Update */}
                <div className="text-center pt-4 space-y-3">
                  <p className="text-xs text-gray-400">Calendi Admin {t('settings.app.version')} 1.1</p>
                  <button
                    onClick={async () => {
                      // Clear all browser caches
                      if ('caches' in window) {
                        const names = await caches.keys();
                        await Promise.all(names.map(name => caches.delete(name)));
                      }
                      // Force reload with cache busting
                      window.location.href = window.location.pathname + '?v=' + Date.now();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('settings.app.checkForUpdates')}
                  </button>
                </div>
              </motion.div>
            ) : (
              // Individual setting section view
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="min-h-full"
              >
                {/* Fixed header */}
                <div 
                  className="fixed top-0 left-0 right-0 z-30 bg-[#faf9f7]/95 backdrop-blur-md border-b border-gray-200/60" 
                  style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <div className="flex items-center h-14 px-4">
                    {/* Back button */}
                    <motion.button
                      onClick={() => setMobileListMode(true)}
                      whileTap={{ scale: 0.95 }}
                      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
                    >
                      <ArrowLeft className={`w-5 h-5 text-gray-600 ${isRTL ? 'rotate-180' : ''}`} />
                    </motion.button>
                    
                    {/* Title - centered */}
                    <div className="flex-1 text-center px-2">
                      <h1 className="text-base font-semibold text-gray-900">
                        {tabs.find(t => t.id === activeTab)?.name || t('settings.title')}
                      </h1>
                      <p className="text-[11px] text-gray-500 -mt-0.5">
                        {tabs.find(t => t.id === activeTab)?.description}
                      </p>
                    </div>
                    
                    {/* Spacer for balance */}
                    <div className="w-9 h-9" />
                  </div>
                </div>
                
                {/* Mobile content */}
                <div className="space-y-5 pt-14">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="space-y-5">
                  {/* Personal Information */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.profile.personalInfo')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.profile.personalInfoDesc')}</p>

                    {loadingPersonal ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-2">
                                {t('settings.profile.firstName')}
                              </label>
                              <input
                                type="text"
                                value={personalData.firstName}
                                onChange={(e) => setPersonalData({ ...personalData, firstName: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                placeholder={t('settings.profile.firstName')}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-2">
                                {t('settings.profile.lastName')}
                              </label>
                              <input
                                type="text"
                                value={personalData.lastName}
                                onChange={(e) => setPersonalData({ ...personalData, lastName: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                placeholder={t('settings.profile.lastName')}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                              {t('settings.profile.email')}
                            </label>
                            <div className="relative">
                              <Mail className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                              <input
                                type="email"
                                value={personalData.email}
                                onChange={(e) => setPersonalData({ ...personalData, email: e.target.value })}
                                className={`w-full py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                                placeholder={t('settings.profile.email')}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5">
                              {t('settings.profile.emailHint')}
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                              {t('settings.profile.phone')}
                            </label>
                            <div className="relative">
                              <Phone className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                              <input
                                type="tel"
                                value={personalData.phone}
                                onChange={(e) => setPersonalData({ ...personalData, phone: e.target.value })}
                                className={`w-full py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                                placeholder={t('settings.profile.phone')}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-900">
                                {t('settings.profile.address')}
                              </label>
                              <button
                                type="button"
                                onClick={getCurrentLocation}
                                disabled={gettingLocation}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                              >
                                {gettingLocation ? (
                                  <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Navigation className="w-3.5 h-3.5" />
                                )}
                                {t('settings.profile.useCurrentLocation')}
                              </button>
                            </div>
                            <div className="relative">
                              <MapPin className={`absolute top-3 w-5 h-5 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                              <textarea
                                rows={2}
                                value={personalData.address}
                                onChange={(e) => setPersonalData({ ...personalData, address: e.target.value })}
                                className={`w-full py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                                placeholder={t('settings.profile.address')}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
                          {personalSaved && (
                            <div className="flex items-center gap-2 text-green-600 text-sm">
                              <CheckCircle2 className="w-4 h-4" />
                              {t('settings.common.saved')}
                            </div>
                          )}
                          {!personalSaved && <div />}
                          <button 
                            onClick={savePersonalData}
                            disabled={savingPersonal}
                            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            {savingPersonal ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              t('settings.common.saveChanges')
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Business Tab */}
              {activeTab === "business" && (
                <div className="space-y-5">
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.business.title')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.business.titleDesc')}</p>

                    <div className="space-y-6">
                      {/* Business Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.business.businessName')}
                        </label>
                        <p className="text-sm text-gray-500 mb-3">
                          {t('settings.business.businessNameDesc')}
                        </p>
                        <input
                          type="text"
                          value={settings.businessName || ''}
                          readOnly
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-gray-500"
                        />
                      </div>

                      {/* Timezone */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.business.timezone')}
                        </label>
                        <p className="text-sm text-gray-500 mb-3">
                          {t('settings.business.timezoneDesc')}
                        </p>
                        <input
                          type="text"
                          value={settings.timezone || 'Asia/Jerusalem'}
                          readOnly
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-gray-500"
                        />
                      </div>

                      {/* Slot Duration */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.business.slotDuration')}
                        </label>
                        <p className="text-sm text-gray-500 mb-3">
                          {t('settings.business.slotDurationDesc')}
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={settings.slotDuration || 15}
                            readOnly
                            className="w-24 px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-gray-500"
                          />
                          <span className="text-sm text-gray-500">{t('settings.business.minutes')}</span>
                        </div>
                      </div>

                      {/* Advance Booking Limit */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.business.advanceBookingLimit')}
                        </label>
                        <p className="text-sm text-gray-500 mb-3">
                          {t('settings.business.advanceBookingLimitDesc')}
                        </p>
                        <CustomSelect
                          value={advanceBookingLimit}
                          onChange={(val) => setAdvanceBookingLimit(Number(val))}
                          isRTL={isRTL}
                          options={[
                            { value: 7, label: t('settings.preferences.week1') },
                            { value: 14, label: t('settings.preferences.weeks2') },
                            { value: 21, label: t('settings.preferences.weeks3') },
                            { value: 30, label: t('settings.preferences.month1') },
                            { value: 60, label: t('settings.preferences.months2') },
                            { value: 90, label: t('settings.preferences.months3') },
                            { value: 180, label: t('settings.preferences.months6') },
                            { value: 365, label: t('settings.preferences.year1') },
                          ]}
                        />
                      </div>

                      {/* Minimum Booking Notice */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.business.minBookingNotice')}
                        </label>
                        <p className="text-sm text-gray-500 mb-3">
                          {t('settings.business.minBookingNoticeDesc')}
                        </p>
                        <CustomSelect
                          value={minBookingNotice}
                          onChange={(val) => setMinBookingNotice(Number(val))}
                          isRTL={isRTL}
                          options={[
                            { value: 0, label: t('settings.preferences.noMinimum') },
                            { value: 1, label: t('settings.preferences.hour1') },
                            { value: 2, label: t('settings.preferences.hours2') },
                            { value: 3, label: t('settings.preferences.hours3') },
                            { value: 4, label: t('settings.preferences.hours4') },
                            { value: 6, label: t('settings.preferences.hours6') },
                            { value: 12, label: t('settings.preferences.hours12') },
                            { value: 24, label: t('settings.preferences.hours24') },
                            { value: 48, label: t('settings.preferences.hours48') },
                          ]}
                        />
                      </div>

                      {/* Show Prices */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t('settings.business.showPrices')}</p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {t('settings.business.showPricesDesc')}
                          </p>
                        </div>
                        <ToggleSwitch
                          enabled={showPrices}
                          onChange={() => setShowPrices(!showPrices)}
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
                      {bookingSettingsSaved && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          {t('settings.common.saved')}
                        </div>
                      )}
                      {!bookingSettingsSaved && <div />}
                      <button 
                        onClick={saveBookingSettings}
                        disabled={savingBookingSettings}
                        className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {savingBookingSettings ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : (
                          t('settings.common.saveChanges')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.notifications.channels')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.notifications.channelsDesc')}</p>

                    <div className="space-y-4">
                      {[
                        { key: "email", label: t('settings.notifications.emailLabel'), description: t('settings.notifications.emailDesc'), icon: Mail },
                        { key: "sms", label: t('settings.notifications.smsLabel'), description: t('settings.notifications.smsDesc'), icon: Smartphone },
                        { key: "push", label: t('settings.notifications.pushLabel'), description: t('settings.notifications.pushDesc'), icon: Bell },
                      ].map((channel) => {
                        const Icon = channel.icon;
                        return (
                          <div key={channel.key} dir={isRTL ? 'rtl' : 'ltr'} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Icon className="w-5 h-5 text-gray-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{channel.label}</p>
                                <p className="text-sm text-gray-500 mt-0.5">{channel.description}</p>
                              </div>
                            </div>
                            <ToggleSwitch
                              enabled={notifications[channel.key as keyof typeof notifications]}
                              onChange={() =>
                                setNotifications({
                                  ...notifications,
                                  [channel.key]: !notifications[channel.key as keyof typeof notifications],
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Admin Push Notifications - New Request Alerts */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-start gap-3 mb-6" dir={isRTL ? 'rtl' : 'ltr'}>
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{t('settings.notifications.pushAlerts')}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {t('settings.notifications.pushAlertsDesc')}
                        </p>
                      </div>
                    </div>

                    {pushLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {pushEnabled ? t('settings.notifications.pushEnabled') : t('settings.notifications.pushDisabled')}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {pushEnabled 
                                ? t('settings.notifications.pushEnabledDesc')
                                : t('settings.notifications.pushDisabledDesc')}
                            </p>
                          </div>
                          <button
                            onClick={togglePushNotifications}
                            disabled={pushSaving}
                            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex-shrink-0 ${
                              pushEnabled
                                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                : "bg-gray-800 text-white hover:bg-gray-700"
                            }`}
                          >
                            {pushSaving ? (
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                {pushEnabled ? t('settings.notifications.disabling') : t('settings.notifications.enabling')}
                              </span>
                            ) : (
                              pushEnabled ? t('settings.notifications.disable') : t('settings.notifications.enable')
                            )}
                          </button>
                        </div>

                        {pushError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-700">{pushError}</p>
                          </div>
                        )}

                        {!pushEnabled && (
                          <p className="text-xs text-gray-500">
                            {t('settings.notifications.browserPermission')}
                          </p>
                        )}

                        {pushEnabled && (
                          <div className="pt-3 border-t border-gray-200">
                            <button
                              onClick={() => {
                                if ('Notification' in window && Notification.permission === 'granted') {
                                  new Notification(t('settings.notifications.testNotificationTitle'), {
                                    body: t('settings.notifications.testNotificationBody'),
                                    icon: '/icons/icon-192.svg',
                                    tag: 'test-notification',
                                  });
                                } else {
                                  setPushError(t('settings.notifications.permissionNotGranted'));
                                }
                              }}
                              className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2"
                            >
                              <Bell className="w-4 h-4" />
                              {t('settings.notifications.sendTestNotification')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.notifications.types')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.notifications.typesDesc')}</p>

                    <div className="space-y-1">
                      {[
                        {
                          key: "bookingConfirm",
                          label: t('settings.notifications.bookingConfirmLabel'),
                          description: t('settings.notifications.bookingConfirmDesc'),
                        },
                        {
                          key: "bookingReminder",
                          label: t('settings.notifications.bookingReminderLabel'),
                          description: t('settings.notifications.bookingReminderDesc'),
                        },
                        {
                          key: "newRequest",
                          label: t('settings.notifications.newRequestLabel'),
                          description: t('settings.notifications.newRequestDesc'),
                        },
                        {
                          key: "cancellation",
                          label: t('settings.notifications.cancellationLabel'),
                          description: t('settings.notifications.cancellationDesc'),
                        },
                        {
                          key: "marketing",
                          label: t('settings.notifications.marketingLabel'),
                          description: t('settings.notifications.marketingDesc'),
                        },
                      ].map((type) => (
                        <div key={type.key} dir={isRTL ? 'rtl' : 'ltr'} className="flex items-start justify-between py-4 px-4 hover:bg-gray-50 rounded-xl transition-colors gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{type.label}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{type.description}</p>
                          </div>
                          <ToggleSwitch
                            enabled={notifications[type.key as keyof typeof notifications]}
                            onChange={() =>
                              setNotifications({
                                ...notifications,
                                [type.key]: !notifications[type.key as keyof typeof notifications],
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Daily Reminder Settings */}
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-gray-100" dir={isRTL ? 'rtl' : 'ltr'}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-5 h-5 text-[#25D366]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900">{t('settings.notifications.whatsappReminders')}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {t('settings.notifications.whatsappRemindersDesc')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {loadingReminder ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div>
                        {/* Enable/Disable Toggle */}
                        <div className="p-5 border-b border-gray-100" dir={isRTL ? 'rtl' : 'ltr'}>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{t('settings.notifications.enableReminders')}</p>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {t('settings.notifications.enableRemindersDesc')}
                              </p>
                            </div>
                            <ToggleSwitch
                              enabled={dailyReminder.enabled}
                              onChange={() => setDailyReminder({ ...dailyReminder, enabled: !dailyReminder.enabled })}
                            />
                          </div>
                        </div>

                        {/* Settings (only show when enabled) */}
                        {dailyReminder.enabled && (
                          <div className="p-5 space-y-5 bg-gray-50/50" dir={isRTL ? 'rtl' : 'ltr'}>
                            {/* Send Time */}
                            <div className="bg-white rounded-xl p-4 border border-gray-100">
                              <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <label className="text-sm font-medium text-gray-900">
                                  {t('settings.notifications.sendAt')}
                                </label>
                              </div>
                              <CustomSelect
                                value={dailyReminder.hour}
                                onChange={(val) => setDailyReminder({ ...dailyReminder, hour: Number(val) })}
                                isRTL={isRTL}
                                options={Array.from({ length: 24 }, (_, i) => ({
                                  value: i,
                                  label: formatHour(i),
                                }))}
                              />
                              <p className="text-xs text-gray-500 mt-2">
                                {t('settings.notifications.sendAtHint')}
                              </p>
                            </div>

                            {/* Days Before */}
                            <div className="bg-white rounded-xl p-4 border border-gray-100">
                              <div className="flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <label className="text-sm font-medium text-gray-900">
                                  {t('settings.notifications.sendReminder')}
                                </label>
                              </div>
                              <CustomSelect
                                value={dailyReminder.daysBefore}
                                onChange={(val) => setDailyReminder({ ...dailyReminder, daysBefore: Number(val) })}
                                isRTL={isRTL}
                                options={[
                                  { value: 0, label: t('settings.notifications.sameDay') },
                                  { value: 1, label: t('settings.notifications.daysBefore').replace('{days}', '1') },
                                  { value: 2, label: t('settings.notifications.daysBefore').replace('{days}', '2') },
                                  { value: 3, label: t('settings.notifications.daysBefore').replace('{days}', '3') },
                                  { value: 7, label: t('settings.notifications.weekBefore') },
                                ]}
                              />
                              <p className="text-xs text-gray-500 mt-2">
                                {t('settings.notifications.daysBeforeHint')}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Save Button */}
                        <div className="p-5 bg-white border-t border-gray-100 flex items-center justify-end gap-3" dir={isRTL ? 'rtl' : 'ltr'}>
                          {reminderSaved && (
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              {t('settings.common.saved')}
                            </span>
                          )}
                          <button 
                            onClick={saveDailyReminderSettings}
                            disabled={savingReminder}
                            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            {savingReminder ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              t('settings.notifications.saveReminderSettings')
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === "billing" && (
                <div className="space-y-6">
                  {/* Current Plan */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 text-white">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold">{t('settings.billing.proPlan')}</h3>
                          <span className="px-2.5 py-0.5 bg-emerald-500 text-white rounded-lg text-xs font-medium">
                            {t('settings.billing.active')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{t('settings.billing.nextBilling')}: January 1, 2025</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">$49</p>
                        <p className="text-sm text-gray-300">/{t('settings.billing.month')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-700">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">{t('settings.billing.bookings')}</p>
                        <p className="text-lg font-semibold">324 / ∞</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">{t('settings.billing.teamMembers')}</p>
                        <p className="text-lg font-semibold">3 / 10</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">{t('settings.billing.storage')}</p>
                        <p className="text-lg font-semibold">2.4 / 50 GB</p>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button className="flex-1 px-4 py-2.5 bg-white text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors">
                        {t('settings.billing.upgradePlan')}
                      </button>
                      <button className="px-4 py-2.5 border border-gray-600 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors">
                        {t('settings.billing.manage')}
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-6">{t('settings.billing.paymentMethod')}</h3>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          VISA
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">•••• •••• •••• 4242</p>
                          <p className="text-sm text-gray-500 mt-0.5">{t('settings.billing.expires')} 12/2025</p>
                        </div>
                      </div>
                      <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                        {t('settings.billing.update')}
                      </button>
                    </div>

                    <button className="text-sm text-gray-700 hover:text-gray-900 font-medium">
                      + {t('settings.billing.addPaymentMethod')}
                    </button>
                  </div>

                  {/* Billing History */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{t('settings.billing.billingHistory')}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{t('settings.billing.billingHistoryDesc')}</p>
                      </div>
                      <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                        {t('settings.billing.viewAll')}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {[
                        { date: "Dec 1, 2024", amount: "$49.00", status: t('settings.billing.paid'), invoice: "#INV-1234" },
                        { date: "Nov 1, 2024", amount: "$49.00", status: t('settings.billing.paid'), invoice: "#INV-1233" },
                        { date: "Oct 1, 2024", amount: "$49.00", status: t('settings.billing.paid'), invoice: "#INV-1232" },
                      ].map((invoice, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                              <CreditCard className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{invoice.date}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-gray-500">{invoice.invoice}</p>
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium border border-emerald-200">
                                  {invoice.status}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-gray-900">{invoice.amount}</p>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                              <Download className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === "preferences" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.preferences.regional')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.preferences.regionalDesc')}</p>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.preferences.language')}
                        </label>
                        <CustomSelect
                          value={language}
                          onChange={(val) => setLanguage(val as 'en' | 'he' | 'ar')}
                          isRTL={isRTL}
                          options={Object.entries(languages).map(([code, lang]) => ({
                            value: code,
                            label: `${lang.nativeName} (${lang.name})`,
                          }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.preferences.dateFormat')}
                        </label>
                        <CustomSelect
                          value="DD/MM/YYYY"
                          onChange={() => {}}
                          isRTL={isRTL}
                          options={[
                            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.preferences.timeFormat')}
                        </label>
                        <CustomSelect
                          value="24h"
                          onChange={() => {}}
                          isRTL={isRTL}
                          options={[
                            { value: '12h', label: t('settings.preferences.time12h') },
                            { value: '24h', label: t('settings.preferences.time24h') },
                          ]}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Data Tab */}
              {activeTab === "data" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.data.title')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.data.titleDesc')}</p>

                    <div className="space-y-4">
                      <button dir={isRTL ? 'rtl' : 'ltr'} className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-start">
                        <div className="flex items-center gap-3">
                          <Download className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{t('settings.data.exportData')}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{t('settings.data.exportDataDesc')}</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg flex-shrink-0">
                          {t('settings.data.comingSoon')}
                        </span>
                      </button>

                      <button dir={isRTL ? 'rtl' : 'ltr'} className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-start">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{t('settings.data.privacyPolicy')}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{t('settings.data.privacyPolicyDesc')}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Us Tab */}
              {activeTab === "contact" && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6" dir={isRTL ? 'rtl' : 'ltr'}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                        <HelpCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{t('settings.contact.title')}</h3>
                        <p className="text-sm text-gray-500">{t('settings.contact.subtitle')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Options */}
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    {/* Email */}
                    <a 
                      href={`mailto:${t('settings.contact.emailAddress')}`}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t('settings.contact.email')}</p>
                        <p className="text-sm text-gray-500">{t('settings.contact.emailDesc')}</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                    </a>

                    {/* WhatsApp */}
                    <a 
                      href={`https://wa.me/${t('settings.contact.whatsappNumber').replace(/\s+/g, '').replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t('settings.contact.whatsapp')}</p>
                        <p className="text-sm text-gray-500">{t('settings.contact.whatsappDesc')}</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                    </a>

                    {/* Phone */}
                    <a 
                      href={`tel:${t('settings.contact.phoneNumber').replace(/\s+/g, '')}`}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Phone className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t('settings.contact.phone')}</p>
                        <p className="text-sm text-gray-500">{t('settings.contact.phoneDesc')}</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                    </a>

                    {/* FAQ */}
                    <a 
                      href="#"
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <HelpCircle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t('settings.contact.faq')}</p>
                        <p className="text-sm text-gray-500">{t('settings.contact.faqDesc')}</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                    </a>
                  </div>

                  {/* Feedback Section */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6" dir={isRTL ? 'rtl' : 'ltr'}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Send className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{t('settings.contact.feedback')}</h3>
                        <p className="text-sm text-gray-500">{t('settings.contact.feedbackDesc')}</p>
                      </div>
                    </div>
                    <textarea
                      rows={4}
                      placeholder={t('settings.contact.feedbackPlaceholder')}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
                    />
                    <div className="mt-4 flex justify-end">
                      <button className={`inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Send className="w-4 h-4" />
                        {t('settings.contact.send')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
                </div>
            </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
