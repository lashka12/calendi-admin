"use client";

import { useState, useEffect } from "react";
import { 
  Save, User, Bell, Lock, CreditCard, Globe, 
  Building2, Users, Zap, AlertTriangle, Camera, 
  X, Eye, EyeOff, Download, Upload,
  Shield, Smartphone, Monitor, Mail,
  Calendar, MapPin, Phone, Trash2,
  ExternalLink, Copy, CheckCircle2, Clock, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { db } from "../lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface DailyReminderSettings {
  enabled: boolean;
  hour: number;
  daysBefore: number;
}

export default function SettingsPage() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);
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

  const tabs = [
    { id: "profile", name: "Profile", icon: User, description: "Personal & business info" },
    { id: "notifications", name: "Notifications", icon: Bell, description: "Manage alerts" },
    { id: "security", name: "Security", icon: Lock, description: "Password & sessions" },
    { id: "billing", name: "Billing", icon: CreditCard, description: "Plans & invoices" },
    { id: "team", name: "Team", icon: Users, description: "Members & roles" },
    { id: "integrations", name: "Integrations", icon: Zap, description: "Connected apps" },
    { id: "preferences", name: "Preferences", icon: Globe, description: "App settings" },
  ];

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`toggle-switch relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-gray-800" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header - hidden on mobile */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tabs sidebar - desktop */}
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

        {/* Mobile tabs - horizontal scroll */}
        <div className="lg:hidden">
          <div className="bg-white border border-gray-200 rounded-xl p-1">
            <div className="flex gap-1 overflow-x-auto hide-scrollbar">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? "bg-gray-800 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Personal Information</h3>
                    <p className="text-sm text-gray-500 mb-6">Update your personal details</p>

                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            First Name *
                          </label>
                          <input
                            type="text"
                            defaultValue="John"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            Last Name *
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
                          Email Address *
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
                          This email is used for login and important notifications
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Phone Number
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
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Business Information */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-5 h-5 text-gray-700" />
                      <h3 className="text-base font-semibold text-gray-900">Business Information</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">Details about your business</p>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Business Name *
                        </label>
                        <input
                          type="text"
                          defaultValue={settings.businessName}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Business Address
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
                            Business Type
                          </label>
                          <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                            <option>Salon & Spa</option>
                            <option>Medical Practice</option>
                            <option>Fitness Studio</option>
                            <option>Consulting</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            Time Zone
                          </label>
                          <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                            <option>Pacific Time (PT)</option>
                            <option>Eastern Time (ET)</option>
                            <option>Central Time (CT)</option>
                            <option>Mountain Time (MT)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Notification Channels</h3>
                    <p className="text-sm text-gray-500 mb-6">Choose how you want to be notified</p>

                    <div className="space-y-4">
                      {[
                        { key: "email", label: "Email Notifications", description: "Receive updates via email", icon: Mail },
                        { key: "sms", label: "SMS Notifications", description: "Get text messages for important updates", icon: Smartphone },
                        { key: "push", label: "Push Notifications", description: "Browser and mobile app notifications", icon: Bell },
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

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Notification Types</h3>
                    <p className="text-sm text-gray-500 mb-6">Manage what notifications you receive</p>

                    <div className="space-y-1">
                      {[
                        {
                          key: "bookingConfirm",
                          label: "Booking Confirmations",
                          description: "When a booking is confirmed or rescheduled",
                        },
                        {
                          key: "bookingReminder",
                          label: "Appointment Reminders",
                          description: "Reminders before upcoming appointments",
                        },
                        {
                          key: "newRequest",
                          label: "New Booking Requests",
                          description: "When customers request a new appointment",
                        },
                        {
                          key: "cancellation",
                          label: "Cancellations",
                          description: "When appointments are cancelled",
                        },
                        {
                          key: "marketing",
                          label: "Marketing & Updates",
                          description: "News, tips, and promotional offers from Calendi",
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
                        Save Preferences
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
                        <h3 className="text-base font-semibold text-gray-900">WhatsApp Daily Reminders</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Automatically send appointment reminders to clients via WhatsApp
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
                            <p className="text-sm font-medium text-gray-900">Enable Daily Reminders</p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              Send automatic reminders to clients about their upcoming appointments
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
                                Send reminders at
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
                                Reminders will be sent daily at this time (Israel timezone)
                              </p>
                            </div>

                            {/* Days Before */}
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-2">
                                <Calendar className="w-4 h-4 inline mr-2 text-gray-400" />
                                Send reminder
                              </label>
                              <select
                                value={dailyReminder.daysBefore}
                                onChange={(e) => setDailyReminder({ ...dailyReminder, daysBefore: parseInt(e.target.value) })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent appearance-none bg-white"
                              >
                                <option value={0}>Same day (day of appointment)</option>
                                <option value={1}>1 day before</option>
                                <option value={2}>2 days before</option>
                                <option value={3}>3 days before</option>
                                <option value={7}>1 week before</option>
                              </select>
                              <p className="text-xs text-gray-500 mt-1.5">
                                How many days before the appointment to send the reminder
                              </p>
                            </div>

                          </div>
                        )}

                        {/* Save Button */}
                        <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                          {reminderSaved && (
                            <span className="text-sm text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              Saved!
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
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Reminder Settings
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div className="space-y-6">
                  {/* Password */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Password</h3>
                    <p className="text-sm text-gray-500 mb-6">Update your password to keep your account secure</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="password"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            placeholder="Enter new password"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                          Must be at least 8 characters with letters and numbers
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="password"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            placeholder="Confirm new password"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-between items-center">
                      <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                        Forgot password?
                      </button>
                      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        Update Password
                      </button>
                    </div>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Shield className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-1">Two-Factor Authentication</h3>
                          <p className="text-sm text-gray-500 mb-4">
                            Add an extra layer of security to your account. We'll ask for a code when you sign in.
                          </p>
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enabled
                          </div>
                        </div>
                      </div>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0 ml-4">
                        Manage
                      </button>
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Active Sessions</h3>
                    <p className="text-sm text-gray-500 mb-6">Manage devices where you're currently signed in</p>

                    <div className="space-y-3">
                      {[
                        { device: "MacBook Pro", browser: "Chrome", location: "San Francisco, CA", time: "Active now", current: true, icon: Monitor },
                        { device: "iPhone 14 Pro", browser: "Safari", location: "San Francisco, CA", time: "2 hours ago", current: false, icon: Smartphone },
                        { device: "iPad Air", browser: "Safari", location: "San Francisco, CA", time: "1 day ago", current: false, icon: Smartphone },
                      ].map((session, i) => {
                        const Icon = session.icon;
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Icon className="w-5 h-5 text-gray-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900">{session.device}</p>
                                  {session.current && (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium border border-emerald-200">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {session.browser} • {session.location}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">{session.time}</p>
                              </div>
                            </div>
                            {!session.current && (
                              <button className="text-sm text-red-600 hover:text-red-700 font-medium flex-shrink-0 ml-4">
                                Revoke
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4">
                      <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                        Sign out of all other sessions
                      </button>
                    </div>
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
                          <h3 className="text-xl font-semibold">Pro Plan</h3>
                          <span className="px-2.5 py-0.5 bg-emerald-500 text-white rounded-lg text-xs font-medium">
                            Active
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">Next billing date: January 1, 2025</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">$49</p>
                        <p className="text-sm text-gray-300">/month</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-700">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Bookings</p>
                        <p className="text-lg font-semibold">324 / ∞</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Team Members</p>
                        <p className="text-lg font-semibold">3 / 10</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Storage</p>
                        <p className="text-lg font-semibold">2.4 / 50 GB</p>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button className="flex-1 px-4 py-2.5 bg-white text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors">
                        Upgrade Plan
                      </button>
                      <button className="px-4 py-2.5 border border-gray-600 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors">
                        Manage
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-6">Payment Method</h3>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          VISA
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">•••• •••• •••• 4242</p>
                          <p className="text-sm text-gray-500 mt-0.5">Expires 12/2025</p>
                        </div>
                      </div>
                      <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                        Update
                      </button>
                    </div>

                    <button className="text-sm text-gray-700 hover:text-gray-900 font-medium">
                      + Add payment method
                    </button>
                  </div>

                  {/* Billing History */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Billing History</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Download your previous invoices</p>
                      </div>
                      <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                        View all
                      </button>
                    </div>

                    <div className="space-y-2">
                      {[
                        { date: "Dec 1, 2024", amount: "$49.00", status: "Paid", invoice: "#INV-1234" },
                        { date: "Nov 1, 2024", amount: "$49.00", status: "Paid", invoice: "#INV-1233" },
                        { date: "Oct 1, 2024", amount: "$49.00", status: "Paid", invoice: "#INV-1232" },
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

              {/* Team Tab */}
              {activeTab === "team" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Team Members</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Manage who has access to your account</p>
                      </div>
                      <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        <Users className="w-4 h-4" />
                        Invite Member
                      </button>
                    </div>

                    <div className="space-y-2">
                      {[
                        { name: "John Doe", email: "john.doe@example.com", role: "Owner", avatar: "https://i.pravatar.cc/150?img=12", status: "Active" },
                        { name: "Sarah Johnson", email: "sarah@example.com", role: "Admin", avatar: "https://i.pravatar.cc/150?img=44", status: "Active" },
                        { name: "Mike Chen", email: "mike@example.com", role: "Member", avatar: "https://i.pravatar.cc/150?img=13", status: "Invited" },
                      ].map((member, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="w-10 h-10 rounded-full border-2 border-gray-100"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                                {member.role === "Owner" && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-200">
                                    {member.role}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
                              <option>{member.role}</option>
                              <option>Admin</option>
                              <option>Member</option>
                            </select>
                            {member.role !== "Owner" && (
                              <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Team Plan</h4>
                        <p className="text-sm text-blue-700">
                          You're using 3 of 10 available team seats. Upgrade to add more members.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === "integrations" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Connected Apps</h3>
                    <p className="text-sm text-gray-500 mb-6">Manage third-party integrations</p>

                    <div className="space-y-3">
                      {[
                        { name: "Google Calendar", description: "Sync appointments with Google Calendar", icon: Calendar, connected: true, color: "bg-blue-600" },
                        { name: "Stripe", description: "Accept payments and manage billing", icon: CreditCard, connected: true, color: "bg-indigo-600" },
                        { name: "Mailchimp", description: "Email marketing and automation", icon: Mail, connected: false, color: "bg-yellow-500" },
                        { name: "Zoom", description: "Virtual meeting integration", icon: Monitor, connected: false, color: "bg-blue-500" },
                      ].map((integration, i) => {
                        const Icon = integration.icon;
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`w-10 h-10 ${integration.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900">{integration.name}</p>
                                  {integration.connected && (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium border border-emerald-200">
                                      Connected
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">{integration.description}</p>
                              </div>
                            </div>
                            {integration.connected ? (
                              <div className="flex gap-2 flex-shrink-0">
                                <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                                  Settings
                                </button>
                                <button className="px-3 py-1.5 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
                                  Disconnect
                                </button>
                              </div>
                            ) : (
                              <button className="px-4 py-1.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0">
                                Connect
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">API Access</h3>
                    <p className="text-sm text-gray-500 mb-6">Manage your API keys and webhooks</p>

                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-gray-900">API Access</p>
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Coming Soon</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          API integration will be available in a future update.
                        </p>
                      </div>

                      <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        View API Documentation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === "preferences" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Regional Settings</h3>
                    <p className="text-sm text-gray-500 mb-6">Customize your regional preferences</p>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Language
                        </label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                          <option>English (US)</option>
                          <option>Spanish</option>
                          <option>French</option>
                          <option>German</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Date Format
                        </label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                          <option>MM/DD/YYYY</option>
                          <option>DD/MM/YYYY</option>
                          <option>YYYY-MM-DD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Time Format
                        </label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                          <option>12-hour (AM/PM)</option>
                          <option>24-hour</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Currency
                        </label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                          <option>USD ($)</option>
                          <option>EUR (€)</option>
                          <option>GBP (£)</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                        <Save className="w-4 h-4" />
                        Save Preferences
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Data & Privacy</h3>
                    <p className="text-sm text-gray-500 mb-6">Manage your data and privacy settings</p>

                    <div className="space-y-4">
                      <button className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <Download className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Export Your Data</p>
                            <p className="text-sm text-gray-500 mt-0.5">Download a copy of your account data</p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>

                      <button className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Privacy Policy</p>
                            <p className="text-sm text-gray-500 mt-0.5">Review our privacy policy</p>
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
                        <h3 className="text-base font-semibold text-red-900 mb-1">Danger Zone</h3>
                        <p className="text-sm text-red-700">
                          Irreversible actions that will permanently affect your account
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      <button className="w-full flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-red-900">Delete All Data</p>
                          <p className="text-sm text-red-600 mt-0.5">Permanently delete all your appointments and clients</p>
                        </div>
                        <Trash2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                      </button>

                      <button className="w-full flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-red-900">Close Account</p>
                          <p className="text-sm text-red-600 mt-0.5">Permanently delete your account and all associated data</p>
                        </div>
                        <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
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
