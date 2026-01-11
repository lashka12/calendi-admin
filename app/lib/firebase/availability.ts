import { httpsCallable } from 'firebase/functions';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  DocumentData 
} from 'firebase/firestore';
import { functions, db } from './config';

// Types
export interface TimeSlot {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface WeeklyTemplate {
  monday?: TimeSlot[];
  tuesday?: TimeSlot[];
  wednesday?: TimeSlot[];
  thursday?: TimeSlot[];
  friday?: TimeSlot[];
  saturday?: TimeSlot[];
  sunday?: TimeSlot[];
}

export interface PlannedDate {
  id?: string;
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
}

export interface SpecialDay {
  id: string;
  name: string;
  dates: string[]; // YYYY-MM-DD[]
  recurring: boolean;
  recurringPattern?: string;
  isClosed: boolean;
}

export interface BookingCheck {
  hasBookings: boolean;
  count: number;
  sessions: Array<{
    id: string;
    clientName: string;
    time: string;
    service: string;
  }>;
  pendingBookings: Array<{
    id: string;
    clientName: string;
    time: string;
    service: string;
  }>;
}

// Cloud Function references
const checkBookingsForDateFn = httpsCallable(functions, 'checkBookingsForDate');
const checkBookingsForTimeRangeFn = httpsCallable(functions, 'checkBookingsForTimeRange');
const getAvailableTimeSlotsFn = httpsCallable(functions, 'getAvailableTimeSlots');
const setWeeklyTemplateFn = httpsCallable(functions, 'setWeeklyTemplate');
const setPlannedDateFn = httpsCallable(functions, 'setPlannedDate');
const deletePlannedDateFn = httpsCallable(functions, 'deletePlannedDate');
const setSpecialDayFn = httpsCallable(functions, 'setSpecialDay');
const deleteSpecialDayFn = httpsCallable(functions, 'deleteSpecialDay');

/**
 * Check if a date has existing bookings
 */
export const checkBookingsForDate = async (date: string): Promise<BookingCheck> => {
  try {
    const result = await checkBookingsForDateFn({ date });
    return result.data as BookingCheck;
  } catch (error: any) {
    console.error('Error checking bookings for date:', error);
    throw error;
  }
};

/**
 * Check if a time range has existing bookings
 */
export const checkBookingsForTimeRange = async (
  date: string,
  startTime: string,
  endTime: string
): Promise<BookingCheck> => {
  try {
    const result = await checkBookingsForTimeRangeFn({ date, startTime, endTime });
    return result.data as BookingCheck;
  } catch (error: any) {
    console.error('Error checking bookings for time range:', error);
    throw error;
  }
};

/**
 * Get available time slots for a date
 * @param date - Date in YYYY-MM-DD format
 * @param serviceId - Optional service ID (filters slots based on service duration)
 * @param excludeSessionId - Optional session ID to exclude from booked times (for editing existing sessions)
 * @returns Array of available time slots (HH:MM format)
 */
export const getAvailableTimeSlots = async (
  date: string,
  serviceId?: string,
  excludeSessionId?: string
): Promise<string[]> => {
  try {
    const result = await getAvailableTimeSlotsFn({
      date,
      serviceId: serviceId || undefined,
      excludeSessionId: excludeSessionId || undefined
    });
    
    const data = result.data as { success?: boolean; slots?: string[] };
    if (data.success && Array.isArray(data.slots)) {
      return data.slots;
    }
    
    return [];
  } catch (error: any) {
    console.error('Error getting available slots:', error);
    throw error;
  }
};

/**
 * Set weekly template
 */
export const setWeeklyTemplate = async (template: WeeklyTemplate): Promise<void> => {
  try {
    await setWeeklyTemplateFn({ template });
  } catch (error: any) {
    console.error('Error setting weekly template:', error);
    if (error.code === 'functions/failed-precondition') {
      throw new Error(error.message || 'Cannot update weekly template. There are existing bookings in removed time slots.');
    }
    throw error;
  }
};

/**
 * Set planned date
 */
export const setPlannedDate = async (date: string, slots: TimeSlot[]): Promise<void> => {
  try {
    await setPlannedDateFn({ date, slots });
  } catch (error: any) {
    console.error('Error setting planned date:', error);
    if (error.code === 'functions/failed-precondition') {
      throw new Error(error.message || 'Cannot update planned date. There are existing bookings in removed time slots.');
    }
    throw error;
  }
};

/**
 * Delete planned date
 */
export const deletePlannedDate = async (date: string): Promise<void> => {
  try {
    await deletePlannedDateFn({ date });
  } catch (error: any) {
    console.error('Error deleting planned date:', error);
    if (error.code === 'functions/failed-precondition') {
      throw new Error(error.message || 'Cannot delete planned date. There are existing bookings on this date.');
    }
    throw error;
  }
};

/**
 * Set special day
 */
export const setSpecialDay = async (
  specialDay: Omit<SpecialDay, 'isClosed' | 'id'> & { id?: string }
): Promise<void> => {
  try {
    await setSpecialDayFn({
      id: specialDay.id,
      name: specialDay.name,
      dates: specialDay.dates,
      recurring: specialDay.recurring,
      recurringPattern: specialDay.recurringPattern,
    });
  } catch (error: any) {
    console.error('Error setting special day:', error);
    if (error.code === 'functions/failed-precondition') {
      throw new Error(error.message || 'Cannot block date. There are existing bookings on this date.');
    }
    throw error;
  }
};

/**
 * Delete special day
 */
export const deleteSpecialDay = async (id: string): Promise<void> => {
  try {
    await deleteSpecialDayFn({ id });
  } catch (error: any) {
    console.error('Error deleting special day:', error);
    throw error;
  }
};

// ============================================
// FIRESTORE READ FUNCTIONS
// ============================================

/**
 * Get weekly template from Firestore
 */
export const getWeeklyTemplate = async (): Promise<WeeklyTemplate | null> => {
  try {
    const templateRef = doc(db, 'settings', 'weeklyTemplate');
    const templateDoc = await getDoc(templateRef);
    
    if (!templateDoc.exists()) {
      return null;
    }
    
    const data = templateDoc.data();
    // Remove metadata fields
    const { updatedAt, updatedBy, createdAt, createdBy, ...template } = data;
    return template as WeeklyTemplate;
  } catch (error: any) {
    console.error('Error getting weekly template:', error);
    throw error;
  }
};

/**
 * Subscribe to weekly template changes
 */
export const subscribeToWeeklyTemplate = (
  callback: (template: WeeklyTemplate | null) => void
): (() => void) => {
  try {
    const templateRef = doc(db, 'settings', 'weeklyTemplate');
    
    const unsubscribe = onSnapshot(templateRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      
      const data = snapshot.data();
      const { updatedAt, updatedBy, createdAt, createdBy, ...template } = data;
      callback(template as WeeklyTemplate);
    }, (error) => {
      console.error('Error in weekly template listener:', error);
      callback(null);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up weekly template listener:', error);
    return () => {};
  }
};

/**
 * Get all planned dates from Firestore
 */
export const getPlannedDates = async (): Promise<PlannedDate[]> => {
  try {
    const plannedRef = collection(db, 'plannedDates');
    const snapshot = await getDocs(plannedRef);
    
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      date: doc.data().date as string,
      slots: doc.data().slots as TimeSlot[],
    }));
  } catch (error: any) {
    console.error('Error getting planned dates:', error);
    throw error;
  }
};

/**
 * Subscribe to planned dates changes
 */
export const subscribeToPlannedDates = (
  callback: (plannedDates: PlannedDate[]) => void
): (() => void) => {
  try {
    const plannedRef = collection(db, 'plannedDates');
    
    const unsubscribe = onSnapshot(plannedRef, (snapshot) => {
      const plannedDates = snapshot.docs.map((doc) => ({
        id: doc.id,
        date: doc.data().date as string,
        slots: doc.data().slots as TimeSlot[],
      }));
      callback(plannedDates);
    }, (error) => {
      console.error('Error in planned dates listener:', error);
      callback([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up planned dates listener:', error);
    return () => {};
  }
};

/**
 * Get planned date for specific date
 */
export const getPlannedDate = async (date: string): Promise<PlannedDate | null> => {
  try {
    const plannedRef = collection(db, 'plannedDates');
    const q = query(plannedRef, where('date', '==', date));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      date: doc.data().date as string,
      slots: doc.data().slots as TimeSlot[],
    };
  } catch (error: any) {
    console.error('Error getting planned date:', error);
    throw error;
  }
};

/**
 * Get all special days from Firestore
 */
export const getSpecialDays = async (): Promise<SpecialDay[]> => {
  try {
    const specialRef = collection(db, 'specialDays');
    const snapshot = await getDocs(specialRef);
    
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name as string,
        dates: data.dates as string[],
        recurring: data.recurring as boolean,
        recurringPattern: data.recurringPattern as string | undefined,
        isClosed: data.isClosed as boolean,
      };
    });
  } catch (error: any) {
    console.error('Error getting special days:', error);
    throw error;
  }
};

/**
 * Subscribe to special days changes
 */
export const subscribeToSpecialDays = (
  callback: (specialDays: SpecialDay[]) => void
): (() => void) => {
  try {
    const specialRef = collection(db, 'specialDays');
    
    const unsubscribe = onSnapshot(specialRef, (snapshot) => {
      const specialDays = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name as string,
          dates: data.dates as string[],
          recurring: data.recurring as boolean,
          recurringPattern: data.recurringPattern as string | undefined,
          isClosed: data.isClosed as boolean,
        };
      });
      callback(specialDays);
    }, (error) => {
      console.error('Error in special days listener:', error);
      callback([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up special days listener:', error);
    return () => {};
  }
};

