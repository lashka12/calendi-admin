"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Clock, Check, X, Phone, Mail, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/app/i18n";
import { 
  subscribeToPendingBookings, 
  approvePendingBooking, 
  rejectPendingBooking,
  type PendingBooking 
} from "../lib/firebase/requests";

interface RequestDisplay {
  id: string;
  client: string;
  email?: string;
  phone: string;
  service: string;
  date: string;
  rawDate: string; // YYYY-MM-DD for comparison
  time: string;
  duration?: string;
  notes?: string;
  avatar: {
    initials: string;
    color: string;
  };
  amount?: string;
  requestedDate: string;
  isExpired: boolean; // True if booking date/time is in the past
}

// Helper to format time ago
const formatTimeAgo = (timestamp: Date | any): string => {
  if (!timestamp) return "Just now";
  
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
};

// Helper to format date display
const formatDateDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Color palette for avatars (muted gray theme to match app design)
const avatarColors = [
  'bg-gray-600',
  'bg-gray-700',
  'bg-gray-800',
  'bg-slate-600',
  'bg-slate-700',
  'bg-zinc-600',
  'bg-zinc-700',
  'bg-neutral-600',
  'bg-neutral-700',
  'bg-stone-600',
  'bg-stone-700',
];

// Helper: Generate initials from name
const getInitials = (name: string): string => {
  if (!name || name.trim().length === 0) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    // Single word: return first letter
    return parts[0].charAt(0).toUpperCase();
  } else {
    // Multiple words: return first letter of first and last word
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
};

// Helper: Generate consistent color from name
const getAvatarColor = (name: string): string => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

// Helper: Generate avatar data (initials + color)
const generateAvatar = (name: string): { initials: string; color: string } => {
  return {
    initials: getInitials(name),
    color: getAvatarColor(name),
  };
};

// Helper: Check if a booking is expired (date/time in the past)
const isBookingExpired = (date: string, time: string): boolean => {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  if (date < today) return true;
  if (date === today && time < currentTime) return true;
  return false;
};

// Transform Firebase booking to display format
const transformBooking = (booking: PendingBooking): RequestDisplay => {
  const isExpired = isBookingExpired(booking.date, booking.time || '');
  
  return {
    id: booking.id,
    client: booking.clientName || booking.client || "Unknown",
    email: booking.email,
    phone: booking.phone || "",
    service: booking.service || "Service",
    date: formatDateDisplay(booking.date),
    rawDate: booking.date,
    time: booking.time || "",
    duration: booking.duration,
    notes: booking.notes,
    avatar: generateAvatar(booking.clientName || booking.client || "Unknown"),
    amount: booking.amount,
    requestedDate: formatTimeAgo(booking.createdAt),
    isExpired
  };
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track processing with action type: "approve:id" or "decline:id"
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const { t, language } = useTranslation();

  // Format time ago with translations
  const formatTimeAgoTranslated = useCallback((timestamp: Date | any): string => {
    if (!timestamp) return t('requests.justNow');
    
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return t('requests.justNow');
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return t('requests.timeAgo.minutes').replace('{count}', String(minutes));
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return t('requests.timeAgo.hours').replace('{count}', String(hours));
    }
    const days = Math.floor(diffInSeconds / 86400);
    return t('requests.timeAgo.days').replace('{count}', String(days));
  }, [t]);

  // Format date display with translations
  const formatDateDisplayTranslated = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return t('common.today');
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return t('common.tomorrow');
    }
    
    const locale = language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-EG' : 'en-US';
    return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  }, [t, language]);

  // Transform booking with translated dates
  const transformBookingWithTranslation = useCallback((booking: PendingBooking): RequestDisplay => {
    const isExpired = isBookingExpired(booking.date, booking.time || '');
    
    return {
      id: booking.id,
      client: booking.clientName || booking.client || "Unknown",
      email: booking.email,
      phone: booking.phone || "",
      service: booking.service || "Service",
      date: formatDateDisplayTranslated(booking.date),
      rawDate: booking.date,
      time: booking.time || "",
      duration: booking.duration,
      notes: booking.notes,
      avatar: generateAvatar(booking.clientName || booking.client || "Unknown"),
      amount: booking.amount,
      requestedDate: formatTimeAgoTranslated(booking.createdAt),
      isExpired
    };
  }, [formatDateDisplayTranslated, formatTimeAgoTranslated]);

  // Subscribe to real-time pending bookings
  useEffect(() => {
    const unsubscribe = subscribeToPendingBookings((bookings) => {
      const transformed = bookings.map(transformBookingWithTranslation);
      setRequests(transformed);
      setLoading(false);
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, [transformBookingWithTranslation]);

  // Helper to check if any action is processing for a request
  const isProcessing = (id: string) => processing.has(`approve:${id}`) || processing.has(`decline:${id}`);

  const handleApprove = async (id: string) => {
    const key = `approve:${id}`;
    if (processing.has(key)) return;
    
    setProcessing(prev => new Set(prev).add(key));
    try {
      await approvePendingBooking(id);
      // The real-time listener will automatically update the list
    } catch (err: any) {
      console.error("Error approving booking:", err);
      setError(err.message || "Failed to approve booking");
      // Remove from processing set after a delay
      setTimeout(() => {
        setProcessing(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 2000);
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleDecline = async (id: string) => {
    const key = `decline:${id}`;
    if (processing.has(key)) return;
    
    setProcessing(prev => new Set(prev).add(key));
    try {
      await rejectPendingBooking(id);
      // The real-time listener will automatically update the list
    } catch (err: any) {
      console.error("Error declining booking:", err);
      setError(err.message || "Failed to decline booking");
      // Remove from processing set after a delay
      setTimeout(() => {
        setProcessing(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 2000);
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold theme-text-primary">{t('requests.title')}</h1>
          <p className="text-sm theme-text-secondary mt-1">{t('requests.subtitle')}</p>
        </div>
        <div className="theme-bg-secondary border theme-border rounded-xl p-12 lg:p-16 text-center">
          <Loader2 className="w-8 h-8 theme-text-tertiary animate-spin mx-auto mb-4" />
          <p className="text-sm theme-text-secondary">{t('requests.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - hidden on mobile */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold theme-text-primary">{t('requests.title')}</h1>
        <p className="text-sm theme-text-secondary mt-1">{t('requests.subtitle')}</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats - hidden on mobile */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="theme-bg-secondary border theme-border rounded-xl p-6">
          <p className="text-sm font-medium text-gray-600">{t('requests.stats.pending')}</p>
          <p className="text-2xl font-semibold theme-text-primary mt-2">{requests.length}</p>
        </div>
        <div className="theme-bg-secondary border theme-border rounded-xl p-6">
          <p className="text-sm font-medium text-gray-600">{t('requests.stats.approvedToday')}</p>
          <p className="text-2xl font-semibold theme-text-primary mt-2">28</p>
        </div>
        <div className="theme-bg-secondary border theme-border rounded-xl p-6">
          <p className="text-sm font-medium text-gray-600">{t('requests.stats.approvalRate')}</p>
          <p className="text-2xl font-semibold theme-text-primary mt-2">92%</p>
        </div>
      </div>

      {/* Requests list */}
      <AnimatePresence mode="popLayout">
        {requests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="theme-bg-secondary border theme-border rounded-xl p-12 lg:p-16 text-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="w-20 h-20 theme-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Check className="w-10 h-10 theme-text-primary" strokeWidth={2.5} />
            </motion.div>
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold theme-text-primary mb-2"
            >
              {t('requests.empty.title')}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-base theme-text-secondary max-w-md mx-auto"
            >
              {t('requests.empty.message')}
            </motion.p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {requests.map((request, index) => (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                className={`theme-bg-secondary border theme-border rounded-2xl overflow-hidden ${
                  request.isExpired ? 'opacity-50' : ''
                }`}
              >
                <div className="p-4">
                  {/* Header row: Client + Amount + Expired badge */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${request.avatar.color} text-white text-sm font-semibold`}
                    >
                      {request.avatar.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold theme-text-primary truncate">{request.client}</h3>
                        {request.isExpired && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded uppercase">
                            {t('requests.expired')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs theme-text-secondary flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {request.phone}
                      </p>
                    </div>
                    {request.amount && (
                      <span className="text-sm font-bold theme-text-primary">{request.amount}</span>
                    )}
                  </div>

                  {/* Booking details - compact */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    <p className="text-sm font-medium theme-text-primary mb-2">{request.service}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{request.date}</span>
                      <span className="text-gray-300">·</span>
                      <span>{request.time}</span>
                      {request.duration && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="theme-text-secondary">{request.duration} mins</span>
                        </>
                      )}
                    </div>
                    {request.notes && (
                      <p className="mt-2 pt-2 border-t theme-border text-xs text-gray-600 italic">
                        "{request.notes}"
                      </p>
                    )}
                  </div>

                  {/* Meta: Requested time */}
                  <div className="flex items-center gap-1.5 text-[11px] theme-text-tertiary mb-3">
                    <Clock className="w-3 h-3" />
                    {request.requestedDate}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={isProcessing(request.id) || request.isExpired}
                      className={`flex-[2] inline-flex items-center justify-center gap-2 h-12 text-sm font-semibold rounded-xl active:scale-[0.98] transition-all disabled:cursor-not-allowed ${
                        request.isExpired
                          ? 'theme-bg-tertiary theme-text-tertiary cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50'
                      }`}
                    >
                      {processing.has(`approve:${request.id}`) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-5 h-5" strokeWidth={2.5} />
                      )}
                      {request.isExpired ? t('requests.expired') : t('requests.approve')}
                    </button>
                    <button
                      onClick={() => handleDecline(request.id)}
                      disabled={isProcessing(request.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 h-12 theme-bg-secondary border theme-border text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing.has(`decline:${request.id}`) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" strokeWidth={2.5} />
                      )}
                      {t('requests.decline')}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
