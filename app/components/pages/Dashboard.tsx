"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  ArrowRight, 
  Plus,
  CalendarOff,
  UserPlus,
  Inbox,
  ChevronRight,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Phone,
  X
} from "lucide-react";
import { subscribeToSessions, Session } from "@/app/lib/firebase/sessions";
import { subscribeToPendingBookings, PendingBooking } from "@/app/lib/firebase/requests";
import { useTranslation } from "@/app/i18n";
import { 
  LineChart,
  Line,
  XAxis, 
  ResponsiveContainer
} from 'recharts';

interface SessionDetails {
  id: string;
  client: string;
  service: string;
  time: string;
  rawTime: string;
  phone?: string;
  duration?: number;
  date: string;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<SessionDetails | null>(null);
  const [selectedWeekDay, setSelectedWeekDay] = useState<{
    dateStr: string;
    dayName: string;
    dateNum: string;
    fullDate: string;
    isToday: boolean;
  } | null>(null);
  const { t, language, isRTL } = useTranslation();

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedSession || selectedWeekDay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedSession, selectedWeekDay]);

  // Get sessions for a specific date
  const getSessionsForDate = (dateStr: string): SessionDetails[] => {
    return sessions
      .filter(s => s.date === dateStr && s.status === 'approved')
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(s => ({
        id: s.id,
        client: s.clientName,
        service: s.service,
        time: formatTime(s.time),
        rawTime: s.time,
        phone: s.phone,
        duration: s.duration,
        date: s.date,
      }));
  };

  useEffect(() => {
    const unsubscribeSessions = subscribeToSessions((sessionsData) => {
      setSessions(sessionsData);
      setLoading(false);
    });

    const unsubscribePending = subscribeToPendingBookings((bookings) => {
      setPendingBookings(bookings);
    });

    return () => {
      unsubscribeSessions();
      unsubscribePending();
    };
  }, []);

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const getTimeUntil = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const appointmentTime = new Date();
    appointmentTime.setHours(hours, minutes, 0, 0);
    const diffMs = appointmentTime.getTime() - currentTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 0) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    if (remainingMins === 0) return `${diffHours}h`;
    return `${diffHours}h ${remainingMins}m`;
  };

  const dateInfo = useMemo(() => {
    const now = new Date();
    const locale = language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US';
    return now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  }, [language]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning');
    if (hour < 17) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  }, [t]);

  // Get time-based icon
  const TimeIcon = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 8) return Sunrise;      // Early morning
    if (hour >= 8 && hour < 17) return Sun;         // Day
    if (hour >= 17 && hour < 20) return Sunset;     // Evening
    return Moon;                                     // Night
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay());

    const todaySessions = sessions.filter(s => s.date === today && s.status === 'approved');
    const weekSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date + 'T00:00:00');
      return sessionDate >= weekStart && s.status === 'approved';
    });

    return {
      today: todaySessions.length,
      week: weekSessions.length,
      pending: pendingBookings.length,
    };
  }, [sessions, pendingBookings]);

  const todaysSessions = useMemo((): SessionDetails[] => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return sessions
      .filter(s => s.date === today && s.status === 'approved' && s.time >= currentTimeStr)
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        client: s.clientName,
        service: s.service,
        time: formatTime(s.time),
        rawTime: s.time,
        phone: s.phone,
        duration: s.duration,
        date: s.date,
      }));
  }, [sessions]);

  // Current week data (Sun-Sat)
  const currentWeekData = useMemo(() => {
    const today = new Date();
    const todayIndex = today.getDay();
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const fullDayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const locale = language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US';
    
    // Get start of week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - todayIndex);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = sessions.filter(
        s => s.date === dateStr && s.status === 'approved'
      ).length;
      
      const isPast = i < todayIndex;
      
      // Format full date using locale
      const fullDate = date.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
      
      days.push({
        day: t(`days.${dayKeys[i]}`),
        fullDay: t(`days.${fullDayKeys[i]}`),
        date: date.getDate().toString(),
        dateStr,
        fullDate,
        count,
        isToday: i === todayIndex,
        isPast,
      });
    }
    
    return days;
  }, [sessions, t, language]);

  const monthlyData = useMemo(() => {
    const today = new Date();
    const weeks: { week: string; appointments: number }[] = [];
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekSessions = sessions.filter(s => {
        const sessionDate = new Date(s.date + 'T00:00:00');
        return sessionDate >= weekStart && sessionDate <= weekEnd && s.status === 'approved';
      });

      weeks.push({
        week: `W${4 - i}`,
        appointments: weekSessions.length,
      });
    }

    return weeks;
  }, [sessions]);

  const quickActions = useMemo(() => [
    { href: '/calendar', icon: Plus, label: t('dashboard.quickActions.newSession'), sub: t('dashboard.quickActions.bookAppointment'), color: 'bg-gray-900' },
    { href: '/requests', icon: Inbox, label: t('dashboard.quickActions.requests'), sub: t('dashboard.quickActions.reviewPending'), color: 'bg-amber-400', badge: pendingBookings.length },
    { href: '/availability', icon: CalendarOff, label: t('dashboard.quickActions.blockTime'), sub: t('dashboard.quickActions.setAvailability'), color: 'bg-gray-600' },
  ], [t, pendingBookings.length]);


  return (
    <div className="space-y-4 pt-3">
      {/* Hero Section - Unified Card */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="bg-gray-900 rounded-2xl p-4 sm:p-5 relative overflow-hidden"
      >
        {/* Animated bubbles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-gray-800 rounded-full opacity-50 animate-bubble-1" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gray-800 rounded-full opacity-60 animate-bubble-2" />
          <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-gray-800 rounded-full opacity-40 animate-bubble-3" />
        </div>
        
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
              <TimeIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{dateInfo}</p>
              <h1 className="text-white text-lg sm:text-xl font-semibold">{greeting}</h1>
            </div>
          </div>
          <Link
            href="/calendar"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg shadow-black/20 lg:hover:scale-105 active:scale-95 transition-transform"
            aria-label="New Session"
          >
            <Plus className="w-5 h-5 text-gray-900" strokeWidth={2.5} />
          </Link>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 sm:gap-5 relative">
          <div className="min-w-[40px]">
            {loading ? (
              <div className="h-8 w-8 rounded-lg bg-gray-700 animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-white">{stats.today}</p>
            )}
            <p className="text-gray-400 text-[10px] mt-0.5">{t('dashboard.stats.todaySessions')}</p>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="min-w-[40px]">
            {loading ? (
              <div className="h-8 w-8 rounded-lg bg-gray-700 animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-white">{stats.week}</p>
            )}
            <p className="text-gray-400 text-[10px] mt-0.5">{t('dashboard.stats.thisWeek')}</p>
          </div>
          {(loading || stats.pending > 0) && (
            <>
              <div className="w-px h-8 bg-gray-700" />
              <Link href="/requests" className="group min-w-[40px]">
                {loading ? (
                  <div className="h-8 w-8 rounded-lg bg-amber-400/30 animate-pulse" />
                ) : (
                  <p className="text-2xl sm:text-3xl font-bold text-amber-400 lg:group-hover:text-amber-300 transition-colors">
                    {stats.pending}
                  </p>
                )}
                <p className="text-gray-400 text-[10px] mt-0.5">{t('dashboard.stats.pending')}</p>
              </Link>
            </>
          )}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Schedule + Chart Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's Schedule */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-200"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{t('dashboard.schedule.title')}</h3>
              <Link href="/calendar" className="text-xs text-gray-500 lg:hover:text-gray-900 flex items-center gap-1">
                {t('dashboard.schedule.viewAll')} <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-100">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <div className="w-14 flex flex-col items-center gap-1">
                      <div className="h-4 w-10 bg-gray-200 rounded animate-pulse" />
                      <div className="h-2 w-6 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="w-px h-8 bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todaysSessions.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">{t('dashboard.schedule.noSessions')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {todaysSessions.map((booking, index) => (
                  <motion.button
                    key={booking.id}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    onClick={() => setSelectedSession(booking)}
                    className={`w-full flex items-center gap-4 p-4 lg:hover:bg-gray-100 active:bg-gray-100 transition-colors ${
                      index === 0 ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="w-14 text-center">
                      <p className="font-semibold text-sm text-gray-900">{booking.time.split(' ')[0]}</p>
                      <p className="text-[10px] text-gray-400">{booking.time.split(' ')[1]}</p>
                    </div>
                    <div className={`w-px h-8 ${index === 0 ? 'bg-gray-900' : 'bg-gray-200'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{booking.client}</p>
                      <p className="text-sm text-gray-500 truncate">{booking.service}</p>
                    </div>
                    {index === 0 && (
                      <span className="text-xs font-semibold text-white bg-gray-900 px-2.5 py-1 rounded-full">
                        {t('time.in')} {getTimeUntil(booking.rawTime)}
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* This Week */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{t('dashboard.weekChart.title')}</h3>
              </div>
              <div className="flex gap-1">
                {currentWeekData.map((item, index) => (
                  <motion.button 
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.03 }}
                    onClick={() => !item.isPast && setSelectedWeekDay({
                      dateStr: item.dateStr,
                      dayName: item.fullDay,
                      dateNum: item.date,
                      fullDate: item.fullDate,
                      isToday: item.isToday,
                    })}
                    disabled={item.isPast}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-3xl transition-colors ${
                      item.isToday 
                        ? 'bg-gray-900 text-white' 
                        : item.isPast
                          ? 'text-gray-300 cursor-not-allowed'
                          : item.count === 0 
                            ? 'text-gray-500 hover:bg-gray-100 active:bg-gray-200' 
                            : 'text-gray-900 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                  >
                    <p className={`text-[10px] font-medium uppercase ${item.isToday ? 'text-gray-400' : ''}`}>
                      {item.day}
                    </p>
                    <p className="text-lg font-semibold">
                      {item.date}
                    </p>
                    {loading ? (
                      <p className={`text-[10px] ${item.isToday ? 'text-gray-500' : 'text-gray-300'}`}>...</p>
                    ) : item.isPast ? (
                      <p className="text-[10px] text-gray-300">-</p>
                    ) : item.count > 0 ? (
                      <p className={`text-[10px] font-medium ${item.isToday ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.count}
                      </p>
                    ) : (
                      <p className={`text-[10px] ${item.isToday ? 'text-gray-500' : 'text-gray-400'}`}>-</p>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Monthly Chart */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{t('dashboard.monthlyTrend.title')}</h3>
                <span className="text-xs text-gray-500">{t('dashboard.monthlyTrend.lastWeeks')}</span>
              </div>
              <div className="h-28">
                {loading ? (
                  <div className="h-full flex items-end justify-between gap-4 px-2">
                    {[40, 65, 45, 80].map((height, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className="w-full bg-gray-100 rounded animate-pulse" 
                          style={{ height: `${height}%` }}
                        />
                        <div className="w-6 h-3 bg-gray-100 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <Line 
                        type="monotone" 
                        dataKey="appointments" 
                        stroke="#1F2937" 
                        strokeWidth={2}
                        dot={{ fill: '#1F2937', strokeWidth: 0, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Quick Actions Column */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{t('dashboard.quickActions.title')}</h3>
            <div className="space-y-1">
              {quickActions.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                >
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 p-3 rounded-xl lg:hover:bg-gray-50 transition-colors group"
                  >
                    <div className="relative">
                      <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center lg:group-hover:scale-105 transition-transform`}>
                        <item.icon className="w-4 h-4 text-white" />
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.sub}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-300 ${isRTL ? 'rotate-180' : ''}`} />
                  </Link>
                </motion.div>
              ))}
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <button disabled className="flex items-center gap-3 p-3 rounded-xl opacity-40 cursor-not-allowed w-full">
                  <div className="w-9 h-9 bg-gray-300 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-gray-500 text-sm">{t('dashboard.quickActions.addClient')}</p>
                    <p className="text-xs text-gray-400">{t('dashboard.quickActions.comingSoon')}</p>
                  </div>
                </button>
              </motion.div>
            </div>
          </div>

        </motion.div>
      </div>

      {/* Week Day Sessions Modal */}
      <AnimatePresence>
        {selectedWeekDay && (
          <>
            {/* Backdrop - extended to cover safe areas */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelectedWeekDay(null)}
              className="fixed -top-20 -left-4 -right-4 -bottom-20 bg-black/50 z-[9999]"
            />

            {/* Modal */}
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 400 }}
              className="fixed bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[380px] z-[10000]"
            >
              <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[75vh] flex flex-col">
                {/* Drag handle - mobile only */}
                <div className="md:hidden flex justify-center pt-3">
                  <div className="w-9 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 pt-4 pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[17px] font-semibold text-gray-900">
                        {selectedWeekDay.isToday ? t('common.today') : selectedWeekDay.dayName}
                      </h3>
                      <p className="text-[13px] text-gray-500">{selectedWeekDay.fullDate}</p>
                    </div>
                    <button
                      onClick={() => setSelectedWeekDay(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto border-t border-gray-100">
                  {(() => {
                    const daySessions = getSessionsForDate(selectedWeekDay.dateStr);
                    
                    if (daySessions.length === 0) {
                      return (
                        <div className="py-10 px-5 text-center">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                            <Calendar className="w-5 h-5 text-gray-400" />
                          </div>
                          <p className="text-[15px] font-medium text-gray-900">{t('dashboard.weekDayModal.noSessions')}</p>
                          <p className="text-[13px] text-gray-500 mt-0.5">{t('dashboard.weekDayModal.scheduleClear')}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="divide-y divide-gray-100">
                        {daySessions.map((session, index) => (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className="flex items-center gap-4 px-5 py-3.5"
                          >
                            {/* Time */}
                            <div className="w-14 flex-shrink-0 text-center">
                              <p className="text-[15px] font-semibold text-gray-900">
                                {session.time.split(' ')[0]}
                              </p>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                                {session.time.split(' ')[1]}
                              </p>
                            </div>

                            {/* Vertical line */}
                            <div className="w-0.5 h-9 bg-gray-200 rounded-full flex-shrink-0" />

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-medium text-gray-900 truncate">
                                {session.client}
                              </p>
                              <p className="text-[13px] text-gray-500 truncate">
                                {session.service}
                                {session.duration && (
                                  <span className="text-gray-400"> · {session.duration}m</span>
                                )}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
                  <Link
                    href={`/calendar?date=${selectedWeekDay.dateStr}`}
                    onClick={() => setSelectedWeekDay(null)}
                    className="w-full flex items-center justify-center h-11 bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white font-medium text-[15px] rounded-xl transition-colors"
                  >
                    {t('dashboard.weekDayModal.openInCalendar')}
                  </Link>
                </div>

                {/* Safe area for iPhone */}
                <div className="h-6 md:hidden" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Session Details Modal - Premium Design */}
      <AnimatePresence>
        {selectedSession && (
          <>
            {/* Backdrop - extended to cover safe areas */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelectedSession(null)}
              className="fixed -top-20 -left-4 -right-4 -bottom-20 bg-black/50 z-[9999]"
            />

            {/* Modal - Bottom sheet on mobile, centered on desktop */}
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 400 }}
              className="fixed bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[360px] z-[10000]"
            >
              <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl">
                {/* Drag handle - mobile only */}
                <div className="md:hidden flex justify-center pt-3">
                  <div className="w-9 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Content */}
                <div className="px-5 pt-5 pb-6">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      {/* Avatar with initial */}
                      <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-semibold text-[15px]">
                        {selectedSession.client.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-[17px] font-semibold text-gray-900 leading-tight">
                          {selectedSession.client}
                        </h3>
                        <p className="text-[13px] text-gray-500 mt-0.5">{selectedSession.service}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors -mr-1"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Time display - clean and prominent */}
                  <div className="flex items-center justify-between py-4 border-y border-gray-100">
                    <div>
                      <p className="text-[28px] font-semibold text-gray-900 tracking-tight leading-none">
                        {selectedSession.time}
                      </p>
                      {selectedSession.duration && (
                        <p className="text-[13px] text-gray-400 mt-1">
                          {selectedSession.duration} {t('dashboard.sessionModal.minSession')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] text-gray-400">{t('dashboard.sessionModal.startsIn')}</p>
                      <p className="text-[17px] font-semibold text-gray-900">{getTimeUntil(selectedSession.rawTime)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2.5 mt-5">
                    {selectedSession.phone && (
                      <a
                        href={`tel:${selectedSession.phone.replace(/\D/g, '')}`}
                        className="h-12 w-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl transition-colors"
                        aria-label="Call client"
                      >
                        <Phone className="w-5 h-5 text-gray-700" />
                      </a>
                    )}
                    <Link
                      href={`/calendar?date=${selectedSession.date}`}
                      onClick={() => setSelectedSession(null)}
                      className="flex-1 flex items-center justify-center gap-2 h-12 bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white font-medium text-[15px] rounded-xl transition-colors"
                    >
                      {t('dashboard.sessionModal.viewFullDetails')}
                    </Link>
                  </div>
                </div>

                {/* Safe area for iPhone */}
                <div className="h-6 md:hidden" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
