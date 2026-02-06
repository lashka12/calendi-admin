import { collection, doc, deleteDoc, onSnapshot, getDocs, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './config';

export interface Session {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  service: string; // Cached service name (fallback if service deleted)
  serviceId?: string; // Reference to service document for dynamic lookups
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration?: number; // in minutes
  notes?: string;
  amount?: string | number;
  status: string; // 'approved', 'completed', 'cancelled'
  createdAt?: Timestamp;
  approvedAt?: Timestamp;
}

/**
 * Subscribe to real-time sessions updates (Admin only)
 * Returns an unsubscribe function that should be called to stop listening
 * 
 * Fetches all approved sessions and filters client-side to avoid Firestore index requirements
 * 
 * @param callback - Called with updated sessions array whenever data changes
 * @param filters - Optional filters for date range or status (applied client-side)
 * @returns Unsubscribe function
 */
const processSessions = (
  docs: any[],
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }
): Session[] => {
  return docs
    .map(doc => {
      const data = doc.data();
      // Remove any custom 'id' field from data to avoid conflicts
      delete (data as any).id;
      return {
        ...data,
        id: doc.id
      } as Session;
    })
    .filter(session => {
      // Client-side filtering
      const statusFilter = filters?.status || 'approved';
      if (session.status !== statusFilter) return false;
      
      if (filters?.startDate && session.date < filters.startDate) return false;
      if (filters?.endDate && session.date > filters.endDate) return false;
      
      return true;
    })
    .sort((a, b) => {
      // Sort by date, then by time
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
};

export const subscribeToSessions = (
  callback: (sessions: Session[]) => void,
  filters?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    status?: string;
  }
): (() => void) => {
  try {
    const sessionsRef = collection(db, 'sessions');
    
    // Initial fetch to ensure data loads immediately
    getDocs(sessionsRef).then((snapshot) => {
      const sessions = processSessions(snapshot.docs, filters);
      callback(sessions);
    }).catch((error) => {
      console.error('Error in initial sessions fetch:', error);
      callback([]);
    });
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const sessions = processSessions(snapshot.docs, filters);
      callback(sessions);
    }, (error) => {
      console.error('Error in sessions listener:', error);
      callback([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up sessions listener:', error);
    return () => {};
  }
};

/**
 * Get sessions for a specific date
 */
export const getSessionsForDate = (sessions: Session[], dateString: string): Session[] => {
  return sessions.filter(session => session.date === dateString);
};

/**
 * Create a new session (Admin only)
 * Calls Cloud Function for centralized validation and logging
 */
const createSessionFn = httpsCallable(functions, 'createSession');

export const createSession = async (sessionData: {
  clientName: string;
  phone: string;
  email?: string;
  service: string;
  serviceId?: string; // Reference to service document
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration?: number; // in minutes
  endTime?: string; // HH:MM
  notes?: string;
  amount?: string | number;
}): Promise<string> => {
  try {
    console.log('📅 [createSession] Calling Cloud Function with data:', sessionData);
    
    const result = await createSessionFn({
      ...sessionData,
    });
    
    const data = result.data as { success: boolean; sessionId: string; message?: string };
    
    if (!data.success || !data.sessionId) {
      throw new Error(data.message || 'Failed to create session');
    }
    
    console.log('✅ [createSession] Session created successfully:', data.sessionId);
    return data.sessionId;
  } catch (error: any) {
    console.error('❌ [createSession] Error creating session:', error);
    // Extract error message from Firebase HttpsError
    const errorMessage = error.message || error.details?.message || 'Failed to create session';
    throw new Error(errorMessage);
  }
};

/**
 * Cancel/delete a session (Admin only)
 */
export const cancelSession = async (sessionId: string): Promise<boolean> => {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    await deleteDoc(sessionRef);
    console.log('✅ Session cancelled successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Error cancelling session:', error);
    throw error;
  }
};

/**
 * Calculate end time from start time and duration
 */
export const calculateEndTime = (startTime: string, durationMinutes?: number): string => {
  if (!durationMinutes) {
    // Default to 60 minutes if no duration specified
    durationMinutes = 60;
  }
  
  const [hours, minutes] = startTime.split(':').map(Number);
  const startDate = new Date();
  startDate.setHours(hours, minutes, 0, 0);
  
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const endHours = endDate.getHours().toString().padStart(2, '0');
  const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
  
  return `${endHours}:${endMinutes}`;
};

