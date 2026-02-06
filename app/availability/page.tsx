"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, Plus, X, Check, ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp, Copy, RefreshCcw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../lib/hooks/useToast";
import { useTranslation } from "@/app/i18n";
import {
  getWeeklyTemplate,
  subscribeToWeeklyTemplate,
  getPlannedDates,
  subscribeToPlannedDates,
  getSpecialDays,
  subscribeToSpecialDays,
  setWeeklyTemplate,
  setPlannedDate,
  deletePlannedDate,
  setSpecialDay,
  deleteSpecialDay,
  checkBookingsForDate,
  checkBookingsForTimeRange,
  type TimeSlot,
  type WeeklyTemplate,
  type PlannedDate,
  type SpecialDay,
} from "../lib/firebase/availability";

interface CustomDate {
  date: string;
  slots: TimeSlot[];
}

export default function AvailabilityPage() {
  const { showToast } = useToast();
  const { t, isRTL, language } = useTranslation();
  
  // Get locale for date formatting
  const getLocale = () => {
    switch (language) {
      case 'he': return 'he-IL';
      case 'ar': return 'ar-EG';
      default: return 'en-US';
    }
  };
  
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"weekly" | "planning" | "specials">("weekly");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Calendar state for Planning tab
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Weekly schedule
  const [weekSchedule, setWeekSchedule] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });

  const [timeSlots, setTimeSlots] = useState<{ [key: string]: TimeSlot[] }>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });

  // Planning tab - custom dates (loaded from Firestore)
  const [customDates, setCustomDates] = useState<{ [key: string]: CustomDate }>({});
  // Track which dates are actually saved in database (for highlighting)
  const [savedPlannedDates, setSavedPlannedDates] = useState<Set<string>>(new Set());

  // Specials tab (loaded from Firestore)
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);

  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<SpecialDay | null>(null);
  const [specialForm, setSpecialForm] = useState({
    name: "",
    date: "",
    recurring: false,
    recurringPattern: "yearly",
    isClosed: true,
  });

  // Load data from Firestore on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load weekly template
        const template = await getWeeklyTemplate();
        if (template) {
          const slots: { [key: string]: TimeSlot[] } = {
            monday: template.monday || [],
            tuesday: template.tuesday || [],
            wednesday: template.wednesday || [],
            thursday: template.thursday || [],
            friday: template.friday || [],
            saturday: template.saturday || [],
            sunday: template.sunday || [],
          };
          setTimeSlots(slots);
          
          // Update weekSchedule based on which days have slots
          setWeekSchedule({
            monday: (template.monday?.length || 0) > 0,
            tuesday: (template.tuesday?.length || 0) > 0,
            wednesday: (template.wednesday?.length || 0) > 0,
            thursday: (template.thursday?.length || 0) > 0,
            friday: (template.friday?.length || 0) > 0,
            saturday: (template.saturday?.length || 0) > 0,
            sunday: (template.sunday?.length || 0) > 0,
          });
        }
        
        // Load planned dates
        const plannedDates = await getPlannedDates();
        const plannedDatesMap: { [key: string]: CustomDate } = {};
        const savedDatesSet = new Set<string>();
        plannedDates.forEach((pd) => {
          plannedDatesMap[pd.date] = {
            date: pd.date,
            slots: pd.slots,
          };
          savedDatesSet.add(pd.date);
        });
        setCustomDates(plannedDatesMap);
        setSavedPlannedDates(savedDatesSet);
        
        // Load special days
        const specials = await getSpecialDays();
        setSpecialDays(specials);
      } catch (error: any) {
        console.error('Error loading availability data:', error);
        showToast('Failed to load availability data', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [showToast]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeWeekly = subscribeToWeeklyTemplate((template) => {
      if (template) {
        const slots: { [key: string]: TimeSlot[] } = {
          monday: template.monday || [],
          tuesday: template.tuesday || [],
          wednesday: template.wednesday || [],
          thursday: template.thursday || [],
          friday: template.friday || [],
          saturday: template.saturday || [],
          sunday: template.sunday || [],
        };
        setTimeSlots(slots);
      }
    });

    const unsubscribePlanned = subscribeToPlannedDates((plannedDates) => {
      const plannedDatesMap: { [key: string]: CustomDate } = {};
      const savedDatesSet = new Set<string>();
      plannedDates.forEach((pd) => {
        plannedDatesMap[pd.date] = {
          date: pd.date,
          slots: pd.slots,
        };
        savedDatesSet.add(pd.date);
      });
      setCustomDates(plannedDatesMap);
      setSavedPlannedDates(savedDatesSet);
    });

    const unsubscribeSpecials = subscribeToSpecialDays((specials) => {
      setSpecialDays(specials);
    });

    return () => {
      unsubscribeWeekly();
      unsubscribePlanned();
      unsubscribeSpecials();
    };
  }, []);

  const daysOfWeek = useMemo(() => [
    { id: "monday", label: t('days.monday'), short: t('days.mon') },
    { id: "tuesday", label: t('days.tuesday'), short: t('days.tue') },
    { id: "wednesday", label: t('days.wednesday'), short: t('days.wed') },
    { id: "thursday", label: t('days.thursday'), short: t('days.thu') },
    { id: "friday", label: t('days.friday'), short: t('days.fri') },
    { id: "saturday", label: t('days.saturday'), short: t('days.sat') },
    { id: "sunday", label: t('days.sunday'), short: t('days.sun') },
  ], [t]);

  // Weekly tab functions
  const toggleDay = (dayId: string) => {
    setWeekSchedule((prev) => ({
      ...prev,
      [dayId]: !prev[dayId as keyof typeof prev],
    }));
  };

  const toggleExpandDay = (dayId: string) => {
    setExpandedDay(expandedDay === dayId ? null : dayId);
  };

  const addTimeSlot = (dayId: string) => {
    setTimeSlots((prev) => ({
      ...prev,
      [dayId]: [...(prev[dayId] || []), { start: "09:00", end: "17:00" }],
    }));
  };

  const removeTimeSlot = async (dayId: string, index: number) => {
    const slotToRemove = timeSlots[dayId][index];
    if (!slotToRemove) return;

    // Check for bookings in this time range for next 7 days
    try {
      const today = new Date();
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dayOfWeekIndex = checkDate.getDay();
        const checkDayName = dayNames[dayOfWeekIndex];
        
        if (checkDayName === dayId) {
          const dateStr = checkDate.toISOString().split("T")[0];
          const bookingCheck = await checkBookingsForTimeRange(
            dateStr,
            slotToRemove.start,
            slotToRemove.end
          );
          
          if (bookingCheck.hasBookings) {
            showToast(
              `Cannot remove time slot ${slotToRemove.start}-${slotToRemove.end} on ${dayId}. There are ${bookingCheck.count} existing booking(s). Please cancel or reschedule bookings first.`,
              "error"
            );
            return;
          }
        }
      }
      
      // Safe to remove
      setTimeSlots((prev) => ({
        ...prev,
        [dayId]: prev[dayId].filter((_, i) => i !== index),
      }));
    } catch (error: any) {
      console.error('Error checking bookings:', error);
      showToast(error.message || 'Failed to check bookings', 'error');
    }
  };

  const updateTimeSlot = (dayId: string, index: number, field: "start" | "end", value: string) => {
    setTimeSlots((prev) => ({
      ...prev,
      [dayId]: prev[dayId].map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const copyToAllDays = (sourceDayId: string) => {
    const sourceSlots = timeSlots[sourceDayId];
    const newTimeSlots = { ...timeSlots };
    Object.keys(weekSchedule).forEach((dayId) => {
      if (weekSchedule[dayId as keyof typeof weekSchedule]) {
        newTimeSlots[dayId] = [...sourceSlots];
      }
    });
    setTimeSlots(newTimeSlots);
  };

  // Planning tab functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const formatDateKey = (date: Date) => {
    // Use local date components to avoid timezone shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString(getLocale(), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const hasCustomSchedule = (date: Date) => {
    const key = formatDateKey(date);
    // Only highlight dates that are actually saved in the database
    return savedPlannedDates.has(key);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const selectDate = (date: Date) => {
    const key = formatDateKey(date);
    setSelectedDate(key);
    
    if (!customDates[key]) {
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const defaultSlots = timeSlots[dayOfWeek] || [];
      setCustomDates({
        ...customDates,
        [key]: {
          date: key,
          slots: [...defaultSlots],
        },
      });
    }
  };

  const addCustomSlot = () => {
    if (!selectedDate) return;
    setCustomDates({
      ...customDates,
      [selectedDate]: {
        ...customDates[selectedDate],
        slots: [...(customDates[selectedDate]?.slots || []), { start: "09:00", end: "17:00" }],
      },
    });
  };

  const removeCustomSlot = async (index: number) => {
    if (!selectedDate) return;
    const slotToRemove = customDates[selectedDate]?.slots[index];
    if (!slotToRemove) return;

    try {
      // Check for bookings in this time range
      const bookingCheck = await checkBookingsForTimeRange(
        selectedDate,
        slotToRemove.start,
        slotToRemove.end
      );
      
      if (bookingCheck.hasBookings) {
        showToast(
          `Cannot remove time slot ${slotToRemove.start}-${slotToRemove.end} on ${selectedDate}. There are ${bookingCheck.count} existing booking(s). Please cancel or reschedule bookings first.`,
          "error"
        );
        return;
      }
      
      // Safe to remove
      setCustomDates({
        ...customDates,
        [selectedDate]: {
          ...customDates[selectedDate],
          slots: customDates[selectedDate].slots.filter((_, i) => i !== index),
        },
      });
    } catch (error: any) {
      console.error('Error checking bookings:', error);
      showToast(error.message || 'Failed to check bookings', 'error');
    }
  };

  const updateCustomSlot = (index: number, field: "start" | "end", value: string) => {
    if (!selectedDate) return;
    setCustomDates({
      ...customDates,
      [selectedDate]: {
        ...customDates[selectedDate],
        slots: customDates[selectedDate].slots.map((slot, i) =>
          i === index ? { ...slot, [field]: value } : slot
        ),
      },
    });
  };

  const removeCustomDate = async () => {
    if (!selectedDate) return;

    try {
      // Check for bookings on this date
      const bookingCheck = await checkBookingsForDate(selectedDate);
      
      if (bookingCheck.hasBookings) {
        showToast(
          `Cannot delete planned date ${selectedDate}. There are ${bookingCheck.count} existing booking(s). Please cancel or reschedule bookings first.`,
          "error"
        );
        return;
      }
      
      // Safe to delete
      await deletePlannedDate(selectedDate);
      const newDates = { ...customDates };
      delete newDates[selectedDate];
      setCustomDates(newDates);
      // Remove from saved dates set
      setSavedPlannedDates(prev => {
        const next = new Set(prev);
        next.delete(selectedDate);
        return next;
      });
      setSelectedDate(null);
      showToast('Planned date deleted successfully', 'success');
    } catch (error: any) {
      console.error('Error deleting planned date:', error);
      showToast(error.message || 'Failed to delete planned date', 'error');
    }
  };

  // Specials tab functions
  const handleDeleteSpecialDay = async (id: string) => {
    try {
      await deleteSpecialDay(id);
      setSpecialDays(specialDays.filter(day => day.id !== id));
      showToast('Special day deleted successfully', 'success');
    } catch (error: any) {
      console.error('Error deleting special day:', error);
      showToast(error.message || 'Failed to delete special day', 'error');
    }
  };

  const openAddSpecialModal = () => {
    setEditingSpecial(null);
    setSpecialForm({
      name: "",
      date: "",
      recurring: false,
      recurringPattern: "yearly",
      isClosed: true,
    });
    setShowSpecialModal(true);
  };

  const openEditSpecialModal = (special: SpecialDay) => {
    setEditingSpecial(special);
    setSpecialForm({
      name: special.name,
      date: special.dates[0] || "",
      recurring: special.recurring,
      recurringPattern: special.recurringPattern?.includes("Yearly") ? "yearly" : special.recurringPattern?.includes("Monthly") ? "monthly" : "weekly",
      isClosed: special.isClosed,
    });
    setShowSpecialModal(true);
  };

  const handleSaveSpecial = async () => {
    if (!specialForm.name || !specialForm.date) return;

    try {
      // Check for bookings before blocking
      const bookingCheck = await checkBookingsForDate(specialForm.date);
      
      if (bookingCheck.hasBookings) {
        showToast(
          `Cannot block date ${specialForm.date}. There are ${bookingCheck.count} existing booking(s). Please cancel or reschedule bookings first.`,
          "error"
        );
        return;
      }

      const recurringPatternText = specialForm.recurring
        ? specialForm.recurringPattern === "yearly"
          ? `Yearly on ${new Date(specialForm.date).toLocaleDateString(getLocale(), { month: "long", day: "numeric" })}`
          : specialForm.recurringPattern === "monthly"
          ? `Monthly on day ${new Date(specialForm.date).getDate()}`
          : `Weekly on ${new Date(specialForm.date).toLocaleDateString(getLocale(), { weekday: "long" })}`
        : undefined;

      const specialDayData: any = {
        name: specialForm.name,
        dates: [specialForm.date],
        recurring: specialForm.recurring,
        recurringPattern: recurringPatternText,
      };
      
      if (editingSpecial?.id) {
        specialDayData.id = editingSpecial.id;
      }
      
      await setSpecialDay(specialDayData);

      showToast(
        `Special day ${editingSpecial ? 'updated' : 'created'} successfully`,
        'success'
      );
      setShowSpecialModal(false);
    } catch (error: any) {
      console.error('Error saving special day:', error);
      showToast(error.message || 'Failed to save special day', 'error');
    }
  };

  // Save handlers
  const handleSaveWeekly = async () => {
    try {
      setSaving(true);
      const template: WeeklyTemplate = {
        monday: weekSchedule.monday ? timeSlots.monday : [],
        tuesday: weekSchedule.tuesday ? timeSlots.tuesday : [],
        wednesday: weekSchedule.wednesday ? timeSlots.wednesday : [],
        thursday: weekSchedule.thursday ? timeSlots.thursday : [],
        friday: weekSchedule.friday ? timeSlots.friday : [],
        saturday: weekSchedule.saturday ? timeSlots.saturday : [],
        sunday: weekSchedule.sunday ? timeSlots.sunday : [],
      };
      
      // Validate that template has at least one day with slots
      const hasAnySlots = Object.values(template).some(
        (slots) => Array.isArray(slots) && slots.length > 0
      );
      
      if (!hasAnySlots) {
        showToast('Weekly template must have at least one day with time slots', 'error');
        setSaving(false);
        return;
      }
      
      await setWeeklyTemplate(template);
      showToast('Weekly template saved successfully', 'success');
    } catch (error: any) {
      console.error('Error saving weekly template:', error);
      showToast(error.message || 'Failed to save weekly template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlannedDate = async () => {
    if (!selectedDate) return;
    
    try {
      setSaving(true);
      const slots = customDates[selectedDate]?.slots || [];
      await setPlannedDate(selectedDate, slots);
      // Mark this date as saved in the database
      setSavedPlannedDates(prev => new Set(prev).add(selectedDate));
      showToast('Planned date saved successfully', 'success');
    } catch (error: any) {
      console.error('Error saving planned date:', error);
      showToast(error.message || 'Failed to save planned date', 'error');
    } finally {
      setSaving(false);
    }
  };

  const calendarDays = getDaysInMonth(currentMonth);
  // Parse date string in local time to avoid timezone shift
  const selectedDateObj = selectedDate ? (() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day);
  })() : null;
  const selectedDateData = selectedDate ? customDates[selectedDate] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold text-gray-900">{t('availability.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-2xl p-1 flex gap-1">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "weekly"
              ? "bg-gray-800 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {t('availability.tabs.weekly')}
        </button>
        <button
          onClick={() => setActiveTab("planning")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "planning"
              ? "bg-gray-800 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {t('availability.tabs.planning')}
          {Object.keys(customDates).length > 0 && (
            <span className="px-1.5 py-0.5 bg-white/20 text-xs rounded-full">
              {Object.keys(customDates).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("specials")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "specials"
              ? "bg-gray-800 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {t('availability.tabs.specials')}
          {specialDays.length > 0 && (
            <span className="px-1.5 py-0.5 bg-white/20 text-xs rounded-full">
              {specialDays.length}
            </span>
          )}
        </button>
      </div>

      {/* Weekly Tab */}
      {activeTab === "weekly" && (
        <WeeklyScheduleTab
          key="weekly"
          daysOfWeek={daysOfWeek}
          weekSchedule={weekSchedule}
          timeSlots={timeSlots}
          expandedDay={expandedDay}
          toggleDay={toggleDay}
          toggleExpandDay={toggleExpandDay}
          addTimeSlot={addTimeSlot}
          removeTimeSlot={removeTimeSlot}
          updateTimeSlot={updateTimeSlot}
          copyToAllDays={copyToAllDays}
          onSave={handleSaveWeekly}
          saving={saving}
          loading={loading}
          t={t}
          isRTL={isRTL}
        />
      )}

      {/* Planning Tab */}
      {activeTab === "planning" && (
        <PlanningTab
          key="planning"
          currentMonth={currentMonth}
          previousMonth={previousMonth}
          nextMonth={nextMonth}
          calendarDays={calendarDays}
          selectedDate={selectedDate}
          selectedDateObj={selectedDateObj}
          selectedDateData={selectedDateData}
          selectDate={selectDate}
          isToday={isToday}
          isPast={isPast}
          hasCustomSchedule={hasCustomSchedule}
          formatDateKey={formatDateKey}
          formatDateDisplay={formatDateDisplay}
          addCustomSlot={addCustomSlot}
          removeCustomSlot={removeCustomSlot}
          updateCustomSlot={updateCustomSlot}
          removeCustomDate={removeCustomDate}
          onSave={handleSavePlannedDate}
          saving={saving}
          loading={loading}
          t={t}
          isRTL={isRTL}
          language={language}
        />
      )}

      {/* Specials Tab */}
      {activeTab === "specials" && (
        <SpecialsTab
          key="specials"
          specialDays={specialDays}
          deleteSpecialDay={handleDeleteSpecialDay}
          openAddSpecialModal={openAddSpecialModal}
          openEditSpecialModal={openEditSpecialModal}
          loading={loading}
          t={t}
          isRTL={isRTL}
          language={language}
        />
      )}

      {/* Add/Edit Special Day Modal */}
      <AnimatePresence>
        {showSpecialModal && (
          <>
            {/* Backdrop - extends above safe area to cover status bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSpecialModal(false)}
              className="fixed left-0 right-0 bottom-0 bg-black/50 z-50"
              style={{ top: 'calc(-1 * env(safe-area-inset-top, 0px))' }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-x-0 bottom-0 lg:inset-0 lg:flex lg:items-center lg:justify-center z-50"
            >
              <div className="bg-white rounded-t-3xl lg:rounded-2xl max-w-lg w-full mx-auto lg:max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Handle bar (mobile) */}
                <div className="lg:hidden flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {editingSpecial ? t('availability.specials.editSpecialDay') : t('availability.specials.addSpecialDay')}
                    </h2>
                    <button
                      onClick={() => setShowSpecialModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Form */}
                <div className="px-6 py-6 space-y-5 overflow-y-auto max-h-[60vh] lg:max-h-[500px]">
                  {/* Event Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      {t('availability.specials.eventName')}
                    </label>
                    <input
                      type="text"
                      value={specialForm.name}
                      onChange={(e) => setSpecialForm({ ...specialForm, name: e.target.value })}
                      placeholder={t('availability.specials.eventNamePlaceholder')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      {t('availability.specials.date')}
                    </label>
                    <input
                      type="date"
                      value={specialForm.date}
                      onChange={(e) => setSpecialForm({ ...specialForm, date: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Recurring Toggle */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t('availability.specials.recurringEvent')}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t('availability.specials.recurringDesc')}</p>
                      </div>
                      <button
                        onClick={() => setSpecialForm({ ...specialForm, recurring: !specialForm.recurring })}
                        dir="ltr"
                        className={`toggle-switch relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                          specialForm.recurring ? "bg-gray-800" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                            specialForm.recurring ? 'translate-x-[22px]' : 'translate-x-[2px]'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Recurring Pattern */}
                    {specialForm.recurring && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          {t('availability.specials.repeatPattern')}
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSpecialForm({ ...specialForm, recurringPattern: "weekly" })}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                              specialForm.recurringPattern === "weekly"
                                ? "bg-gray-800 text-white"
                                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {t('availability.specials.weekly')}
                          </button>
                          <button
                            onClick={() => setSpecialForm({ ...specialForm, recurringPattern: "monthly" })}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                              specialForm.recurringPattern === "monthly"
                                ? "bg-gray-800 text-white"
                                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {t('availability.specials.monthly')}
                          </button>
                          <button
                            onClick={() => setSpecialForm({ ...specialForm, recurringPattern: "yearly" })}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                              specialForm.recurringPattern === "yearly"
                                ? "bg-gray-800 text-white"
                                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {t('availability.specials.yearly')}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>

                </div>

                {/* Footer */}
                <div 
                  className="px-6 py-4 border-t border-gray-200"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
                >
                  {/* Delete button (only when editing) */}
                  {editingSpecial && (
                    <button
                      onClick={() => {
                        deleteSpecialDay(editingSpecial.id);
                        setShowSpecialModal(false);
                      }}
                      className="w-full px-4 py-3 text-sm font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors mb-3"
                    >
                      {t('availability.specials.deleteSpecialDay')}
                    </button>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSpecialModal(false)}
                      className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleSaveSpecial}
                      disabled={!specialForm.name || !specialForm.date}
                      className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingSpecial ? t('settings.common.saveChanges') : t('availability.specials.addSpecialDay')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Weekly Schedule Component
function WeeklyScheduleTab({
  daysOfWeek,
  weekSchedule,
  timeSlots,
  expandedDay,
  toggleDay,
  toggleExpandDay,
  addTimeSlot,
  removeTimeSlot,
  updateTimeSlot,
  copyToAllDays,
  onSave,
  saving,
  loading,
  t,
  isRTL,
}: any) {
  // Check if template has any slots
  const hasAnySlots = Object.values(timeSlots).some(
    (slots: any) => Array.isArray(slots) && slots.length > 0
  );

  // Skeleton for loading state
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
      >
        <div className="px-4 lg:px-6 py-4 border-b border-gray-200">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="divide-y divide-gray-200">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="p-4 lg:p-6">
              <div className="flex items-center gap-3">
                <div className="h-6 w-11 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="hidden lg:flex items-center gap-2">
                  <div className="h-6 w-20 bg-gray-100 rounded-lg animate-pulse" />
                  <div className="h-6 w-20 bg-gray-100 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
    >
      <div className="px-4 lg:px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">{t('availability.weekly.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('availability.weekly.subtitle')}
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {daysOfWeek.map((day: any, index: number) => {
          const isEnabled = weekSchedule[day.id as keyof typeof weekSchedule];
          const daySlots = timeSlots[day.id] || [];
          const isExpanded = expandedDay === day.id;

          return (
            <motion.div
              key={day.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
              className={`${!isEnabled ? "bg-gray-50" : ""}`}
            >
              <div className="p-4 lg:p-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDay(day.id)}
                    dir="ltr"
                    className={`toggle-switch relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      isEnabled ? "bg-gray-800" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                        isEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm lg:text-base font-semibold text-gray-900 truncate">
                      {day.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isEnabled ? (
                        daySlots.length > 0 ? (
                          <span className="lg:hidden">
                            {daySlots.length} {daySlots.length > 1 ? t('availability.weekly.slots') : t('availability.weekly.slot')}
                          </span>
                        ) : (
                          t('availability.weekly.noSlots')
                        )
                      ) : (
                        t('availability.weekly.closed')
                      )}
                    </p>
                  </div>

                  {isEnabled && (
                    <div className="flex items-center gap-2">
                      <div className="hidden lg:flex items-center gap-2">
                        {daySlots.slice(0, 2).map((slot: any, i: number) => (
                          <span
                            key={i}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-medium"
                          >
                            {slot.start}-{slot.end}
                          </span>
                        ))}
                        {daySlots.length > 2 && (
                          <span className="text-xs text-gray-500">+{daySlots.length - 2}</span>
                        )}
                      </div>

                      <button
                        onClick={() => toggleExpandDay(day.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Desktop: Always show slots */}
                <div className="hidden lg:block">
                  <AnimatePresence initial={false}>
                    {isEnabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ 
                          height: "auto", 
                          opacity: 1,
                          transition: { 
                            height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                            opacity: { duration: 0.15, delay: 0.08 }
                          }
                        }}
                        exit={{ 
                          height: 0, 
                          opacity: 0,
                          transition: { 
                            height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                            opacity: { duration: 0.15 }
                          }
                        }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-3">
                        {daySlots.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">{t('availability.weekly.noTimeSlots')}</p>
                        ) : (
                          daySlots.map((slot: any, slotIndex: number) => (
                            <div key={slotIndex} className="group flex items-center gap-3">
                              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex-1 hover:border-gray-300 transition-colors">
                                <input
                                  type="time"
                                  value={slot.start}
                                  onChange={(e) =>
                                    updateTimeSlot(day.id, slotIndex, "start", e.target.value)
                                  }
                                  className="bg-transparent text-sm font-semibold text-gray-900 focus:outline-none w-20"
                                />
                                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <input
                                  type="time"
                                  value={slot.end}
                                  onChange={(e) =>
                                    updateTimeSlot(day.id, slotIndex, "end", e.target.value)
                                  }
                                  className="bg-transparent text-sm font-semibold text-gray-900 focus:outline-none w-20"
                                />
                              </div>
                              <button
                                onClick={() => removeTimeSlot(day.id, slotIndex)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all lg:opacity-0 lg:group-hover:opacity-100"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => addTimeSlot(day.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                            {t('availability.weekly.addSlot')}
                          </button>
                          {daySlots.length > 0 && (
                            <button
                              onClick={() => copyToAllDays(day.id)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              {t('availability.weekly.copyToAll')}
                            </button>
                          )}
                        </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Mobile: Expandable slots */}
              <AnimatePresence initial={false}>
                {isEnabled && isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ 
                      height: "auto", 
                      opacity: 1,
                      transition: { 
                        height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                        opacity: { duration: 0.2, delay: 0.1 }
                      }
                    }}
                    exit={{ 
                      height: 0, 
                      opacity: 0,
                      transition: { 
                        height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
                        opacity: { duration: 0.15 }
                      }
                    }}
                    className="lg:hidden border-t border-gray-200 bg-gray-50/50 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                    {daySlots.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center italic py-2">
                        {t('availability.weekly.noTimeSlots')}
                      </p>
                    ) : (
                      daySlots.map((slot: any, slotIndex: number) => (
                        <div
                          key={slotIndex}
                          className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-3">
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) =>
                                  updateTimeSlot(day.id, slotIndex, "start", e.target.value)
                                }
                                className="flex-1 px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:bg-white transition-colors"
                              />
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) =>
                                  updateTimeSlot(day.id, slotIndex, "end", e.target.value)
                                }
                                className="flex-1 px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:bg-white transition-colors"
                              />
                            </div>
                            <button
                              onClick={() => removeTimeSlot(day.id, slotIndex)}
                              className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => addTimeSlot(day.id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-700 active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        {t('availability.weekly.addSlot')}
                      </button>
                      {daySlots.length > 0 && (
                        <button
                          onClick={() => copyToAllDays(day.id)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 active:scale-95 transition-all"
                        >
                          <Copy className="w-4 h-4" />
                          {t('availability.weekly.copyToAll')}
                        </button>
                      )}
                    </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="border-t border-gray-200 p-4 lg:p-6 bg-gray-50">
        <button
          onClick={onSave}
          disabled={saving || !hasAnySlots}
          className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}
          title={!hasAnySlots ? t('availability.weekly.addSlotToSave') : ""}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('common.saving')}
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              {t('settings.common.saveChanges')}
            </>
          )}
        </button>
        {!hasAnySlots && (
          <p className="text-xs text-gray-500 text-center mt-2">
            {t('availability.weekly.addSlotToSave')}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Planning Tab Component
function PlanningTab({
  currentMonth,
  previousMonth,
  nextMonth,
  calendarDays,
  selectedDate,
  selectedDateObj,
  selectedDateData,
  selectDate,
  isToday,
  isPast,
  hasCustomSchedule,
  formatDateKey,
  formatDateDisplay,
  addCustomSlot,
  removeCustomSlot,
  updateCustomSlot,
  removeCustomDate,
  onSave,
  saving,
  loading,
  t,
  isRTL,
  language,
}: any) {
  // Get locale for date formatting
  const getLocale = () => {
    switch (language) {
      case 'he': return 'he-IL';
      case 'ar': return 'ar-EG';
      default: return 'en-US';
    }
  };
  // Skeleton for loading state
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Calendar Skeleton */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="flex items-center gap-1">
              <div className="h-8 w-8 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-8 w-8 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square flex items-center justify-center">
                <div className="h-8 w-8 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        {/* Selected Date Skeleton */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6">
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4"
    >
      {/* Calendar */}
      <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            {currentMonth.toLocaleDateString(getLocale(), { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className={`w-4 h-4 text-gray-600 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className={`w-4 h-4 text-gray-600 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {[
            t('days.calSun'),
            t('days.calMon'),
            t('days.calTue'),
            t('days.calWed'),
            t('days.calThu'),
            t('days.calFri'),
            t('days.calSat')
          ].map((day, i) => (
            <div key={i} className={`text-center font-medium text-gray-500 py-2 ${language === 'ar' ? 'text-[10px]' : 'text-xs'}`}>
              {day}
            </div>
          ))}
          
          {calendarDays.map((date: any, index: number) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateKey = formatDateKey(date);
            const isSelected = dateKey === selectedDate;
            const isTodayDate = isToday(date);
            const isPastDate = isPast(date);
            const hasCustom = hasCustomSchedule(date);

            return (
              <button
                key={dateKey}
                onClick={() => !isPastDate && selectDate(date)}
                disabled={isPastDate}
                className={`aspect-square rounded-xl text-sm font-medium transition-all relative ${
                  isPastDate
                    ? "text-gray-300 cursor-not-allowed"
                    : isSelected
                    ? "bg-gray-800 text-white"
                    : isTodayDate
                    ? "bg-blue-50 text-blue-700 ring-2 ring-blue-500"
                    : hasCustom
                    ? "bg-amber-50 text-amber-900"
                    : "hover:bg-gray-100 text-gray-900"
                }`}
              >
                {date.getDate()}
                {hasCustom && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Details */}
      <div className="lg:col-span-2">
        {selectedDateObj && selectedDateData ? (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 lg:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {formatDateDisplay(selectedDateObj)}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDateData.slots.length === 0 
                    ? t('availability.planning.closedNoSlots') 
                    : `${selectedDateData.slots.length} ${selectedDateData.slots.length > 1 ? t('availability.planning.timeSlots') : t('availability.planning.timeSlot')}`}
                </p>
              </div>
              <button
                onClick={removeCustomDate}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Time Slots */}
            <div className="p-4 lg:p-6 space-y-3">
              {selectedDateData.slots.length === 0 ? (
                <p className="text-sm text-gray-500 text-center italic py-8">
                  {t('availability.planning.noTimeSlotsForDate')}
                </p>
              ) : (
                selectedDateData.slots.map((slot: any, index: number) => (
                  <div key={index} className="group flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-1 hover:border-gray-300 transition-colors">
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => updateCustomSlot(index, "start", e.target.value)}
                        className="bg-transparent text-sm font-semibold text-gray-900 focus:outline-none w-20"
                      />
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateCustomSlot(index, "end", e.target.value)}
                        className="bg-transparent text-sm font-semibold text-gray-900 focus:outline-none w-20"
                      />
                    </div>
                    <button
                      onClick={() => removeCustomSlot(index)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}

              <button
                onClick={addCustomSlot}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t('availability.planning.addTimeSlot')}
              </button>
            </div>

            {/* Save Button */}
            <div className="border-t border-gray-200 p-4 lg:p-6 bg-gray-50">
              <button
                onClick={onSave}
                disabled={saving || !selectedDate}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {t('settings.common.saveChanges')}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
            <CalendarDays className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-base font-medium text-gray-900 mb-2">{t('availability.planning.selectDateToStart')}</p>
            <p className="text-sm text-gray-500">
              {t('availability.planning.selectDateDesc')}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Specials Tab Component
function SpecialsTab({ specialDays, deleteSpecialDay, openAddSpecialModal, openEditSpecialModal, loading, t, isRTL, language }: any) {
  const recurringDays = specialDays.filter((day: SpecialDay) => day.recurring);
  const oneTimeDays = specialDays.filter((day: SpecialDay) => !day.recurring);

  // Skeleton for loading state
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="space-y-6 pb-20"
      >
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse mt-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-6 pb-20"
    >
      {/* Special Days List - Native Mobile Style */}
      {specialDays.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('availability.specials.noSpecialDays')}
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            {t('availability.specials.noSpecialDaysDesc')}
          </p>
          <button
            onClick={openAddSpecialModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('availability.specials.addFirstSpecialDay')}
          </button>
        </div>
      ) : (
        <>
          {/* Recurring Events Section */}
          {recurringDays.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t('availability.specials.recurringEvents')}
                </h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {recurringDays.length}
                </span>
              </div>
              <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
                {recurringDays.map((special: SpecialDay, index: number) => (
                  <SpecialDayCard
                    key={special.id}
                    special={special}
                    index={index}
                    openEditSpecialModal={openEditSpecialModal}
                    deleteSpecialDay={deleteSpecialDay}
                    isRTL={isRTL}
                    language={language}
                  />
                ))}
              </div>
            </div>
          )}

          {/* One-Time Events Section */}
          {oneTimeDays.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t('availability.specials.oneTimeEvents')}
                </h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {oneTimeDays.length}
                </span>
              </div>
              <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
                {oneTimeDays.map((special: SpecialDay, index: number) => (
                  <SpecialDayCard
                    key={special.id}
                    special={special}
                    index={index}
                    openEditSpecialModal={openEditSpecialModal}
                    deleteSpecialDay={deleteSpecialDay}
                    isRTL={isRTL}
                    language={language}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Mobile FAB - White for visual balance */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 25 }}
        whileTap={{ scale: 0.92 }}
        onClick={openAddSpecialModal}
        className="lg:hidden fixed right-5 z-30 w-14 h-14 bg-white text-gray-900 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-200 flex items-center justify-center"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </motion.button>

      {/* Desktop: Add button at bottom right */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.2 }}
        onClick={openAddSpecialModal}
        className="hidden lg:flex fixed bottom-8 right-8 items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors shadow-lg z-10"
      >
        <Plus className="w-5 h-5" />
        {t('availability.specials.addSpecialDay')}
      </motion.button>
    </motion.div>
  );
}

// Special Day Card Component
function SpecialDayCard({ special, index, openEditSpecialModal, deleteSpecialDay, isRTL, language }: any) {
  // Get locale for date formatting
  const getLocale = () => {
    switch (language) {
      case 'he': return 'he-IL';
      case 'ar': return 'ar-EG';
      default: return 'en-US';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => openEditSpecialModal(special)}
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden group hover:shadow-sm transition-shadow cursor-pointer active:scale-[0.99]"
    >
      <div className="p-4 lg:p-5">
        <div className="flex items-center gap-3">
          {/* Icon - Clean consistent style */}
          <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            {special.recurring ? (
              <RefreshCcw className="w-5 h-5 lg:w-6 lg:h-6 text-gray-700" />
            ) : (
              <Calendar className="w-5 h-5 lg:w-6 lg:h-6 text-gray-700" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
              {special.name}
            </h3>
            
            {/* Date - Prominent */}
            <p className="text-sm text-gray-600 mb-1.5">
              {special.dates.map((date: string, i: number) => (
                <span key={i}>
                  {new Date(date).toLocaleDateString(getLocale(), {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              ))}
            </p>
            
            {/* Pattern (if recurring) */}
            {special.recurring && special.recurringPattern && (
              <p className="text-xs text-gray-500">
                {special.recurringPattern}
              </p>
            )}
          </div>

          {/* Chevron arrow - native iOS/Android style */}
          <div className="flex-shrink-0 self-center">
            <svg className={`w-5 h-5 text-gray-400 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
