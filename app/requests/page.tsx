"use client";

import { useState, useEffect } from "react";
import { Clock, Check, X, Phone, Mail, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

  // Subscribe to real-time pending bookings
  useEffect(() => {
    const unsubscribe = subscribeToPendingBookings((bookings) => {
      const transformed = bookings.map(transformBooking);
      setRequests(transformed);
      setLoading(false);
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
          <h1 className="text-2xl font-semibold text-gray-900">Booking Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Review and manage appointment requests</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-12 lg:p-16 text-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - hidden on mobile */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold text-gray-900">Booking Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Review and manage appointment requests</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats - hidden on mobile */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{requests.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm font-medium text-gray-600">Approved Today</p>
          <p className="text-2xl font-semibold text-gray-900 mt-2">28</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm font-medium text-gray-600">Approval Rate</p>
          <p className="text-2xl font-semibold text-gray-900 mt-2">92%</p>
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
            className="bg-white border border-gray-200 rounded-xl p-12 lg:p-16 text-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Check className="w-10 h-10 text-gray-900" strokeWidth={2.5} />
            </motion.div>
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-gray-900 mb-2"
            >
              All Caught Up!
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-base text-gray-500 max-w-md mx-auto"
            >
              You have no pending requests at the moment. New booking requests will appear here.
            </motion.p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {requests.map((request, index) => (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-white border border-gray-200 rounded-xl overflow-hidden relative ${
                  request.isExpired ? 'opacity-60' : ''
                }`}
              >
                {/* Expired corner ribbon */}
                {request.isExpired && (
                  <div className="absolute top-0 right-0 z-10">
                    <div className="bg-red-500 text-white text-[10px] lg:text-xs font-bold px-2 lg:px-3 py-0.5 lg:py-1 shadow-sm rounded-bl-lg uppercase tracking-wide">
                      Expired
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 px-4 py-2.5 lg:px-6 lg:py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-600">
                    <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    <span className="truncate">{request.requestedDate}</span>
                  </div>
                  {request.amount && (
                    <span className="text-sm lg:text-base font-semibold text-gray-900">{request.amount}</span>
                  )}
                </div>

                <div className="p-4 lg:p-6">
                  {/* Client info */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0 ${request.avatar.color} text-white text-base lg:text-lg font-semibold`}
                      aria-label={request.client}
                    >
                      {request.avatar.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-1 truncate">{request.client}</h3>
                      <div className="space-y-1">
                        {request.email && (
                          <p className="text-xs lg:text-sm text-gray-500 flex items-center gap-2 truncate">
                            <Mail className="w-3 h-3 lg:w-3.5 lg:h-3.5 flex-shrink-0" />
                            <span className="truncate">{request.email}</span>
                          </p>
                        )}
                        <p className="text-xs lg:text-sm text-gray-500 flex items-center gap-2">
                          <Phone className="w-3 h-3 lg:w-3.5 lg:h-3.5 flex-shrink-0" />
                          {request.phone}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Booking details */}
                  <div className="bg-gray-50 rounded-xl p-3 lg:p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Service</p>
                        <p className="text-sm font-medium text-gray-900">{request.service}</p>
                      </div>
                      {request.duration && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Duration</p>
                          <p className="text-sm font-medium text-gray-900">{request.duration}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Date</p>
                        <p className="text-sm font-medium text-gray-900">{request.date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Time</p>
                        <p className="text-sm font-medium text-gray-900">{request.time}</p>
                      </div>
                    </div>
                    {request.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-700">"{request.notes}"</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 lg:gap-3">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={isProcessing(request.id) || request.isExpired}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 text-sm font-semibold rounded-xl active:scale-95 transition-all shadow-sm disabled:cursor-not-allowed ${
                        request.isExpired
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50'
                      }`}
                    >
                      {processing.has(`approve:${request.id}`) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {request.isExpired ? 'Expired' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDecline(request.id)}
                      disabled={isProcessing(request.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-white border-2 border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing.has(`decline:${request.id}`) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Decline
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
