"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, TrendingUp, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { subscribeToSessions, Session } from "@/app/lib/firebase/sessions";
import { subscribeToPendingBookings, PendingBooking } from "@/app/lib/firebase/requests";

// Direct import instead of dynamic to debug chart rendering issue
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time data
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

  // Helper to format time (HH:MM to 12-hour format)
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // Calculate stats from real data
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay()); // Start of week (Sunday)
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const todaySessions = sessions.filter(s => s.date === today && s.status === 'approved');
    const weekSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date + 'T00:00:00');
      return sessionDate >= weekStart && s.status === 'approved';
    });
    const monthSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date + 'T00:00:00');
      return sessionDate >= monthStart && s.status === 'approved';
    });

    return [
      {
        name: "Today",
        value: todaySessions.length.toString(),
        description: "Appointments",
        icon: Calendar,
      },
      {
        name: "This Week",
        value: weekSessions.length.toString(),
        description: "Appointments",
        icon: TrendingUp,
      },
      {
        name: "Pending",
        value: pendingBookings.length.toString(),
        description: "Requests",
        icon: Clock,
      },
      {
        name: "This Month",
        value: monthSessions.length.toString(),
        description: "Appointments",
        icon: Calendar,
      },
    ];
  }, [sessions, pendingBookings]);

  // Get today's upcoming sessions
  const todaysSessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return sessions
      .filter(s => s.date === today && s.status === 'approved' && s.time >= currentTime)
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 4)
      .map(s => ({
        id: s.id,
        client: s.clientName,
        service: s.service,
        time: formatTime(s.time),
        status: 'confirmed' as const,
      }));
  }, [sessions]);

  // Calculate weekly data
  const weeklyData = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekData = days.map(day => ({ day, appointments: 0 }));

    const weekSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date + 'T00:00:00');
      return sessionDate >= weekStart && s.status === 'approved';
    });

    weekSessions.forEach(s => {
      const sessionDate = new Date(s.date + 'T00:00:00');
      const dayIndex = sessionDate.getDay();
      weekData[dayIndex].appointments++;
    });

    return weekData;
  }, [sessions]);

  // Calculate monthly data (last 4 weeks)
  const monthlyData = useMemo(() => {
    const today = new Date();
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(today.getDate() - 28);
    
    const weeks: { week: string; appointments: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekSessions = sessions.filter(s => {
        const sessionDate = new Date(s.date + 'T00:00:00');
        return sessionDate >= weekStart && sessionDate <= weekEnd && s.status === 'approved';
      });

      weeks.push({
        week: `Week ${4 - i}`,
        appointments: weekSessions.length,
      });
    }

    return weeks;
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Page header - hidden on mobile */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      </div>

      {/* Stats grid - 2x2 on all screens */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {stats.map((stat, index) => (
          <div
            key={stat.name}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <stat.icon className="w-5 h-5 text-gray-700" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-0.5">{stat.value}</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900">{stat.name}</p>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Overview Chart */}
        <div
          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">This Week</h3>
              <p className="text-xs text-gray-500 mt-0.5">Daily appointments</p>
            </div>
          </div>
          <div className="h-48 sm:h-56" style={{ minHeight: '192px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis 
                  dataKey="day" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '12px',
                    padding: '8px 12px'
                  }}
                />
                <Bar 
                  dataKey="appointments" 
                  fill="#1F2937" 
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div
          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Monthly Trend</h3>
              <p className="text-xs text-gray-500 mt-0.5">Weekly breakdown</p>
            </div>
          </div>
          <div className="h-48 sm:h-56" style={{ minHeight: '192px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis 
                  dataKey="week" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '12px',
                    padding: '8px 12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="appointments" 
                  stroke="#1F2937" 
                  strokeWidth={3}
                  dot={{ fill: '#1F2937', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div
        className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Today's Schedule</h3>
            <p className="text-xs text-gray-500 mt-0.5">Upcoming appointments</p>
          </div>
          <button className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1">
            View all
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {todaysSessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No upcoming appointments today</p>
            </div>
          ) : (
            todaysSessions.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-semibold text-gray-600">
                    {booking.client.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {booking.client}
                    </h4>
                    {booking.status === "confirmed" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 truncate">{booking.service}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-medium text-gray-900">{booking.time}</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                    booking.status === "confirmed" 
                      ? "bg-green-100 text-green-700" 
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
