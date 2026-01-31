"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronDown, Phone, Sparkles } from "lucide-react";
import { useTranslation } from "@/app/i18n";

interface TimelineAppointment {
  id: string;
  time: string;
  endTime: string;
  client: string;
  service: string;
  status: string;
  date: string;
  avatar: { initials: string; color: string };
  phone?: string;
  email?: string;
  notes?: string;
  duration?: number;
  isPending?: boolean;
  isPast?: boolean;
  timeStatus?: 'past' | 'now' | 'soon' | 'upcoming';
}

interface TimelineCalendarProps {
  selectedDate: string;
  appointments: TimelineAppointment[];
  allAppointments?: TimelineAppointment[];
  onDateChange: (date: string) => void;
  onAppointmentClick: (appointment: TimelineAppointment) => void;
  onEmptySlotClick?: (date: string, time: string) => void;
  workingHours?: { start: number; end: number };
  slotDuration?: number;
  /** When true, disables timeline scroll (e.g. when a modal is open). */
  scrollLock?: boolean;
}

const formatDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const timeToMinutes = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
const minutesToTime = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

const MINUTE_HEIGHT = 3.2;
const HOUR_HEIGHT = 60 * MINUTE_HEIGHT;


export default function TimelineCalendar({
  selectedDate, appointments, allAppointments = [], onDateChange, onAppointmentClick, onEmptySlotClick,
  workingHours = { start: 0, end: 24 },
  slotDuration = 15,
  scrollLock = false,
}: TimelineCalendarProps) {
  const { t, isRTL } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return { month: d.getMonth(), year: d.getFullYear() };
  });

  useEffect(() => {
    const i = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => setHasScrolled(false), [selectedDate]);

  // Reset displayed month when opening picker
  useEffect(() => {
    if (isMonthExpanded) {
      const d = new Date(selectedDate + 'T00:00:00');
      setDisplayedMonth({ month: d.getMonth(), year: d.getFullYear() });
    }
  }, [isMonthExpanded, selectedDate]);

  const isToday = useMemo(() => selectedDate === formatDateString(new Date()), [selectedDate]);

  const currentTimePosition = useMemo(() => {
    if (!isToday) return null;
    const total = currentTime.getHours() * 60 + currentTime.getMinutes();
    const start = workingHours.start * 60;
    return (total - start) * MINUTE_HEIGHT;
  }, [currentTime, isToday, workingHours]);

  // Scroll to "now" before first paint to avoid flash of wrong position
  useLayoutEffect(() => {
    if (currentTimePosition !== null && scrollContainerRef.current && !hasScrolled && viewMode === 'day') {
      const container = scrollContainerRef.current;
      container.scrollTop = currentTimePosition - 100;
      setHasScrolled(true);
    }
  }, [currentTimePosition, hasScrolled, viewMode]);

  const timeLabels = useMemo(() => {
    const labels = [];
    const slotsPerHour = 60 / slotDuration;
    
    for (let h = workingHours.start; h <= workingHours.end; h++) {
      labels.push({ time: `${String(h).padStart(2,'0')}:00`, position: (h - workingHours.start) * HOUR_HEIGHT, type: 'hour' });
      
      if (h < workingHours.end) {
        for (let slot = 1; slot < slotsPerHour; slot++) {
          const minutes = slot * slotDuration;
          const position = (h - workingHours.start) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
          const type = minutes === 30 ? 'half' : 'quarter';
          labels.push({ 
            time: `${String(h).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`, 
            position, 
            type 
          });
        }
      }
    }
    return labels;
  }, [workingHours, slotDuration]);

  const timelineHeight = (workingHours.end - workingHours.start) * HOUR_HEIGHT;

  const blocks = useMemo(() => {
    const start = workingHours.start * 60;
    return appointments.map(a => ({
      ...a,
      top: (timeToMinutes(a.time) - start) * MINUTE_HEIGHT + 4,
      height: Math.max((timeToMinutes(a.endTime) - timeToMinutes(a.time)) * MINUTE_HEIGHT - 4, 52),
    }));
  }, [appointments, workingHours]);

  const navigateWeek = (dir: 'prev'|'next') => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + (dir === 'next' ? 7 : -7));
    onDateChange(formatDateString(d));
  };

  // Get translated day and month names
  const shortDayNames = useMemo(() => [
    t('days.s'), t('days.m'), t('days.t'), t('days.w'), t('days.t'), t('days.f'), t('days.s')
  ], [t]);

  const monthNames = useMemo(() => [
    t('months.january'), t('months.february'), t('months.march'), t('months.april'),
    t('months.may'), t('months.june'), t('months.july'), t('months.august'),
    t('months.september'), t('months.october'), t('months.november'), t('months.december')
  ], [t]);

  const weekDates = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - dayOfWeek);
    
    const dates = [];
    const today = formatDateString(new Date());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const dateStr = formatDateString(date);
      dates.push({
        date: dateStr,
        dayNum: date.getDate(),
        dayName: shortDayNames[i],
        isToday: dateStr === today,
        isSelected: dateStr === selectedDate,
        appointments: allAppointments.filter(a => a.date === dateStr),
      });
    }
    return dates;
  }, [selectedDate, allAppointments, shortDayNames]);

  const dateInfo = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const today = new Date();
    const isDateToday = d.toDateString() === today.toDateString();
    const tmrw = new Date(today); tmrw.setDate(today.getDate()+1);
    return {
      num: d.getDate(),
      month: monthNames[d.getMonth()],
      year: d.getFullYear(),
      isToday: isDateToday,
      isTomorrow: d.toDateString() === tmrw.toDateString(),
    };
  }, [selectedDate, monthNames]);

  // Month picker calendar days
  const monthCalendarDays = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateString(today);
    const year = displayedMonth.year;
    const month = displayedMonth.month;
    
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days: Array<{
      date: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasAppointments: boolean;
    }> = [];
    
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const date = new Date(year, month - 1, d);
      const dateStr = formatDateString(date);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        isSelected: dateStr === selectedDate,
        hasAppointments: allAppointments.some(a => a.date === dateStr),
      });
    }
    
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = formatDateString(date);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        hasAppointments: allAppointments.some(a => a.date === dateStr),
      });
    }
    
    // Next month padding (fill to 42 = 6 rows)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      const dateStr = formatDateString(date);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        isSelected: dateStr === selectedDate,
        hasAppointments: allAppointments.some(a => a.date === dateStr),
      });
    }
    
    return days;
  }, [displayedMonth, selectedDate, allAppointments]);

  const navigateMonth = (dir: 'prev' | 'next') => {
    setDisplayedMonth(prev => {
      let newMonth = prev.month + (dir === 'next' ? 1 : -1);
      let newYear = prev.year;
      if (newMonth > 11) { newMonth = 0; newYear++; }
      if (newMonth < 0) { newMonth = 11; newYear--; }
      return { month: newMonth, year: newYear };
    });
  };

  const selectDateFromPicker = (dateStr: string) => {
    onDateChange(dateStr);
    setIsMonthExpanded(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onEmptySlotClick) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const total = workingHours.start * 60 + y / MINUTE_HEIGHT;
    onEmptySlotClick(selectedDate, minutesToTime(Math.round(total/15)*15));
  };

  const nowLabel = `${String(currentTime.getHours()).padStart(2,'0')}:${String(currentTime.getMinutes()).padStart(2,'0')}`;
  const remaining = appointments.filter(a => !a.isPast).length;

  const isCurrentWeek = useMemo(() => {
    const todayStr = formatDateString(new Date());
    return weekDates.some(day => day.date === todayStr);
  }, [weekDates]);


  return (
    <div className="flex flex-col h-full">
      {/* Header - Clean & Refined */}
      <div className="flex-shrink-0 pb-3">
        {/* Top Row - Month & Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setIsMonthExpanded(!isMonthExpanded)}
            className="flex items-center gap-1 active:opacity-70 transition-opacity"
          >
            <h1 className="text-xl font-bold text-gray-900">
              {dateInfo.month} {dateInfo.year}
            </h1>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isMonthExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          {!isMonthExpanded && (
            <div className="flex items-center gap-1">
              {!isCurrentWeek && (
                <button
                  onClick={() => onDateChange(formatDateString(new Date()))}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {t('common.today')}
                </button>
              )}
              <button 
                onClick={() => navigateWeek('prev')}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
              <button 
                onClick={() => navigateWeek('next')}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Month Picker Dropdown */}
        {isMonthExpanded && (
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => navigateMonth('prev')}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 rounded-full hover:bg-white transition-colors"
              >
                <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
              <span className="text-sm font-semibold text-gray-900">
                {monthNames[displayedMonth.month]} {displayedMonth.year}
              </span>
              <button
                onClick={() => navigateMonth('next')}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 rounded-full hover:bg-white transition-colors"
              >
                <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {shortDayNames.map((day, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-gray-400 uppercase py-1">
                  {day}
                </div>
              ))}
            </div>
                
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {monthCalendarDays.map((day, index) => (
                <button
                  key={`${displayedMonth.month}-${index}`}
                  onClick={() => selectDateFromPicker(day.dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-[13px] font-medium transition-colors ${
                    day.isSelected
                      ? 'bg-gray-900 text-white'
                      : day.isToday
                        ? 'bg-white text-gray-900 font-semibold'
                        : day.isCurrentMonth
                          ? 'text-gray-700 hover:bg-white'
                          : 'text-gray-300'
                  }`}
                >
                  <span>{day.date}</span>
                  {day.hasAppointments && (
                    <span className={`mt-0.5 w-1 h-1 rounded-full shrink-0 ${
                      day.isSelected ? 'bg-white/80' : day.isToday ? 'bg-gray-500' : 'bg-gray-400'
                    }`} />
                  )}
                </button>
              ))}
            </div>
                
            {/* Quick Actions */}
            <div className="flex justify-center mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={() => {
                  onDateChange(formatDateString(new Date()));
                  setIsMonthExpanded(false);
                }}
                className="px-4 py-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
              >
                {t('common.today')}
              </button>
            </div>
          </div>
        )}

        {/* Week Strip */}
        {!isMonthExpanded && (
          <div className="flex items-center justify-between gap-1 mb-3">
            {weekDates.map((day) => {
              const isSelected = day.date === selectedDate;
              const hasAppointments = day.appointments.length > 0;
              
              return (
                <button
                  key={day.date}
                  onClick={() => onDateChange(day.date)}
                  className={`flex-1 py-2 rounded-xl text-center transition-colors ${
                    isSelected
                      ? 'bg-gray-900'
                      : 'hover:bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  <p className={`text-[10px] font-medium uppercase ${
                    isSelected ? 'text-gray-400' : 'text-gray-400'
                  }`}>
                    {day.dayName}
                  </p>
                  <p className={`text-[17px] font-semibold mt-0.5 ${
                    isSelected ? 'text-white' : day.isToday ? 'text-gray-900' : 'text-gray-600'
                  }`}>
                    {day.dayNum}
                  </p>
                  {hasAppointments && !isSelected && (
                    <div className="w-1 h-1 rounded-full bg-gray-400 mx-auto mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Stats - Simple & Clean */}
        {!isMonthExpanded && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500">
              <span className="font-semibold text-gray-900">{appointments.length}</span>
              {' '}{appointments.length === 1 ? t('calendar.appointment') : t('calendar.appointments')}
            </span>
            {appointments.length === 0 && (
              <span className="text-gray-400">{t('calendar.noAppointments')}</span>
            )}
          </div>
        )}
      </div>

      {/* Day View */}
      {viewMode === 'day' && (
        <motion.div 
          ref={scrollContainerRef} 
          dir="ltr" 
          className={`flex-1 bg-white rounded-t-2xl border border-gray-200/80 shadow-sm ${scrollLock ? "overflow-hidden touch-none" : "overflow-y-auto"}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="p-3 sm:p-4">
            <div className="relative" style={{ height: timelineHeight }} onClick={handleClick}>
              {/* Time Grid */}
              {timeLabels.map(({ time, position, type }) => (
                <div 
                  key={time} 
                  className="absolute left-0 right-0 flex items-center" 
                  style={{ top: position }}
                >
                  <span className={`w-12 text-right pr-3 -translate-y-1/2 tabular-nums ${
                    type === 'hour' ? 'text-[11px] font-semibold text-gray-400' : 'text-[10px] text-gray-300'
                  }`}>
                    {time}
                  </span>
                  <div className={`flex-1 h-px ${type === 'hour' ? 'bg-gray-200' : 'bg-gray-100'}`} />
                </div>
              ))}

              {/* Now Indicator */}
              {currentTimePosition !== null && (
                <motion.div 
                  ref={currentTimeRef} 
                  className="absolute left-0 right-0 z-20" 
                  style={{ top: currentTimePosition }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center -translate-y-1/2">
                    <span className="w-12 flex justify-end pr-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-md shadow-rose-500/30">
                        {nowLabel}
                      </span>
                    </span>
                    <div className="relative flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-md shadow-rose-500/40" />
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
                    </div>
                    <div className="flex-1 h-[2px] bg-gradient-to-r from-rose-500 to-rose-400/50" />
                  </div>
                </motion.div>
              )}

              {/* Event Blocks */}
              <div className="absolute left-14 right-1 top-0 bottom-0">
                <AnimatePresence mode="popLayout">
                  {blocks.map((apt, i) => {
                    const isNow = apt.timeStatus === 'now' && !apt.isPast;
                    const isPending = apt.isPending;
                    const isCompact = apt.height < 60;
                    
                    return (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, x: -16, scale: 0.97 }}
                        animate={{ 
                          opacity: 1, 
                          x: 0, 
                          scale: 1,
                          transition: {
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                            delay: i * 0.04,
                          }
                        }}
                        exit={{ 
                          opacity: 0, 
                          scale: 0.95,
                          transition: { duration: 0.12 }
                        }}
                        className={`absolute left-0 right-0 ${apt.isPast ? '' : 'cursor-pointer'}`}
                        style={{ top: apt.top, height: apt.height }}
                        onClick={(e) => { e.stopPropagation(); if (!apt.isPast && !apt.isPending) onAppointmentClick(apt); }}
                      >
                        <div className={`group h-full rounded-xl overflow-hidden transition-all duration-200 ${
                          isNow
                            ? 'bg-gray-900 shadow-lg shadow-gray-900/25'
                            : isPending
                            ? 'bg-amber-50 ring-1 ring-amber-200/80 hover:ring-amber-300 hover:shadow-md'
                            : apt.isPast
                            ? 'bg-gray-100 ring-1 ring-gray-200/50 opacity-60'
                            : 'bg-white ring-1 ring-gray-300 shadow-md'
                        }`}>
                          <div className="h-full flex" dir="ltr">
                            {/* Accent Bar */}
                            <div className={`w-1 flex-shrink-0 ${
                              isNow ? 'bg-white/20' : isPending ? 'bg-amber-400' : apt.isPast ? 'bg-gray-300' : apt.avatar.color
                            }`} />
                            
                            {/* Content */}
                            <div className={`flex-1 px-2.5 flex flex-col justify-center min-w-0 ${isCompact ? 'py-0.5' : 'py-2'}`}>
                              <div className="flex items-center gap-1.5">
                                <p className={`font-semibold truncate ${isNow ? 'text-white' : apt.isPast ? 'text-gray-400' : 'text-gray-900'} ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                  {apt.client}
                                </p>
                                {isNow && (
                                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                )}
                                {apt.isPast && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 bg-gray-200 rounded-full">
                                    {t('dashboard.schedule.completed')}
                                  </span>
                                )}
                              </div>
                              
                              {!isCompact && (
                                <p className={`text-xs truncate mt-0.5 ${isNow ? 'text-white/60' : isPending ? 'text-amber-700/70' : apt.isPast ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {apt.service}
                                </p>
                              )}
                              
                              <p className={`tabular-nums mt-0.5 ${isNow ? 'text-white/40' : apt.isPast ? 'text-gray-400' : 'text-gray-400'} ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                                {apt.time} – {apt.endTime}
                              </p>
                            </div>
                            
                            {/* Phone Button - Always visible except for past */}
                            {apt.phone && !apt.isPast && (
                              <a 
                                href={`tel:${apt.phone}`} 
                                onClick={(e) => e.stopPropagation()}
                                className={`flex-shrink-0 flex items-center px-3 transition-all duration-200 ${
                                  isNow 
                                    ? 'text-white/50 hover:text-white' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
      </motion.div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <motion.div 
          className="hidden lg:flex lg:flex-col flex-1 overflow-hidden bg-white rounded-t-2xl border border-gray-200/80 shadow-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Week Header */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {weekDates.map((day, index) => (
              <motion.button
                key={day.date}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => { onDateChange(day.date); setViewMode('day'); }}
                className={`py-3.5 text-center transition-all duration-200 hover:bg-gray-50 ${
                  day.isToday ? 'bg-gray-900 text-white hover:bg-gray-800' : ''
                } ${day.isSelected && !day.isToday ? 'bg-gray-50' : ''}`}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${day.isToday ? 'text-gray-500' : 'text-gray-400'}`}>
                  {day.dayName}
                </p>
                <p className={`text-lg font-bold mt-0.5 ${day.isToday ? 'text-white' : 'text-gray-900'}`}>
                  {day.dayNum}
                </p>
                {day.appointments.length > 0 && (
                  <div className="flex justify-center mt-1.5">
                    <span className={`w-1 h-1 rounded-full ${day.isToday ? 'bg-white/50' : 'bg-gray-400'}`} />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
          
          {/* Week Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-7 divide-x divide-gray-100" style={{ minHeight: 500 }}>
              {weekDates.map((day) => {
                const dayAppointments = day.appointments;
                const start = workingHours.start * 60;
                const dayBlocks = dayAppointments.map(a => ({
                  ...a,
                  top: (timeToMinutes(a.time) - start) * (MINUTE_HEIGHT * 0.4),
                  height: Math.max((timeToMinutes(a.endTime) - timeToMinutes(a.time)) * (MINUTE_HEIGHT * 0.4), 24),
                }));
                
                return (
                  <div 
                    key={day.date} 
                    className={`relative p-1 ${day.isSelected ? 'bg-gray-50/50' : ''}`} 
                    style={{ height: timelineHeight * 0.4 }}
                  >
                    {dayBlocks.map((apt, i) => (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => { onDateChange(apt.date); setViewMode('day'); onAppointmentClick(apt); }}
                        className={`absolute left-1 right-1 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden ${
                          apt.isPast ? 'opacity-35' : ''
                        } ${
                          apt.isPending 
                            ? 'bg-amber-100 hover:bg-amber-50' 
                            : 'bg-gray-100 hover:bg-white'
                        }`}
                        style={{ top: apt.top, height: apt.height, minHeight: 22 }}
                      >
                        <div className="h-full flex">
                          <div className={`w-1 flex-shrink-0 ${apt.isPending ? 'bg-amber-400' : apt.avatar.color}`} />
                          <div className="flex-1 px-1.5 py-0.5 min-w-0 flex items-center">
                            <p className="text-[10px] font-semibold text-gray-900 truncate leading-tight">
                              {apt.client}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Current Time Indicator */}
                    {day.isToday && currentTimePosition !== null && (
                      <div 
                        className="absolute left-0 right-0 flex items-center z-10"
                        style={{ top: currentTimePosition * 0.4 }}
                      >
                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm" />
                        <div className="flex-1 h-[2px] bg-rose-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
