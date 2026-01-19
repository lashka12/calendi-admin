"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Save, User, Bell, CreditCard, Globe, 
  Building2, AlertTriangle, Camera, 
  X, Download, Upload,
  Shield, Smartphone, Monitor, Mail,
  Calendar, MapPin, Phone, Trash2,
  ExternalLink, Copy, CheckCircle2, Clock, MessageSquare,
  ChevronRight, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useTranslation } from "@/app/i18n";
import { db, requestNotificationPermission, onForegroundMessage } from "../lib/firebase/config";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

interface DailyReminderSettings {
  enabled: boolean;
  hour: number;
  daysBefore: number;
}

export default function SettingsPage() {
  const { settings } = useSettings();
  const { t, language, setLanguage, languages, isRTL } = useTranslation();
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
        // Enable: Request permission and save token
        // IMPORTANT: You need to get your VAPID key from Firebase Console
        // Go to: Project Settings > Cloud Messaging > Web Push certificates
        const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
        
        if (!VAPID_KEY) {
          setPushError("VAPID key not configured. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY to your environment.");
          return;
        }

        const token = await requestNotificationPermission(VAPID_KEY);
        
        if (token) {
          await setDoc(doc(db, "settings", "adminPushToken"), {
            token,
            updatedAt: new Date(),
          });
          setPushEnabled(true);
          console.log("Push notifications enabled");
        } else {
          setPushError("Permission denied or not supported in this browser.");
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

  // Format hour for display (24h format)
  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const tabs = useMemo(() => [
    { id: "profile", name: t('settings.tabs.profile'), icon: User, description: t('settings.tabs.profileDesc') },
    { id: "notifications", name: t('settings.tabs.notifications'), icon: Bell, description: t('settings.tabs.notificationsDesc') },
    { id: "billing", name: t('settings.tabs.billing'), icon: CreditCard, description: t('settings.tabs.billingDesc') },
    { id: "preferences", name: t('settings.tabs.preferences'), icon: Globe, description: t('settings.tabs.preferencesDesc') },
  ], [t]);

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`toggle-switch relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-gray-800" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          isRTL
            ? (enabled ? 'translate-x-[2px]' : 'translate-x-[22px]')
            : (enabled ? 'translate-x-[22px]' : 'translate-x-[2px]')
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
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl transition-all text-left ${
                    activeTab === tab.id
                      ? "bg-gray-800 text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    activeTab === tab.id ? "text-white" : "text-gray-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tab.name}</p>
                    <p className={`text-xs mt-0.5 truncate ${
                      activeTab === tab.id ? "text-gray-300" : "text-gray-500"
                    }`}>
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile: List-based navigation */}
        <div className="lg:hidden">
          <AnimatePresence mode="wait">
            {mobileListMode ? (
              // Main settings list view
              <motion.div
                key="settings-list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ 
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  mass: 1
                }}
                className="space-y-4"
              >
                {/* Header */}
                <div className="mb-7">
                  <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">{t('settings.title')}</h1>
                  <p className="text-sm text-gray-500 leading-relaxed">Manage your account and preferences</p>
                </div>
                
                <div className="space-y-2.5">
                  {tabs.map((tab, index) => {
                    const Icon = tab.icon;
                    
                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMobileListMode(false);
                        }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          delay: index * 0.05, 
                          duration: 0.2, 
                          ease: "easeOut" 
                        }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-200 active:border-gray-300 active:shadow transition-all duration-150 touch-manipulation"
                      >
                        {/* Active state overlay for better touch feedback */}
                        <motion.div
                          className="absolute inset-0 bg-gray-50/80"
                          initial={{ opacity: 0 }}
                          whileTap={{ opacity: 1 }}
                          transition={{ duration: 0.1 }}
                        />
                        
                        <div className="relative p-5 flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Icon with subtle background */}
                            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-6 h-6 text-gray-700" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-semibold text-gray-900">
                                {tab.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {tab.description}
                              </p>
                            </div>
                          </div>
                          
                          {/* Chevron */}
                          <div className="flex-shrink-0 ml-3">
                            <ChevronRight className={`w-5 h-5 text-gray-400 ${isRTL ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              // Individual setting section view
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ 
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  mass: 1
                }}
                className="space-y-4"
              >
                {/* Enhanced header with better back button */}
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200">
                  <motion.button
                    onClick={() => setMobileListMode(true)}
                    whileTap={{ scale: 0.92 }}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-50 active:bg-gray-100 border border-gray-200 transition-colors duration-150 touch-manipulation -ml-1"
                  >
                    <ArrowLeft className={`w-5 h-5 text-gray-700 ${isRTL ? 'rotate-180' : ''}`} />
                  </motion.button>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-semibold text-gray-900 leading-tight">
                      {tabs.find(t => t.id === activeTab)?.name || t('settings.title')}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {tabs.find(t => t.id === activeTab)?.description}
                    </p>
                  </div>
                </div>
                
                {/* Mobile content - shown when in detail view */}
                <div className="space-y-5">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="space-y-5">
                  {/* Personal Information */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.profile.personalInfo')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.profile.personalInfoDesc')}</p>

                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            {t('settings.profile.firstName')} *
                          </label>
                          <input
                            type="text"
                            defaultValue="John"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            {t('settings.profile.lastName')} *
                          </label>
                          <input
                            type="text"
                            defaultValue="Doe"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.profile.email')} *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            defaultValue="john.doe@example.com"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
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
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="tel"
                            defaultValue="+1 (555) 123-4567"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        <Save className="w-4 h-4" />
                        {t('settings.common.saveChanges')}
                      </button>
                    </div>
                  </div>

                  {/* Business Information */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-5 h-5 text-gray-700" />
                      <h3 className="text-base font-semibold text-gray-900">{t('settings.profile.businessInfo')}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.profile.businessInfoDesc')}</p>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.profile.businessName')} *
                        </label>
                        <input
                          type="text"
                          defaultValue={settings.businessName}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.profile.businessAddress')}
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                          <textarea
                            rows={2}
                            defaultValue="123 Main Street, Suite 100&#10;San Francisco, CA 94103"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            {t('settings.profile.businessType')}
                          </label>
                          <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                            <option>{t('settings.profile.businessTypes.salon')}</option>
                            <option>{t('settings.profile.businessTypes.medical')}</option>
                            <option>{t('settings.profile.businessTypes.fitness')}</option>
                            <option>{t('settings.profile.businessTypes.consulting')}</option>
                            <option>{t('settings.profile.businessTypes.other')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            {t('settings.profile.timezone')}
                          </label>
                          <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                            <option>Pacific Time (PT)</option>
                            <option>Eastern Time (ET)</option>
                            <option>Central Time (CT)</option>
                            <option>Mountain Time (MT)</option>
                            <option>Israel (IST)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        <Save className="w-4 h-4" />
                        {t('settings.common.saveChanges')}
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
                          <div key={channel.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
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
                    <div className="flex items-start gap-3 mb-6">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">New Request Alerts</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Get instant push notifications when customers submit booking requests
                        </p>
                      </div>
                    </div>

                    {pushLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {pushEnabled ? "✅ Push Notifications Enabled" : "Enable Push Notifications"}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {pushEnabled 
                                ? "You'll receive alerts even when the app is closed" 
                                : "Get notified instantly when a new booking request comes in"}
                            </p>
                          </div>
                          <button
                            onClick={togglePushNotifications}
                            disabled={pushSaving}
                            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                              pushEnabled
                                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                : "bg-gray-800 text-white hover:bg-gray-700"
                            }`}
                          >
                            {pushSaving ? (
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                {pushEnabled ? "Disabling..." : "Enabling..."}
                              </span>
                            ) : (
                              pushEnabled ? "Disable" : "Enable"
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
                            💡 Your browser will ask for permission to send notifications. Make sure to allow it!
                          </p>
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
                        <div key={type.key} className="flex items-start justify-between py-4 px-4 hover:bg-gray-50 rounded-xl transition-colors">
                          <div className="flex-1 pr-4">
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

                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        <Save className="w-4 h-4" />
                        {t('settings.notifications.savePreferences')}
                      </button>
                    </div>
                  </div>

                  {/* Daily Reminder Settings */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-start gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{t('settings.notifications.whatsappReminders')}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {t('settings.notifications.whatsappRemindersDesc')}
                        </p>
                      </div>
                    </div>

                    {loadingReminder ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
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

                        {/* Settings (only show when enabled) */}
                        {dailyReminder.enabled && (
                          <div className="space-y-4 pt-2">
                            {/* Send Time */}
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-2">
                                <Clock className="w-4 h-4 inline mr-2 text-gray-400" />
                                {t('settings.notifications.sendAt')}
                              </label>
                              <select
                                value={dailyReminder.hour}
                                onChange={(e) => setDailyReminder({ ...dailyReminder, hour: parseInt(e.target.value) })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent appearance-none bg-white"
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {formatHour(i)}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs text-gray-500 mt-1.5">
                                {t('settings.notifications.sendAtHint')}
                              </p>
                            </div>

                            {/* Days Before */}
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-2">
                                <Calendar className="w-4 h-4 inline mr-2 text-gray-400" />
                                {t('settings.notifications.sendReminder')}
                              </label>
                              <select
                                value={dailyReminder.daysBefore}
                                onChange={(e) => setDailyReminder({ ...dailyReminder, daysBefore: parseInt(e.target.value) })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent appearance-none bg-white"
                              >
                                <option value={0}>{t('settings.notifications.sameDay')}</option>
                                <option value={1}>{t('settings.notifications.daysBefore').replace('{days}', '1')}</option>
                                <option value={2}>{t('settings.notifications.daysBefore').replace('{days}', '2')}</option>
                                <option value={3}>{t('settings.notifications.daysBefore').replace('{days}', '3')}</option>
                                <option value={7}>{t('settings.notifications.weekBefore')}</option>
                              </select>
                              <p className="text-xs text-gray-500 mt-1.5">
                                {t('settings.notifications.daysBeforeHint')}
                              </p>
                            </div>

                          </div>
                        )}

                        {/* Save Button */}
                        <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                          {reminderSaved && (
                            <span className="text-sm text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              {t('settings.common.saved')}
                            </span>
                          )}
                          <button 
                            onClick={saveDailyReminderSettings}
                            disabled={savingReminder}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingReminder ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('settings.common.saving')}
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                {t('settings.notifications.saveReminderSettings')}
                              </>
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
                        <select 
                          value={language}
                          onChange={(e) => setLanguage(e.target.value as 'en' | 'he' | 'ar')}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                        >
                          {Object.entries(languages).map(([code, lang]) => (
                            <option key={code} value={code}>
                              {lang.nativeName} ({lang.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.preferences.dateFormat')}
                        </label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                          <option>MM/DD/YYYY</option>
                          <option>DD/MM/YYYY</option>
                          <option>YYYY-MM-DD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.preferences.timeFormat')}
                        </label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                          <option>{t('settings.preferences.time12h')}</option>
                          <option>{t('settings.preferences.time24h')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {t('settings.preferences.currency')}
                        </label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                          <option>USD ($)</option>
                          <option>EUR (€)</option>
                          <option>GBP (£)</option>
                          <option>ILS (₪)</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        <Save className="w-4 h-4" />
                        {t('settings.preferences.savePreferences')}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{t('settings.preferences.dataPrivacy')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('settings.preferences.dataPrivacyDesc')}</p>

                    <div className="space-y-4">
                      <button className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <Download className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{t('settings.preferences.exportData')}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{t('settings.preferences.exportDataDesc')}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>

                      <button className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{t('settings.preferences.privacyPolicy')}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{t('settings.preferences.privacyPolicyDesc')}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-white border-2 border-red-200 rounded-xl p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-base font-semibold text-red-900 mb-1">{t('settings.preferences.dangerZone')}</h3>
                        <p className="text-sm text-red-700">
                          {t('settings.preferences.dangerZoneDesc')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      <button className="w-full flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-red-900">{t('settings.preferences.deleteAllData')}</p>
                          <p className="text-sm text-red-600 mt-0.5">{t('settings.preferences.deleteAllDataDesc')}</p>
                        </div>
                        <Trash2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                      </button>

                      <button className="w-full flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-red-900">{t('settings.preferences.closeAccount')}</p>
                          <p className="text-sm text-red-600 mt-0.5">{t('settings.preferences.closeAccountDesc')}</p>
                        </div>
                        <X className="w-4 h-4 text-red-600 flex-shrink-0" />
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
