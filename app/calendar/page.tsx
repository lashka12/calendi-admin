"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Clock, Calendar as CalendarIcon, X, Phone, User, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/app/i18n";
import { 
  subscribeToSessions, 
  getSessionsForDate, 
  cancelSession,
  createSession,
  calculateEndTime,
  type Session 
} from "../lib/firebase/sessions";
import { 
  subscribeToPendingBookings,
  type PendingBooking 
} from "../lib/firebase/requests";
import { 
  subscribeToServices,
  getServiceName,
  type Service as FirebaseService
} from "../lib/firebase/services";
import { getAvailableTimeSlots } from "../lib/firebase/availability";
import { db } from "../lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "../lib/hooks/useToast";
import ConfirmationModal from "../components/ConfirmationModal";
import TimelineCalendar from "../components/TimelineCalendar";
import { useSettings } from "../context/SettingsContext";
import Portal from "../components/Portal";

interface Appointment {
  id: string;
  time: string;
  endTime: string;
  client: string;
  service: string;
  status: string; // 'confirmed' | 'pending'
  avatar: {
    initials: string;
    color: string;
  };
  phone?: string;
  email?: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  duration?: number;
  isPending?: boolean; // true if from pendingBookings
  isPast?: boolean; // true if session has already passed
  timeStatus?: 'past' | 'now' | 'soon' | 'upcoming'; // time-based status
}

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

// Format date to YYYY-MM-DD
const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Get calendar days for a month
const getCalendarDays = (year: number, month: number): { date: Date; isCurrentMonth: boolean; dateString: string }[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay(); // 0-6, Sunday = 0
  const days: { date: Date; isCurrentMonth: boolean; dateString: string }[] = [];
  
  // Add days from previous month to fill the first week
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({ date, isCurrentMonth: false, dateString: formatDateString(date) });
  }
  
  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    days.push({ date, isCurrentMonth: true, dateString: formatDateString(date) });
  }
  
  // Add days from next month to complete the grid (6 rows × 7 days = 42)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i);
    days.push({ date, isCurrentMonth: false, dateString: formatDateString(date) });
  }
  
  return days;
};

// Month names for display
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Short day names
const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Helper: Check if a session is past, now, soon, or upcoming
const getTimeStatus = (date: string, time: string, endTime?: string): 'past' | 'now' | 'soon' | 'upcoming' => {
  const today = formatDateString(new Date());
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // Past: date is before today, or date is today but time has passed
  if (date < today) {
    return 'past';
  }
  
  if (date === today) {
    // Check if session is currently happening (now)
    if (endTime && time <= currentTime && currentTime < endTime) {
      return 'now';
    }
    
    // Check if session is soon (within next 2 hours)
    const [timeHours, timeMinutes] = time.split(':').map(Number);
    const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
    const timeInMinutes = timeHours * 60 + timeMinutes;
    const currentInMinutes = currentHours * 60 + currentMinutes;
    const diffInMinutes = timeInMinutes - currentInMinutes;
    
    if (time < currentTime) {
      return 'past';
    } else if (diffInMinutes <= 120 && diffInMinutes > 0) {
      return 'soon';
    } else if (diffInMinutes > 0) {
      return 'upcoming';
    }
  }
  
  // Future date
  if (date > today) {
    return 'upcoming';
  }
  
  return 'past';
};

// Transform Firebase session to display format
const transformSession = (session: Session): Appointment => {
  const time = session.time || "";
  const endTime = calculateEndTime(time || "00:00", session.duration);
  const timeStatus = getTimeStatus(session.date, time, endTime);
  
  return {
    id: session.id,
    client: session.clientName || "Unknown",
    email: session.email,
    phone: session.phone || "",
    service: session.service || "Service",
    date: session.date,
    time,
    endTime,
    status: session.status === "approved" ? "confirmed" : session.status,
    avatar: generateAvatar(session.clientName || "Unknown"),
    notes: session.notes,
    duration: session.duration,
    isPending: false,
    isPast: timeStatus === 'past',
    timeStatus,
  };
};

// Transform Firebase pending booking to display format
const transformPendingBooking = (booking: PendingBooking): Appointment => {
  // Handle duration - could be string (e.g., "60 min") or number
  let durationMinutes = 60; // default
  if (booking.duration) {
    if (typeof booking.duration === 'string') {
      // Extract numbers from string like "60 min" or "1h 30m"
      const numbers = booking.duration.replace(/\D/g, '');
      durationMinutes = numbers ? parseInt(numbers) : 60;
    } else if (typeof booking.duration === 'number') {
      durationMinutes = booking.duration;
    }
  }
  
  const time = booking.time || "";
  const endTime = calculateEndTime(time || "00:00", durationMinutes);
  const timeStatus = getTimeStatus(booking.date, time, endTime);
  
  return {
    id: booking.id,
    client: booking.clientName || "Unknown",
    email: booking.email,
    phone: booking.phone || "",
    service: booking.service || "Service",
    date: booking.date,
    time,
    endTime,
    status: "pending",
    avatar: generateAvatar(booking.clientName || "Unknown"),
    notes: booking.notes,
    duration: durationMinutes,
    isPending: true,
    isPast: timeStatus === 'past',
    timeStatus,
  };
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDateString(new Date()));
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editedAppointment, setEditedAppointment] = useState<Appointment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [services, setServices] = useState<FirebaseService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);
  const [sessionFormData, setSessionFormData] = useState({
    clientName: "",
    phone: "",
    service: "",
    date: formatDateString(new Date()),
    time: "",
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [editAvailableSlots, setEditAvailableSlots] = useState<string[]>([]);
  const [loadingEditSlots, setLoadingEditSlots] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  
  // Custom picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditServicePicker, setShowEditServicePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [editDatePickerMonth, setEditDatePickerMonth] = useState(new Date());
  
  
  const { showToast } = useToast();
  const { t, language, isRTL } = useTranslation();
  const { settings } = useSettings();

  // Phone validation constants
  const PHONE_LENGTH = 10;

  // Phone validation helper - Israeli mobile format: 05xxxxxxxx
  const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (!phone.trim()) {
      return { isValid: false, error: t('calendar.validation.phoneRequired') };
    }
    // Must start with 05
    if (!digitsOnly.startsWith('05')) {
      return { isValid: false, error: t('calendar.validation.phonePrefix') };
    }
    // Must be exactly 10 digits
    if (digitsOnly.length !== PHONE_LENGTH) {
      return { isValid: false, error: t('calendar.validation.phoneLength') };
    }
    return { isValid: true };
  };

  // Format phone input (allow only digits, limit to 10 digits)
  const formatPhoneInput = (value: string): string => {
    // Keep only digits
    const digitsOnly = value.replace(/\D/g, '');
    // Limit to 10 digits
    return digitsOnly.slice(0, PHONE_LENGTH);
  };

  // Get phone validation state
  const phoneValidation = validatePhone(sessionFormData.phone);
  const showPhoneError = sessionFormData.phone.length > 0 && !phoneValidation.isValid;

  // Lock body scroll and touch when any modal is open (prevents scroll-behind on iOS)
  useEffect(() => {
    const anyModalOpen = isModalOpen || addSessionModalOpen || showDatePicker || showServicePicker || showEditDatePicker || showEditServicePicker;
    
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isModalOpen, addSessionModalOpen, showDatePicker, showServicePicker, showEditDatePicker, showEditServicePicker]);

  // Subscribe to real-time sessions (fetch all, filter client-side)
  useEffect(() => {
    const unsubscribeSessions = subscribeToSessions(
      (sessionsData) => {
        setSessions(sessionsData);
        setLoading(false);
        setError(null);
      },
      {
        status: 'approved'
      }
    );

    return () => {
      unsubscribeSessions();
    };
  }, []);

  // Subscribe to real-time pending bookings
  useEffect(() => {
    const unsubscribePending = subscribeToPendingBookings((bookings) => {
      setPendingBookings(bookings);
    });

    return () => {
      unsubscribePending();
    };
  }, []);

  // Subscribe to services for dropdown
  useEffect(() => {
    const unsubscribeServices = subscribeToServices((servicesData) => {
      setServices(servicesData.filter(s => s.active !== false));
    });

    return () => {
      unsubscribeServices();
    };
  }, []);


  // Get appointments for selected date (combine sessions and pending bookings)
  const appointments = useMemo(() => {
    const daySessions = getSessionsForDate(sessions, selectedDate);
    const dayPending = pendingBookings.filter(b => b.date === selectedDate);
    
    const confirmed = daySessions.map(transformSession);
    const pending = dayPending.map(transformPendingBooking);
    
    // Combine and sort by time
    return [...confirmed, ...pending].sort((a, b) => a.time.localeCompare(b.time));
  }, [sessions, pendingBookings, selectedDate]);

  // Get ALL appointments for week view
  const allAppointments = useMemo(() => {
    const confirmed = sessions.map(transformSession);
    const pending = pendingBookings.map(transformPendingBooking);
    return [...confirmed, ...pending].sort((a, b) => {
      // Sort by date first, then by time
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  }, [sessions, pendingBookings]);

  // Calculate stats
  const stats = useMemo(() => {
    const today = formatDateString(new Date());
    const todaySessions = getSessionsForDate(sessions, today);
    const todayPending = pendingBookings.filter(b => b.date === today);
    
    // Calculate week range
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekStartStr = formatDateString(weekStart);
    const weekEndStr = formatDateString(weekEnd);
    
    const thisWeekSessions = sessions.filter(s => 
      s.date >= weekStartStr && s.date <= weekEndStr
    );
    const thisWeekPending = pendingBookings.filter(b => 
      b.date >= weekStartStr && b.date <= weekEndStr
    );

    return {
      today: todaySessions.length + todayPending.length,
      thisWeek: thisWeekSessions.length + thisWeekPending.length,
      pending: pendingBookings.length,
    };
  }, [sessions, pendingBookings]);

  // Fetch available slots for edit modal (excludes the session being edited)
  const fetchEditAvailableSlots = async (date: string, serviceName: string, sessionId?: string) => {
    if (!date) return;
    
    setLoadingEditSlots(true);
    try {
      const selectedService = services.find(s => getServiceName(s) === serviceName);
      const serviceId = selectedService?.id;
      
      // Pass sessionId to exclude from booked times calculation
      const slots = await getAvailableTimeSlots(date, serviceId, sessionId);
      setEditAvailableSlots(slots);
    } catch (err: any) {
      console.error("Error fetching available slots for edit:", err);
      setEditAvailableSlots([]);
    } finally {
      setLoadingEditSlots(false);
    }
  };

  const openAppointmentModal = async (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setEditedAppointment({ ...appointment });
    setModalOpen(true);
    // Fetch available slots for the appointment's date and service (exclude this session)
    if (appointment.date && appointment.service) {
      await fetchEditAvailableSlots(appointment.date, appointment.service, appointment.id);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedAppointment(null);
    setEditedAppointment(null);
    setEditAvailableSlots([]);
  };

  const updateEditedField = (field: keyof Appointment, value: string) => {
    setEditedAppointment(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSaveAppointment = async () => {
    if (!editedAppointment || !selectedAppointment) return;

    // Check if anything changed
    const hasChanges = 
      editedAppointment.date !== selectedAppointment.date ||
      editedAppointment.time !== selectedAppointment.time ||
      editedAppointment.service !== selectedAppointment.service;

    if (!hasChanges) {
      closeModal();
      return;
    }

    if (processing.has(selectedAppointment.id)) return;

    setProcessing(prev => new Set(prev).add(selectedAppointment.id));
    setError(null);

    try {
      // Find service to get duration
      const selectedService = services.find(s => getServiceName(s) === editedAppointment.service);
      const serviceDuration = selectedService?.duration || editedAppointment.duration || 60;
      const endTime = calculateEndTime(editedAppointment.time, serviceDuration);

      // Update session in Firestore
      const sessionRef = doc(db, 'sessions', selectedAppointment.id);
      await updateDoc(sessionRef, {
        date: editedAppointment.date,
        time: editedAppointment.time,
        endTime: endTime,
        duration: serviceDuration,
        service: editedAppointment.service,
      });

      showToast(t('calendar.toast.sessionUpdated'), "success");
      closeModal();
    } catch (err: any) {
      console.error("Error updating session:", err);
      const errorMessage = err.message || "Failed to update session";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(selectedAppointment.id);
        return next;
      });
    }
  };

  const handleDeleteAppointment = () => {
    if (!selectedAppointment) return;
    setAppointmentToDelete(selectedAppointment);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAppointment = async () => {
    if (!appointmentToDelete) return;

    if (processing.has(appointmentToDelete.id)) return;

    setProcessing(prev => new Set(prev).add(appointmentToDelete.id));
    setError(null);

    try {
      await cancelSession(appointmentToDelete.id);
      showToast(t('calendar.toast.sessionCancelled').replace('{name}', appointmentToDelete.client), "success");
      // Close both modals
      setShowDeleteConfirm(false);
      setAppointmentToDelete(null);
      closeModal();
    } catch (err: any) {
      console.error("Error cancelling appointment:", err);
      const errorMessage = err.message || "Failed to cancel appointment";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(appointmentToDelete.id);
        return next;
      });
    }
  };

  const handleDateSelect = (dateStr: string, updateWeekView: boolean = false) => {
    setSelectedDate(dateStr);
    // Update currentDate to show the week containing the selected date
    if (updateWeekView) {
      const selectedDateObj = new Date(dateStr + 'T00:00:00');
      setCurrentDate(selectedDateObj);
    }
    // Update form date if modal is open
    if (addSessionModalOpen) {
      setSessionFormData(prev => ({ ...prev, date: dateStr }));
    }
  };

  // Fetch available slots when date or service changes
  const fetchAvailableSlots = async (date: string, serviceName: string) => {
    if (!date) return;
    
    setLoadingSlots(true);
    try {
      // Find service ID from service name
      const selectedService = services.find(s => getServiceName(s) === serviceName);
      const serviceId = selectedService?.id;
      
      const slots = await getAvailableTimeSlots(date, serviceId);
      setAvailableSlots(slots);
    } catch (err: any) {
      console.error("Error fetching available slots:", err);
      setAvailableSlots([]);
      showToast(t('calendar.toast.failedLoadSlots'), "error");
    } finally {
      setLoadingSlots(false);
    }
  };

  const openAddSessionModal = () => {
    setSessionFormData({
      clientName: "",
      phone: "",
      service: "",
      date: selectedDate,
      time: "",
    });
    setAvailableSlots([]);
    setError(null);
    setAddSessionModalOpen(true);
  };

  const closeAddSessionModal = () => {
    setAddSessionModalOpen(false);
    setSessionFormData({
      clientName: "",
      phone: "",
      service: "",
      date: formatDateString(new Date()),
      time: "",
    });
    setAvailableSlots([]);
    setError(null);
  };

  // Auto-fetch available slots when both date and service are selected
  useEffect(() => {
    if (addSessionModalOpen && sessionFormData.date && sessionFormData.service) {
      fetchAvailableSlots(sessionFormData.date, sessionFormData.service);
    } else if (addSessionModalOpen) {
      setAvailableSlots([]);
    }
  }, [sessionFormData.date, sessionFormData.service, addSessionModalOpen]);

  const handleCreateSession = async () => {
    if (!sessionFormData.clientName || !sessionFormData.phone || !sessionFormData.service || !sessionFormData.date || !sessionFormData.time) {
      setError(t('calendar.validation.fillAllFields'));
      return;
    }

    // Validate phone number
    const phoneCheck = validatePhone(sessionFormData.phone);
    if (!phoneCheck.isValid) {
      setError(phoneCheck.error || t('calendar.validation.invalidPhone'));
      return;
    }

    if (processing.has('new-session')) return;

    setProcessing(prev => new Set(prev).add('new-session'));
    setError(null);

    try {
      // Find the selected service to get its duration (matching old app behavior)
      const selectedService = services.find(s => getServiceName(s) === sessionFormData.service);
      const serviceDuration = selectedService?.duration || 60; // Default to 60 if not found
      const endTime = calculateEndTime(sessionFormData.time, serviceDuration);

      await createSession({
        clientName: sessionFormData.clientName,
        phone: sessionFormData.phone,
        service: sessionFormData.service,
        date: sessionFormData.date,
        time: sessionFormData.time,
        duration: serviceDuration,
        endTime: endTime,
      });

      showToast(t('calendar.toast.sessionCreated').replace('{name}', sessionFormData.clientName), "success");
      closeAddSessionModal();
      
      // Update selected date to the new session date
      setSelectedDate(sessionFormData.date);
    } catch (err: any) {
      console.error("Error creating session:", err);
      const errorMessage = err.message || "Failed to create session";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete('new-session');
        return next;
      });
    }
  };

  return (
    <>
      {/* Calendar container - fixed height to prevent page scroll */}
      <div className="h-[calc(100dvh-52px-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] lg:h-[calc(100vh-100px)] overflow-hidden">
        {/* Timeline Calendar */}
        <TimelineCalendar
          selectedDate={selectedDate}
          appointments={appointments}
          allAppointments={allAppointments}
          onDateChange={(date) => handleDateSelect(date, true)}
          onAppointmentClick={(apt) => !apt.isPast && !apt.isPending && openAppointmentModal(apt)}
          slotDuration={settings.slotDuration}
          scrollLock={isModalOpen || addSessionModalOpen || showDatePicker || showServicePicker || showEditDatePicker || showEditServicePicker}
        />

        {/* Mobile Add Button - above nav (h-12 + safe area) */}
        <button
          onClick={openAddSessionModal}
          className="lg:hidden fixed right-4 z-30 w-12 h-12 bg-gray-900 text-white rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)' }}
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* ============================================ */}
      {/* PRO MODALS - Animated & Premium Design      */}
      {/* ============================================ */}

      {/* Add Session Modal */}
      <AnimatePresence mode="sync">
        {addSessionModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={closeAddSessionModal}
              onTouchMove={(e) => e.preventDefault()}
              className="fixed -top-20 -left-4 -right-4 -bottom-20 bg-black/60 z-[9999] touch-none overscroll-contain"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[10000]"
            >
              <div className="bg-[#faf9f7] rounded-t-[28px] shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
                {/* Handle */}
                <div className="flex justify-center pt-2.5 pb-1">
                  <div className="w-9 h-[5px] bg-gray-300 rounded-full" />
                </div>
                
                {/* Header */}
                <div className="px-5 pt-1 pb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">{t('calendar.newSession')}</h2>
                    <p className="text-[14px] text-gray-500 mt-0.5">{t('calendar.form.fillDetails')}</p>
                  </div>
                  <button 
                    onClick={closeAddSessionModal} 
                    className="w-8 h-8 flex items-center justify-center bg-gray-200/80 hover:bg-gray-300 rounded-full transition-colors mt-1"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-2 overscroll-contain">
                  {/* Error */}
                  {error && (
                    <div className="mb-3 p-3 bg-red-50 text-red-700 text-[13px] rounded-xl">
                      {error}
                    </div>
                  )}
                  
                  {/* Client Info */}
                  <div className="mb-3 bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('calendar.form.clientInfo')}</p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={sessionFormData.clientName}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, clientName: e.target.value })}
                        placeholder={t('calendar.form.clientName')}
                        className="w-full h-11 px-3.5 bg-gray-50 rounded-xl text-[15px] placeholder:text-gray-400 focus:outline-none focus:bg-gray-100"
                      />
                      <input
                        type="tel"
                        value={sessionFormData.phone}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, phone: formatPhoneInput(e.target.value) })}
                        placeholder={t('calendar.form.phonePlaceholder')}
                        maxLength={10}
                        className={`w-full h-11 px-3.5 rounded-xl text-[15px] placeholder:text-gray-400 focus:outline-none ${
                          showPhoneError ? 'bg-red-50' : 'bg-gray-50 focus:bg-gray-100'
                        }`}
                      />
                    </div>
                  </div>
                  
                  {/* Service */}
                  <div className="mb-3 bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('calendar.form.service')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {services.map((service) => {
                        const name = getServiceName(service);
                        const selected = sessionFormData.service === name;
                        return (
                          <button
                            key={service.id}
                            onClick={() => setSessionFormData({ ...sessionFormData, service: name, time: "" })}
                            className={`px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors text-left ${
                              selected 
                                ? 'bg-gray-900 text-white' 
                                : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                            }`}
                          >
                            <span className="block truncate">{name}</span>
                            {service.duration && <span className={`text-[11px] ${selected ? 'text-gray-400' : 'text-gray-500'}`}>{service.duration} min</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Date */}
                  <div className="mb-3 bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('calendar.form.date')}</p>
                    <button
                      onClick={() => {
                        setDatePickerMonth(sessionFormData.date ? new Date(sessionFormData.date) : new Date());
                        setShowDatePicker(true);
                      }}
                      className="w-full h-11 px-3.5 bg-gray-50 rounded-xl text-[15px] text-left flex items-center justify-between active:bg-gray-100 transition-colors"
                    >
                      <span className={sessionFormData.date ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                        {sessionFormData.date 
                          ? new Date(sessionFormData.date + 'T00:00:00').toLocaleDateString(language, { weekday: 'long', month: 'short', day: 'numeric' })
                          : t('calendar.form.selectDate')
                        }
                      </span>
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Time */}
                  {sessionFormData.date && sessionFormData.service && (
                    <div className="mb-3 bg-white rounded-2xl p-4 shadow-sm">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('calendar.form.availableSlots')}</p>
                      {loadingSlots ? (
                        <div className="grid grid-cols-4 gap-1.5">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-10 rounded-lg skeleton-shimmer" />
                          ))}
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-center py-4 text-[13px] text-gray-400">{t('calendar.noAvailableSlots')}</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-1.5">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => setSessionFormData({ ...sessionFormData, time: slot })}
                              className={`py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                                sessionFormData.time === slot 
                                  ? 'bg-gray-900 text-white' 
                                  : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Footer */}
                <div className="px-4 pt-4 pb-5 bg-white">
                  <button
                    onClick={handleCreateSession}
                    disabled={
                      !sessionFormData.clientName || 
                      !sessionFormData.phone || 
                      !phoneValidation.isValid ||
                      !sessionFormData.service || 
                      !sessionFormData.date || 
                      !sessionFormData.time ||
                      processing.has('new-session')
                    }
                    className="w-full h-11 bg-gray-900 text-white font-semibold text-[15px] rounded-xl disabled:bg-gray-200 disabled:text-gray-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {processing.has('new-session') ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      t('calendar.createSession')
                    )}
                  </button>
                  {/* Safe area */}
                  <div className="h-[env(safe-area-inset-bottom)]" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Session Date Picker */}
      <AnimatePresence mode="sync">
        {showDatePicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => setShowDatePicker(false)}
              onTouchMove={(e) => e.preventDefault()}
              className="fixed -top-20 -left-4 -right-4 -bottom-20 bg-black/60 z-[10001] touch-none overscroll-contain"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[10002]"
            >
              <div className="bg-white rounded-t-2xl shadow-2xl p-4">
                <div className="flex justify-center mb-2">
                  <div className="w-9 h-1 bg-gray-300 rounded-full" />
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-semibold text-gray-900">{t('calendar.form.selectDate')}</h3>
                  <button 
                    onClick={() => setShowDatePicker(false)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button 
                    onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1))} 
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-[14px] font-semibold text-gray-900">{monthNames[datePickerMonth.getMonth()]} {datePickerMonth.getFullYear()}</span>
                  <button 
                    onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1))} 
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                
                {/* Day Names */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {dayNames.map(day => (
                    <div key={day} className="text-center text-[10px] font-medium text-gray-400 uppercase">{day}</div>
                  ))}
                </div>
                
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays(datePickerMonth.getFullYear(), datePickerMonth.getMonth()).map((day, i) => {
                    const selected = day.dateString === sessionFormData.date;
                    const isToday = day.dateString === formatDateString(new Date());
                    const isPast = day.date < new Date(new Date().setHours(0,0,0,0));
                    return (
                      <button
                        key={i}
                        disabled={!day.isCurrentMonth || isPast}
                        onClick={() => {
                          setSessionFormData({ ...sessionFormData, date: day.dateString, time: '' });
                          setShowDatePicker(false);
                        }}
                        className={`aspect-square flex items-center justify-center rounded-lg text-[13px] font-medium transition-all ${
                          selected 
                            ? 'bg-gray-900 text-white' 
                            : !day.isCurrentMonth || isPast
                              ? 'text-gray-200' 
                              : isToday
                                ? 'bg-gray-100 text-gray-900 ring-1 ring-gray-400'
                                : 'text-gray-700 active:bg-gray-100'
                        }`}
                      >
                        {day.date.getDate()}
                      </button>
                    );
                  })}
                </div>
                <div className="h-[env(safe-area-inset-bottom)] mt-2" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Session Modal */}
      <AnimatePresence mode="sync">
        {isModalOpen && editedAppointment && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={closeModal}
              onTouchMove={(e) => e.preventDefault()}
              className="fixed -top-20 -left-4 -right-4 -bottom-20 bg-black/60 z-[9999] touch-none overscroll-contain"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[10000]"
            >
              <div className="bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>
                
                {/* Header */}
                <div className="px-5 pt-2 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-semibold text-[15px]">
                        {editedAppointment.client.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-[17px] font-semibold text-gray-900">{editedAppointment.client}</h2>
                        <p className="text-[13px] text-gray-500">{editedAppointment.service}</p>
                      </div>
                    </div>
                    <button 
                      onClick={closeModal} 
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  
                  {/* Quick Actions */}
                  {editedAppointment.phone && (
                    <div className="flex gap-2">
                      <a 
                        href={`tel:${editedAppointment.phone}`} 
                        className="flex-1 h-11 bg-gray-900 text-white text-[13px] font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all"
                      >
                        <Phone className="w-4 h-4" /> {t('common.call')}
                      </a>
                      <a 
                        href={`https://wa.me/${editedAppointment.phone?.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex-1 h-11 bg-green-500 text-white text-[13px] font-medium rounded-xl flex items-center justify-center gap-1.5 hover:bg-green-600 active:scale-[0.98] transition-all"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5 border-t border-gray-100 pt-5 overscroll-contain">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 bg-red-50 text-red-600 text-[13px] rounded-xl border border-red-100"
                    >
                      {error}
                    </motion.div>
                  )}
                  
                  {/* Date & Service Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[13px] font-medium text-gray-600 mb-2">{t('calendar.form.date')}</label>
                      <button
                        onClick={() => {
                          setEditDatePickerMonth(editedAppointment.date ? new Date(editedAppointment.date) : new Date());
                          setShowEditDatePicker(true);
                        }}
                        className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-left text-[14px] font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                      >
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {editedAppointment.date 
                          ? new Date(editedAppointment.date + 'T00:00:00').toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' })
                          : t('calendar.form.select')}
                      </button>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-gray-600 mb-2">{t('calendar.form.service')}</label>
                      <button
                        onClick={() => setShowEditServicePicker(true)}
                        className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-left text-[14px] font-medium text-gray-700 truncate hover:bg-gray-100 transition-colors"
                      >
                        {editedAppointment.service || t('calendar.form.select')}
                      </button>
                    </div>
                  </div>
                  
                  {/* Time Slots */}
                  {editedAppointment.date && editedAppointment.service && (
                    <div>
                      <label className="block text-[13px] font-medium text-gray-600 mb-2">{t('calendar.form.time')}</label>
                      {loadingEditSlots ? (
                        <div className="grid grid-cols-4 gap-2">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-11 rounded-xl skeleton-shimmer" />
                          ))}
                        </div>
                      ) : editAvailableSlots.length === 0 ? (
                        <p className="text-center py-6 text-[13px] text-gray-400">{t('calendar.noAvailableSlots')}</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {editAvailableSlots.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => updateEditedField('time', slot)}
                              className={`py-3 rounded-xl text-[13px] font-medium transition-colors ${
                                editedAppointment.time === slot 
                                  ? 'bg-gray-900 text-white' 
                                  : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Footer */}
                <div className="px-5 pt-4 pb-5 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAppointment}
                      disabled={processing.has(editedAppointment.id)}
                      className="w-[52px] h-[52px] bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all border border-red-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleSaveAppointment}
                      disabled={processing.has(editedAppointment.id) || !editedAppointment.date || !editedAppointment.service || !editedAppointment.time}
                      className="flex-1 h-[52px] bg-gray-900 text-white font-semibold text-[15px] rounded-2xl disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-gray-900/10 disabled:shadow-none"
                    >
                      {processing.has(editedAppointment.id) ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          {t('common.save')}
                        </>
                      )}
                    </button>
                  </div>
                  {/* Safe area */}
                  <div className="h-[env(safe-area-inset-bottom)]" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Date Picker */}
      <AnimatePresence mode="sync">
        {showEditDatePicker && editedAppointment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => setShowEditDatePicker(false)}
              onTouchMove={(e) => e.preventDefault()}
              className="fixed -top-20 -left-4 -right-4 -bottom-20 bg-black/60 z-[10000] touch-none overscroll-contain"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[10001]"
            >
              <div className="bg-white rounded-t-3xl shadow-2xl p-5">
                {/* Handle */}
                <div className="flex justify-center -mt-2 mb-3">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>
                
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[17px] font-semibold text-gray-900">{t('calendar.form.selectDate')}</h3>
                  <button 
                    onClick={() => setShowEditDatePicker(false)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4 px-2">
                  <button 
                    onClick={() => setEditDatePickerMonth(new Date(editDatePickerMonth.getFullYear(), editDatePickerMonth.getMonth() - 1))} 
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-[15px] font-semibold text-gray-900">{monthNames[editDatePickerMonth.getMonth()]} {editDatePickerMonth.getFullYear()}</span>
                  <button 
                    onClick={() => setEditDatePickerMonth(new Date(editDatePickerMonth.getFullYear(), editDatePickerMonth.getMonth() + 1))} 
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                
                {/* Day Names */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {dayNames.map(day => (
                    <div key={day} className="text-center text-[11px] font-medium text-gray-400 uppercase">{day}</div>
                  ))}
                </div>
                
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays(editDatePickerMonth.getFullYear(), editDatePickerMonth.getMonth()).map((day, i) => {
                    const selected = day.dateString === editedAppointment.date;
                    const isToday = day.dateString === formatDateString(new Date());
                    return (
                      <button
                        key={i}
                        disabled={!day.isCurrentMonth}
                        onClick={() => {
                          updateEditedField('date', day.dateString);
                          updateEditedField('time', '');
                          setEditAvailableSlots([]);
                          if (editedAppointment.service) fetchEditAvailableSlots(day.dateString, editedAppointment.service, selectedAppointment?.id);
                          setShowEditDatePicker(false);
                        }}
                        className={`aspect-square flex items-center justify-center rounded-xl text-[14px] font-medium transition-all ${
                          selected 
                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' 
                            : !day.isCurrentMonth 
                              ? 'text-gray-200' 
                              : isToday
                                ? 'bg-gray-100 text-gray-900 ring-2 ring-gray-900 ring-inset'
                                : 'text-gray-700 hover:bg-gray-100 active:scale-90'
                        }`}
                      >
                        {day.date.getDate()}
                      </button>
                    );
                  })}
                </div>
                <div className="h-[env(safe-area-inset-bottom)] mt-3" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Service Picker */}
      <AnimatePresence mode="sync">
        {showEditServicePicker && editedAppointment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => setShowEditServicePicker(false)}
              onTouchMove={(e) => e.preventDefault()}
              className="fixed -top-20 -left-4 -right-4 -bottom-20 bg-black/60 z-[10000] touch-none overscroll-contain"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[10001]"
            >
              <div className="bg-white rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>
                
                <div className="px-5 pt-2 pb-4 flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-gray-900">{t('calendar.form.selectService')}</h3>
                  <button 
                    onClick={() => setShowEditServicePicker(false)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2 border-t border-gray-100 pt-4 overscroll-contain">
                  {services.map((service) => {
                    const name = getServiceName(service);
                    const selected = editedAppointment.service === name;
                    return (
                      <button
                        key={service.id}
                        onClick={() => {
                          updateEditedField('service', name);
                          updateEditedField('time', '');
                          setEditAvailableSlots([]);
                          if (editedAppointment.date) fetchEditAvailableSlots(editedAppointment.date, name, selectedAppointment?.id);
                          setShowEditServicePicker(false);
                        }}
                        className={`w-full p-4 rounded-2xl text-left transition-colors flex items-center justify-between ${
                          selected 
                            ? 'bg-gray-900 text-white' 
                            : 'bg-gray-50 active:bg-gray-100'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-[15px]">{name}</p>
                          {service.duration && (
                            <p className={`text-[13px] mt-0.5 ${selected ? 'text-gray-400' : 'text-gray-500'}`}>
                              {service.duration} {t('calendar.minutes')}
                            </p>
                          )}
                        </div>
                        {selected && <Check className="w-5 h-5 text-white" />}
                      </button>
                    );
                  })}
                </div>
                <div className="h-[env(safe-area-inset-bottom)]" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setAppointmentToDelete(null); }}
        onConfirm={confirmDeleteAppointment}
        title={t('calendar.deleteSession')}
        message={t('calendar.deleteConfirmMessage').replace('{name}', appointmentToDelete?.client || '').replace('{date}', appointmentToDelete?.date || '').replace('{time}', appointmentToDelete?.time || '')}
        confirmText={t('calendar.deleteSession')}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={appointmentToDelete ? processing.has(appointmentToDelete.id) : false}
      />
    </>
  );
}
