"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar as CalendarIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const { showToast } = useToast();

  // Phone validation constants
  const PHONE_MIN_LENGTH = 9;
  const PHONE_MAX_LENGTH = 15;

  // Phone validation helper
  const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (!phone.trim()) {
      return { isValid: false, error: "Phone number is required" };
    }
    if (digitsOnly.length < PHONE_MIN_LENGTH) {
      return { isValid: false, error: `Phone must be at least ${PHONE_MIN_LENGTH} digits` };
    }
    if (digitsOnly.length > PHONE_MAX_LENGTH) {
      return { isValid: false, error: `Phone cannot exceed ${PHONE_MAX_LENGTH} digits` };
    }
    // Check if it starts with valid prefix (0 for local, + for international)
    if (!phone.startsWith('0') && !phone.startsWith('+')) {
      return { isValid: false, error: "Phone must start with 0 or +" };
    }
    return { isValid: true };
  };

  // Format phone input (allow only digits, +, -, spaces)
  const formatPhoneInput = (value: string): string => {
    // Remove any character that's not a digit, +, -, or space
    return value.replace(/[^\d+\-\s]/g, '').slice(0, PHONE_MAX_LENGTH + 5); // +5 for formatting chars
  };

  // Get phone validation state
  const phoneValidation = validatePhone(sessionFormData.phone);
  const showPhoneError = sessionFormData.phone.length > 0 && !phoneValidation.isValid;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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

  // Generate week view (7 days based on currentDate)
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = currentDate.getDay(); // 0-6
    const weekDaysList = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() - currentDay + i);
      const dateStr = formatDateString(date);
      const daySessions = getSessionsForDate(sessions, dateStr);
      const dayPending = pendingBookings.filter(b => b.date === dateStr);
      const totalAppointments = daySessions.length + dayPending.length;
      
      weekDaysList.push({
        date: date.getDate(),
        dateStr,
        day: days[i],
        month: date.getMonth(),
        year: date.getFullYear(),
        isToday: date.toDateString() === today.toDateString(),
        hasAppointments: totalAppointments > 0,
        appointmentCount: totalAppointments,
      });
    }
    return weekDaysList;
  }, [sessions, pendingBookings, currentDate]);

  // Check if displayed week is the current week
  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateString(today);
    return weekDays.some(day => day.dateStr === todayStr);
  }, [weekDays]);

  // Get appointments for selected date (combine sessions and pending bookings)
  const appointments = useMemo(() => {
    const daySessions = getSessionsForDate(sessions, selectedDate);
    const dayPending = pendingBookings.filter(b => b.date === selectedDate);
    
    const confirmed = daySessions.map(transformSession);
    const pending = dayPending.map(transformPendingBooking);
    
    // Combine and sort by time
    return [...confirmed, ...pending].sort((a, b) => a.time.localeCompare(b.time));
  }, [sessions, pendingBookings, selectedDate]);

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
    if (!editedAppointment) return;
    setEditedAppointment({ ...editedAppointment, [field]: value });
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

      showToast("Session updated successfully", "success");
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
      showToast(`Session for ${appointmentToDelete.client} has been cancelled`, "success");
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

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
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
      showToast("Failed to load available slots", "error");
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

  const handleCreateSession = async () => {
    if (!sessionFormData.clientName || !sessionFormData.phone || !sessionFormData.service || !sessionFormData.date || !sessionFormData.time) {
      setError("Please fill in all required fields");
      return;
    }

    // Validate phone number
    const phoneCheck = validatePhone(sessionFormData.phone);
    if (!phoneCheck.isValid) {
      setError(phoneCheck.error || "Invalid phone number");
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

      showToast(`Session created for ${sessionFormData.clientName}`, "success");
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

  const handleWeekNavigation = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
    // Update selected date to first day of new week
    const firstDayOfWeek = new Date(newDate);
    firstDayOfWeek.setDate(newDate.getDate() - newDate.getDay());
    setSelectedDate(formatDateString(firstDayOfWeek));
  };

  // Get selected date display name
  const selectedDateDisplay = useMemo(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    if (date.toDateString() === new Date().toDateString()) {
      return "Today's Schedule";
    }
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  }, [selectedDate]);

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Header - hidden on mobile */}
      <div className="hidden lg:flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </p>
        </div>
        <button 
          onClick={openAddSessionModal}
          className="flex-shrink-0 inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Session</span>
        </button>
      </div>

      {/* Compact Week Strip */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => handleWeekNavigation('prev')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-900">
            {weekDays.length > 0 && (
              <>
                {isCurrentWeek ? (
                  "This Week"
                ) : (
                  `${months[weekDays[0].month]} ${weekDays[0].date} - ${months[weekDays[6].month]} ${weekDays[6].date}`
                )}
              </>
            )}
          </span>
          <button 
            onClick={() => handleWeekNavigation('next')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Week days strip */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((day, index) => (
            <button
              key={index}
              onClick={() => handleDateSelect(day.dateStr)}
              className={`flex flex-col items-center gap-1 py-2 sm:py-3 rounded-3xl transition-all min-w-0 ${
                day.isToday
                  ? "bg-gray-900 text-white"
                  : selectedDate === day.dateStr
                  ? "bg-gray-100 text-gray-900"
                  : "hover:bg-gray-50 text-gray-600"
              }`}
            >
              <span className="text-[10px] sm:text-xs font-medium uppercase opacity-75">
                {day.day.slice(0, 3)}
              </span>
              <span className="text-base sm:text-lg font-semibold">{day.date}</span>
              {day.hasAppointments && (
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(day.appointmentCount, 2) }).map((_, i) => (
                    <span 
                      key={i}
                      className={`w-1 h-1 rounded-full ${
                        day.isToday ? "bg-white" : "bg-gray-900"
                      }`}
                    />
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected date's appointments */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <h2 className="text-base font-semibold text-gray-900 truncate">
                {selectedDateDisplay}
              </h2>
            </div>
            <span className="text-sm font-medium text-gray-500 flex-shrink-0">
              {appointments.length}
            </span>
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {loading ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-sm font-medium text-gray-900">Loading appointments...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm font-medium text-red-600">Error: {error}</p>
            </div>
          ) : (
            <>
              {/* Timeline view */}
              <div className="space-y-4">
                {appointments.map((appointment, index) => (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-2 sm:gap-3 md:gap-4"
                  >
                    {/* Time */}
                    <div className="flex-shrink-0 w-12 sm:w-14 pt-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-900">{appointment.time}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">{appointment.endTime}</p>
                    </div>

                    {/* Timeline dot and line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 ${
                        appointment.status === "confirmed"
                          ? "bg-emerald-500 border-emerald-500"
                          : appointment.isPending
                          ? "bg-amber-500 border-amber-500"
                          : "bg-white border-amber-500"
                      }`}></div>
                      {index < appointments.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 my-1"></div>
                      )}
                    </div>

                    {/* Appointment card */}
                    <div className="flex-1 pb-4 min-w-0">
                      <div 
                        onClick={() => !appointment.isPast && !appointment.isPending && openAppointmentModal(appointment)}
                        className={`border rounded-xl p-3 sm:p-4 transition-colors ${
                          appointment.isPast || appointment.isPending
                            ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                            : "border-gray-200 hover:bg-gray-50 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${appointment.avatar.color} text-white text-sm font-semibold ${
                              appointment.isPast ? "opacity-70" : ""
                            }`}
                            aria-label={appointment.client}
                          >
                            {appointment.avatar.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${
                              appointment.isPast ? "text-gray-500" : "text-gray-900"
                            }`}>
                              {appointment.client}
                            </p>
                            <p className={`text-xs sm:text-sm truncate ${
                              appointment.isPast ? "text-gray-400" : "text-gray-500"
                            }`}>
                              {appointment.service}
                            </p>
                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium mt-2 ${
                              appointment.status === "confirmed"
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : appointment.isPending
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                            } ${appointment.isPast ? "opacity-70" : ""}`}>
                              {appointment.isPending ? "Pending" : appointment.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Empty slots indicator */}
              {appointments.length === 0 && (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900">No appointments</p>
                  <p className="text-sm text-gray-500 mt-1">Your schedule is clear for this date</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Add Button */}
      <button
        onClick={openAddSessionModal}
        className="lg:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-all hover:scale-105 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1 truncate">Today</p>
          <p className="text-lg sm:text-xl font-semibold text-gray-900">{stats.today}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1 truncate">This Week</p>
          <p className="text-lg sm:text-xl font-semibold text-gray-900">{stats.thisWeek}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1 truncate">Pending</p>
          <p className="text-lg sm:text-xl font-semibold text-gray-900">{stats.pending}</p>
        </div>
      </div>

      {/* Edit Session Modal */}
      <AnimatePresence>
        {isModalOpen && editedAppointment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={closeModal}
              className="fixed top-0 left-0 right-0 bottom-0 m-0 bg-gray-900/50 z-[100] will-change-[opacity]"
            />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ 
                duration: 0.25,
                ease: [0.32, 0.72, 0, 1],
                opacity: { duration: 0.2 }
              }}
              style={{ willChange: 'transform, opacity' }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90%] md:max-w-lg lg:max-w-2xl z-[101] bg-white rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh]"
            >
              {/* Handle bar for mobile */}
              <div className="md:hidden flex justify-center p-3">
                <div className="w-16 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-900">Edit Session</h2>
                <button
                  onClick={closeModal}
                  className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {error && (
                  <div className="bg-red-50 border-l-2 border-red-500 rounded-lg p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={editedAppointment.client}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editedAppointment.phone || ""}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={editedAppointment.date}
                      min={formatDateString(new Date())}
                      onChange={(e) => {
                        updateEditedField('date', e.target.value);
                        updateEditedField('time', '');
                        setEditAvailableSlots([]);
                        if (editedAppointment.service) {
                          fetchEditAvailableSlots(e.target.value, editedAppointment.service, selectedAppointment?.id);
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-gray-800 focus:border-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service *
                    </label>
                    <select
                      value={editedAppointment.service}
                      onChange={(e) => {
                        updateEditedField('service', e.target.value);
                        updateEditedField('time', '');
                        setEditAvailableSlots([]);
                        if (editedAppointment.date) {
                          fetchEditAvailableSlots(editedAppointment.date, e.target.value, selectedAppointment?.id);
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-gray-800 focus:border-gray-800 appearance-none bg-white"
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service.id} value={getServiceName(service)}>
                          {getServiceName(service)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Available Time Slots */}
                  {editedAppointment.date && editedAppointment.service && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Available Time Slots *
                      </label>
                      {loadingEditSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <Clock className="w-5 h-5 text-gray-400 animate-spin mr-2" />
                          <span className="text-sm text-gray-500">Loading slots...</span>
                        </div>
                      ) : editAvailableSlots.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-500">
                          No available slots for this date
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-5 gap-2 max-h-56 overflow-y-auto">
                          {editAvailableSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => updateEditedField('time', slot)}
                              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                editedAppointment.time === slot
                                  ? "bg-gray-800 text-white"
                                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
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
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-5 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50">
                <button
                  onClick={handleDeleteAppointment}
                  disabled={processing.has(editedAppointment.id)}
                  className="px-4 py-2.5 text-red-600 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
                <button
                  onClick={handleSaveAppointment}
                  disabled={processing.has(editedAppointment.id)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing.has(editedAppointment.id) ? "Saving..." : "Save"}
                </button>
              </div>

              {/* Safe area padding for iPhone */}
              <div className="h-8 md:hidden flex-shrink-0"></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Session Modal */}
      <AnimatePresence>
        {addSessionModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={closeAddSessionModal}
              className="fixed top-0 left-0 right-0 bottom-0 m-0 bg-gray-900/50 z-[100] will-change-[opacity]"
            />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ 
                duration: 0.25,
                ease: [0.32, 0.72, 0, 1],
                opacity: { duration: 0.2 }
              }}
              style={{ willChange: 'transform, opacity' }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90%] md:max-w-lg lg:max-w-2xl z-[101] bg-white rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh]"
            >
              {/* Handle bar for mobile */}
              <div className="md:hidden flex justify-center p-3">
                <div className="w-16 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-900">New Session</h2>
                <button
                  onClick={closeAddSessionModal}
                  className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {error && (
                  <div className="bg-red-50 border-l-2 border-red-500 rounded-lg p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      value={sessionFormData.clientName}
                      onChange={(e) => setSessionFormData({ ...sessionFormData, clientName: e.target.value })}
                      placeholder="Enter client name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-gray-800 focus:border-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={sessionFormData.phone}
                      onChange={(e) => setSessionFormData({ ...sessionFormData, phone: formatPhoneInput(e.target.value) })}
                      placeholder="05X-XXXXXXX"
                      maxLength={20}
                      className={`w-full px-4 py-2.5 border rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 transition-colors ${
                        showPhoneError
                          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                          : "border-gray-200 focus:ring-gray-800 focus:border-gray-800"
                      }`}
                    />
                    {showPhoneError && (
                      <p className="mt-1.5 text-xs text-red-500">{phoneValidation.error}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={sessionFormData.date}
                      min={formatDateString(new Date())}
                      onChange={(e) => {
                        setSessionFormData({ ...sessionFormData, date: e.target.value, time: "" });
                        setAvailableSlots([]);
                        if (sessionFormData.service) {
                          fetchAvailableSlots(e.target.value, sessionFormData.service);
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-gray-800 focus:border-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service *
                    </label>
                    <select
                      value={sessionFormData.service}
                      onChange={(e) => {
                        setSessionFormData({ ...sessionFormData, service: e.target.value, time: "" });
                        setAvailableSlots([]);
                        if (sessionFormData.date) {
                          fetchAvailableSlots(sessionFormData.date, e.target.value);
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-gray-800 focus:border-gray-800 appearance-none bg-white"
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service.id} value={getServiceName(service)}>
                          {getServiceName(service)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Available Time Slots */}
                  {sessionFormData.date && sessionFormData.service && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Available Time Slots *
                      </label>
                      {loadingSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <Clock className="w-5 h-5 text-gray-400 animate-spin mr-2" />
                          <span className="text-sm text-gray-500">Loading slots...</span>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-500">
                          No available slots for this date
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-5 gap-2 max-h-56 overflow-y-auto">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSessionFormData({ ...sessionFormData, time: slot })}
                              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                sessionFormData.time === slot
                                  ? "bg-gray-800 text-white"
                                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
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
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-5 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50">
                <button
                  onClick={closeAddSessionModal}
                  className="px-4 py-2.5 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
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
                  className="flex-1 px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing.has('new-session') ? "Creating..." : "Create Session"}
                </button>
              </div>

              {/* Safe area padding for iPhone */}
              <div className="h-8 md:hidden flex-shrink-0"></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setAppointmentToDelete(null);
        }}
        onConfirm={confirmDeleteAppointment}
        title="Delete Session"
        message={`Are you sure you want to delete ${appointmentToDelete?.client}'s appointment on ${appointmentToDelete?.date} at ${appointmentToDelete?.time}? This action cannot be undone.`}
        confirmText="Delete Session"
        cancelText="Cancel"
        variant="danger"
        isLoading={appointmentToDelete ? processing.has(appointmentToDelete.id) : false}
      />
    </div>
  );
}
