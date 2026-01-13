"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  Sunset
} from "lucide-react";
import { subscribeToSessions, Session } from "@/app/lib/firebase/sessions";
import { subscribeToPendingBookings, PendingBooking } from "@/app/lib/firebase/requests";
import { 
  LineChart,
  Line,
  XAxis, 
  ResponsiveContainer
} from 'recharts';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

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

  const todaysSessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return sessions
      .filter(s => s.date === today && s.status === 'approved' && s.time >= currentTime)
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        client: s.clientName,
        service: s.service,
        time: formatTime(s.time),
        rawTime: s.time,
      }));
  }, [sessions]);

  // Current week data (Sun-Sat)
  const currentWeekData = useMemo(() => {
    const today = new Date();
    const todayIndex = today.getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
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
      
      days.push({
        day: dayNames[i],
        date: date.getDate().toString(),
        count,
        isToday: i === todayIndex,
        isPast,
      });
    }
    
    return days;
  }, [sessions]);

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

  const quickActions = [
    { href: '/calendar', icon: Plus, label: 'New Session', sub: 'Book appointment', color: 'bg-gray-900' },
    { href: '/requests', icon: Inbox, label: 'Requests', sub: 'Review pending', color: 'bg-amber-500', badge: pendingBookings.length },
    { href: '/availability', icon: CalendarOff, label: 'Block Time', sub: 'Set availability', color: 'bg-gray-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

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
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.today}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">Today</p>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.week}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">This week</p>
          </div>
          {stats.pending > 0 && (
            <>
              <div className="w-px h-8 bg-gray-700" />
              <Link href="/requests" className="group">
                <p className="text-2xl sm:text-3xl font-bold text-amber-400 lg:group-hover:text-amber-300 transition-colors">{stats.pending}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">Pending</p>
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
              <h3 className="font-semibold text-gray-900">Today's Schedule</h3>
              <Link href="/calendar" className="text-xs text-gray-500 lg:hover:text-gray-900 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {todaysSessions.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No more appointments today</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {todaysSessions.map((booking, index) => (
                  <motion.div 
                    key={booking.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className={`flex items-center gap-4 p-4 lg:hover:bg-gray-50 transition-colors ${
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
                        in {getTimeUntil(booking.rawTime)}
                      </span>
                    )}
                  </motion.div>
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
                <h3 className="font-semibold text-gray-900">This Week</h3>
              </div>
              <div className="flex gap-1.5">
                {currentWeekData.map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.03 }}
                    className={`flex-1 text-center py-2 px-1 rounded-lg ${
                      item.isToday 
                        ? 'bg-gray-900 text-white' 
                        : item.isPast
                          ? 'bg-gray-50 text-gray-300'
                          : item.count === 0 
                            ? 'bg-gray-50 text-gray-400' 
                            : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className={`text-[9px] font-medium ${item.isToday ? 'text-gray-400' : ''}`}>
                      {item.day}
                    </p>
                    <p className="text-base font-bold">
                      {item.date}
                    </p>
                    {item.isPast ? (
                      <p className="text-[9px]">-</p>
                    ) : item.count > 0 ? (
                      <p className={`text-[9px] ${item.isToday ? 'text-gray-300' : 'text-gray-500'}`}>
                        {item.count}
                      </p>
                    ) : (
                      <p className="text-[9px]">-</p>
                    )}
                  </motion.div>
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
                <h3 className="font-semibold text-gray-900">Monthly Trend</h3>
                <span className="text-xs text-gray-500">Last 4 weeks</span>
              </div>
              <div className="h-28">
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
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
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
                    className="flex items-center gap-3 p-3 rounded-xl lg:hover:bg-gray-50 transition-colors group relative"
                  >
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                    <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center lg:group-hover:scale-105 transition-transform`}>
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
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
                    <p className="font-medium text-gray-500 text-sm">Add Client</p>
                    <p className="text-xs text-gray-400">Coming soon</p>
                  </div>
                </button>
              </motion.div>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
