"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronDown, Phone, Sparkles, Calendar as CalendarIcon } from "lucide-react";
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
  onPendingClick?: () => void;
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
  selectedDate, appointments, allAppointments = [], onDateChange, onAppointmentClick, onPendingClick, onEmptySlotClick,
  workingHours = { start: 0, end: 24 },
  slotDuration = 15,
  scrollLock = false,
}: TimelineCalendarProps) {
  const { t, isRTL, language } = useTranslation();
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
    const endOfDay = workingHours.end * 60;
    
    return appointments.map(a => {
      const startMinutes = timeToMinutes(a.time);
      const endMinutes = timeToMinutes(a.endTime);
      
      // Handle sessions that wrap past midnight (endTime < startTime means it crossed midnight)
      const effectiveEndMinutes = endMinutes < startMinutes ? endOfDay : Math.min(endMinutes, endOfDay);
      
      return {
        ...a,
        top: (startMinutes - start) * MINUTE_HEIGHT + 4,
        height: Math.max((effectiveEndMinutes - startMinutes) * MINUTE_HEIGHT - 4, 52),
      };
    });
  }, [appointments, workingHours]);

  // Track if this is the first load (for instant scroll) vs date change (for smooth scroll)
  const isInitialLoad = useRef(true);
  
  // Scroll to relevant position when date changes
  useLayoutEffect(() => {
    if (!scrollContainerRef.current || hasScrolled || viewMode !== 'day') return;
    
    const container = scrollContainerRef.current;
    
    let targetScroll = 0;
    
    if (isToday && currentTimePosition !== null) {
      // Today: scroll to current time
      targetScroll = currentTimePosition - 100;
    } else if (blocks.length > 0) {
      // Other days with appointments: scroll to first appointment
      const firstAppointmentTop = Math.min(...blocks.map(b => b.top));
      targetScroll = Math.max(0, firstAppointmentTop - 60);
    } else {
      // Empty days: scroll to a sensible default (9 AM)
      const defaultHour = 9;
      const defaultPosition = (defaultHour - workingHours.start) * HOUR_HEIGHT;
      targetScroll = Math.max(0, defaultPosition - 50);
    }
    
    // Use smooth scroll for date changes, instant for initial load
    if (isInitialLoad.current) {
      container.scrollTop = targetScroll;
      isInitialLoad.current = false;
    } else {
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
    
    setHasScrolled(true);
  }, [currentTimePosition, hasScrolled, viewMode, isToday, blocks, workingHours]);

  const navigateWeek = (dir: 'prev'|'next') => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + (dir === 'next' ? 7 : -7));
    onDateChange(formatDateString(d));
  };

  // Get translated day and month names
  const shortDayNames = useMemo(() => [
    t('days.calSun'), t('days.calMon'), t('days.calTue'), t('days.calWed'), t('days.calThu'), t('days.calFri'), t('days.calSat')
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
      {/* Header - Clean & Minimal */}
      <div className="flex-shrink-0">
        {/* Top Row - Month & Today */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setIsMonthExpanded(!isMonthExpanded)}
            className="flex items-center gap-2 active:opacity-70 transition-opacity"
          >
            <h1 className="text-2xl font-bold theme-text-primary tracking-tight">
              {dateInfo.month}
            </h1>
            <span className="text-2xl font-light theme-text-secondary">{dateInfo.year}</span>
            <ChevronDown className={`w-5 h-5 theme-text-secondary transition-transform duration-200 ${isMonthExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Today button - only shows when not viewing current week */}
          {!isMonthExpanded && !isCurrentWeek && (
            <button
              onClick={() => onDateChange(formatDateString(new Date()))}
              className="px-3 py-1.5 text-[12px] font-semibold theme-text-secondary theme-bg-secondary border theme-border rounded-full hover:theme-text-primary active:scale-95 transition-all shadow-sm"
            >
              {t('common.today')}
            </button>
          )}
        </div>

        {/* Month Picker Dropdown */}
        {isMonthExpanded && (
          <div className="theme-bg-secondary rounded-2xl p-4 mb-4 shadow-sm border theme-border">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="w-9 h-9 flex items-center justify-center theme-text-secondary hover:theme-text-primary rounded-full hover:theme-bg-tertiary active:scale-95 transition-all"
              >
                <ChevronLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
              <span className="text-base font-semibold theme-text-primary">
                {monthNames[displayedMonth.month]} {displayedMonth.year}
              </span>
              <button
                onClick={() => navigateMonth('next')}
                className="w-9 h-9 flex items-center justify-center theme-text-secondary hover:theme-text-primary rounded-full hover:theme-bg-tertiary active:scale-95 transition-all"
              >
                <ChevronRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {shortDayNames.map((day, i) => (
                <div key={i} className={`text-center font-semibold theme-text-tertiary py-1 ${language === 'ar' ? 'text-[9px]' : 'text-[11px] uppercase'}`}>
                  {day}
                </div>
              ))}
            </div>
                
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {monthCalendarDays.map((day, index) => (
                <button
                  key={`${displayedMonth.month}-${index}`}
                  onClick={() => selectDateFromPicker(day.dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-[13px] font-medium transition-all ${
                    day.isSelected
                      ? 'selected-tab shadow-md'
                      : day.isToday
                        ? 'theme-bg-tertiary theme-text-primary font-bold'
                        : day.isCurrentMonth
                          ? 'theme-text-secondary hover:theme-bg-tertiary active:scale-95'
                          : 'theme-text-tertiary'
                  }`}
                >
                  <span>{day.date}</span>
                  {day.hasAppointments && (
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      day.isSelected ? 'bg-white/80' : 'selected-tab'
                    }`} />
                  )}
                </button>
              ))}
            </div>
                
            {/* Quick Actions */}
            <div className="flex justify-center mt-4 pt-3 border-t theme-border">
              <button
                onClick={() => {
                  onDateChange(formatDateString(new Date()));
                  setIsMonthExpanded(false);
                }}
                className="px-4 py-2 text-[13px] font-semibold theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary rounded-lg transition-all"
              >
                {t('common.today')}
              </button>
            </div>
          </div>
        )}

        {/* Week Strip - Matches Dashboard Style */}
        {!isMonthExpanded && (
          <div className="theme-bg-secondary rounded-t-2xl p-2 pt-3 shadow-sm border theme-border">
            <div className="flex gap-1">
              {weekDates.map((day) => {
                const isSelected = day.date === selectedDate;
                const hasAppointments = day.appointments.length > 0;
                const appointmentCount = day.appointments.length;
                
                return (
                  <button
                    key={day.date}
                    onClick={() => onDateChange(day.date)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-3xl transition-colors active:scale-95 ${
                      isSelected
                        ? 'selected-tab'
                        : day.isToday
                        ? 'theme-bg-tertiary theme-text-primary'
                        : 'theme-text-secondary hover:theme-bg-tertiary active:theme-bg-active'
                    }`}
                  >
                    <p className={`text-[10px] font-medium uppercase ${
                      isSelected ? 'opacity-60' : ''
                    }`}>
                      {day.dayName}
                    </p>
                    <p className="text-lg font-semibold">
                      {day.dayNum}
                    </p>
                    {hasAppointments ? (
                      <p className={`text-[10px] font-medium ${
                        isSelected ? 'opacity-60' : 'theme-text-secondary'
                      }`}>
                        {appointmentCount}
                      </p>
                    ) : (
                      <p className={`text-[10px] ${isSelected ? 'opacity-50' : 'theme-text-tertiary'}`}>-</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day View */}
      {viewMode === 'day' && (
        <motion.div 
          ref={scrollContainerRef} 
          dir="ltr" 
          className={`flex-1 theme-bg-secondary border-x theme-border relative ${scrollLock ? "overflow-hidden touch-none" : "overflow-y-auto"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Empty State Overlay */}
          {appointments.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center px-6"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full theme-bg-tertiary flex items-center justify-center">
                  <CalendarIcon className="w-8 h-8 theme-text-tertiary" />
                </div>
                <p className="text-[15px] font-medium theme-text-tertiary">
                  {t('calendar.noAppointments')}
                </p>
                <p className="text-[13px] theme-text-tertiary mt-1">
                  {t('calendar.emptyDayHint')}
                </p>
              </motion.div>
            </div>
          )}
          
          <motion.div 
            key={selectedDate}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`p-3 sm:p-4 pb-24 ${appointments.length === 0 ? 'opacity-30' : ''}`}
          >
            <div className="relative" style={{ height: timelineHeight }} onClick={handleClick}>
              {/* Time Grid */}
              {timeLabels.map(({ time, position, type }) => (
                <div 
                  key={time} 
                  className="absolute left-0 right-0 flex items-center -translate-y-1/2" 
                  style={{ top: position }}
                >
                  <span className={`w-12 text-right pr-3 tabular-nums ${
                    type === 'hour' ? 'text-[11px] font-semibold timeline-time-hour' : 'text-[10px] timeline-time'
                  }`}>
                    {time}
                  </span>
                  <div className={`flex-1 h-px ${type === 'hour' ? 'timeline-grid-hour' : 'timeline-grid-minor'}`} />
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
                <AnimatePresence mode="sync">
                  {blocks.map((apt) => {
                    const isNow = apt.timeStatus === 'now' && !apt.isPast;
                    const isPending = apt.isPending;
                    const isCompact = apt.height < 60;
                    
                    return (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`absolute left-0 right-0 ${apt.isPast ? '' : 'cursor-pointer'}`}
                        style={{ top: apt.top, height: apt.height }}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (apt.isPast) return;
                          if (apt.isPending && onPendingClick) {
                            onPendingClick();
                          } else if (!apt.isPending) {
                            onAppointmentClick(apt);
                          }
                        }}
                      >
                        <div className={`group h-full rounded-xl overflow-hidden transition-all duration-200 ${
                          isNow
                            ? 'selected-tab shadow-lg'
                            : isPending
                            ? 'bg-amber-50 border-2 border-dashed border-amber-300 hover:border-amber-400 hover:shadow-md'
                            : apt.isPast
                            ? 'theme-bg-tertiary border theme-border opacity-50'
                            : 'appointment-card'
                        }`}>
                          <div className={`h-full flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                            {/* Accent Bar */}
                            <div className={`w-1.5 flex-shrink-0 rounded-l-xl ${
                              isNow ? 'bg-emerald-500' : isPending ? 'bg-amber-400' : apt.isPast ? 'theme-bg-active' : apt.avatar.color
                            }`} />
                            
                            {/* Content */}
                            <div className={`flex-1 px-2.5 flex flex-col justify-center min-w-0 ${isCompact ? 'py-0.5' : 'py-2'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                              <div className="flex items-center gap-1.5">
                                <p className={`font-semibold truncate ${isNow ? '' : isPending ? 'text-amber-900' : apt.isPast ? 'theme-text-tertiary' : 'theme-text-primary'} ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                  {apt.client}
                                </p>
                                {isNow && (
                                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                )}
                                {isPending && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 bg-amber-200 rounded-full uppercase tracking-wide">
                                    {t('requests.stats.pending')}
                                  </span>
                                )}
                                {!isPending && !apt.isPast && !isNow && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 rounded-full uppercase tracking-wide">
                                    {t('calendar.status.confirmed')}
                                  </span>
                                )}
                                {apt.isPast && !isPending && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold theme-text-tertiary theme-bg-tertiary rounded-full">
                                    {t('dashboard.schedule.completed')}
                                  </span>
                                )}
                              </div>
                              
                              {!isCompact && (
                                <p className={`text-xs truncate mt-0.5 ${isNow ? 'opacity-70' : isPending ? 'text-amber-700/70' : apt.isPast ? 'theme-text-tertiary' : 'theme-text-secondary'}`}>
                                  {apt.service}
                                </p>
                              )}
                              
                              <p className={`tabular-nums mt-0.5 ${isNow ? 'opacity-50' : apt.isPast ? 'theme-text-tertiary' : 'theme-text-secondary'} ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                                {apt.time} – {apt.endTime}
                              </p>
                            </div>
                            
                            {/* Phone Button - Hidden for past and pending */}
                            {apt.phone && !apt.isPast && !isPending && (
                              <a 
                                href={`tel:${apt.phone}`} 
                                onClick={(e) => e.stopPropagation()}
                                className={`flex-shrink-0 flex items-center px-3 transition-all duration-200 ${
                                  isNow 
                                    ? 'opacity-50 hover:opacity-80' 
                                    : 'card-phone-icon'
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
          </motion.div>
      </motion.div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <motion.div 
          className="hidden lg:flex lg:flex-col flex-1 overflow-hidden theme-bg-secondary rounded-t-2xl border theme-border shadow-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Week Header */}
          <div className="grid grid-cols-7 border-b theme-border">
            {weekDates.map((day, index) => (
              <motion.button
                key={day.date}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => { onDateChange(day.date); setViewMode('day'); }}
                className={`py-3.5 text-center transition-all duration-200 hover:theme-bg-tertiary ${
                  day.isToday ? 'selected-tab' : ''
                } ${day.isSelected && !day.isToday ? 'theme-bg-tertiary' : ''}`}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${day.isToday ? 'opacity-60' : 'theme-text-tertiary'}`}>
                  {day.dayName}
                </p>
                <p className={`text-lg font-bold mt-0.5 ${day.isToday ? '' : 'theme-text-primary'}`}>
                  {day.dayNum}
                </p>
                {day.appointments.length > 0 && (
                  <div className="flex justify-center mt-1.5">
                    <span className={`w-1 h-1 rounded-full ${day.isToday ? 'bg-white/50' : 'theme-text-tertiary'}`} />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
          
          {/* Week Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-7 divide-x divide-theme" style={{ minHeight: 500 }}>
              {weekDates.map((day) => {
                const dayAppointments = day.appointments;
                const start = workingHours.start * 60;
                const endOfDay = workingHours.end * 60;
                const dayBlocks = dayAppointments.map(a => {
                  const startMinutes = timeToMinutes(a.time);
                  const endMinutes = timeToMinutes(a.endTime);
                  // Handle sessions that wrap past midnight
                  const effectiveEndMinutes = endMinutes < startMinutes ? endOfDay : Math.min(endMinutes, endOfDay);
                  
                  return {
                    ...a,
                    top: (startMinutes - start) * (MINUTE_HEIGHT * 0.4),
                    height: Math.max((effectiveEndMinutes - startMinutes) * (MINUTE_HEIGHT * 0.4), 24),
                  };
                });
                
                return (
                  <div 
                    key={day.date} 
                    className={`relative p-1 ${day.isSelected ? 'theme-bg-tertiary' : ''}`} 
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
                            : 'theme-bg-tertiary hover:theme-bg-secondary'
                        }`}
                        style={{ top: apt.top, height: apt.height, minHeight: 22 }}
                      >
                        <div className="h-full flex">
                          <div className={`w-1 flex-shrink-0 ${apt.isPending ? 'bg-amber-400' : apt.avatar.color}`} />
                          <div className="flex-1 px-1.5 py-0.5 min-w-0 flex items-center">
                            <p className="text-[10px] font-semibold theme-text-primary truncate leading-tight">
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
