import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  deleteDoc, 
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import { db, auth } from './config';

export interface PendingBooking {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  service: string;
  serviceId?: string; // Reference to service document
  date: string;
  time: string;
  duration?: string;
  notes?: string;
  amount?: string;
  createdAt?: Timestamp | Date;
  [key: string]: any; // Allow additional fields
}

/**
 * Get all pending bookings (Admin only)
 */
export const getAllPendingBookings = async (): Promise<PendingBooking[]> => {
  try {
    const pendingRef = collection(db, 'pendingBookings');
    const snapshot = await getDocs(pendingRef);
    
    // Sort in memory to avoid index requirements
    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        // Remove any custom 'id' field from data to avoid conflicts
        delete (data as any).id;
        return {
          ...data,
          id: doc.id  // Use Firestore document ID
        } as PendingBooking;
      })
      .sort((a, b) => {
        const dateA = (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt) 
          ? (a.createdAt as Timestamp).toDate() 
          : (a.createdAt instanceof Date ? a.createdAt : new Date(a.date));
        const dateB = (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt) 
          ? (b.createdAt as Timestamp).toDate() 
          : (b.createdAt instanceof Date ? b.createdAt : new Date(b.date));
        return dateB.getTime() - dateA.getTime(); // desc order (newest first)
      });
  } catch (error) {
    console.error('Error getting pending bookings:', error);
    return [];
  }
};

/**
 * Subscribe to real-time pending bookings updates (Admin only)
 * Returns an unsubscribe function that should be called to stop listening
 * 
 * @param callback - Called with updated pending bookings array whenever data changes
 * @returns Unsubscribe function
 */
const processPendingBookings = (docs: any[]): PendingBooking[] => {
  return docs
    .map(doc => {
      const data = doc.data();
      // Remove any custom 'id' field from data to avoid conflicts
      delete (data as any).id;
      return {
        ...data,
        id: doc.id  // Use Firestore document ID
      } as PendingBooking;
    })
    .sort((a, b) => {
      const dateA = (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt) 
        ? (a.createdAt as Timestamp).toDate() 
        : (a.createdAt instanceof Date ? a.createdAt : new Date(a.date));
      const dateB = (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt) 
        ? (b.createdAt as Timestamp).toDate() 
        : (b.createdAt instanceof Date ? b.createdAt : new Date(b.date));
      return dateB.getTime() - dateA.getTime(); // desc order
    });
};

export const subscribeToPendingBookings = (
  callback: (bookings: PendingBooking[]) => void
): (() => void) => {
  try {
    const pendingRef = collection(db, 'pendingBookings');
    
    // Initial fetch to ensure data loads immediately
    getDocs(pendingRef).then((snapshot) => {
      const pendingBookings = processPendingBookings(snapshot.docs);
      callback(pendingBookings);
    }).catch((error) => {
      console.error('Error in initial pending bookings fetch:', error);
      callback([]);
    });
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(pendingRef, (snapshot) => {
      const pendingBookings = processPendingBookings(snapshot.docs);
      callback(pendingBookings);
    }, (error) => {
      console.error('Error in pending bookings listener:', error);
      callback([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up pending bookings listener:', error);
    return () => {};
  }
};

/**
 * Approve a pending booking (Admin only)
 * Moves from pendingBookings to sessions
 */
export const approvePendingBooking = async (bookingId: string): Promise<boolean> => {
  try {
    console.log('Approving booking with ID:', bookingId);
    
    // Verify user is authenticated and get fresh token
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to approve bookings');
    }
    console.log('User authenticated:', user.email);
    
    // Get the auth token to ensure it's ready
    try {
      const token = await user.getIdToken();
      console.log('Auth token retrieved, user ID:', user.uid);
    } catch (tokenError) {
      console.error('Error getting auth token:', tokenError);
      throw new Error('Authentication token not available');
    }
    
    // Validate bookingId is a string
    if (!bookingId || typeof bookingId !== 'string') {
      throw new Error(`Invalid booking ID: ${bookingId}`);
    }
    
    // Get the specific pending booking
    const docRef = doc(db, 'pendingBookings', bookingId);
    const pendingDoc = await getDoc(docRef);
    
    if (!pendingDoc.exists()) {
      throw new Error(`Booking not found in Firebase. Searched for ID: ${bookingId}`);
    }
    
    const bookingData = pendingDoc.data();
    console.log('Booking data to approve:', bookingData);
    
    // Security rules require: clientName, phone, date, time, endTime, duration, service, status
    // Duration must be divisible by 15 (round to nearest 15)
    let duration = bookingData.duration || 60;
    if (typeof duration === 'string') {
      // Extract number from string like "60 min"
      const numMatch = duration.match(/\d+/);
      duration = numMatch ? parseInt(numMatch[0]) : 60;
    }
    // Round to nearest 15-minute increment (required by security rules)
    duration = Math.round(duration / 15) * 15;
    if (duration <= 0) duration = 15; // Minimum 15 minutes
    
    // Ensure endTime exists (required by security rules)
    let endTime = bookingData.endTime;
    if (!endTime && bookingData.time && duration) {
      // Calculate endTime if not present
      const [hours, minutes] = bookingData.time.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(startDate.getTime() + duration * 60000);
      const endHours = endDate.getHours().toString().padStart(2, '0');
      const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
      endTime = `${endHours}:${endMinutes}`;
    }
    
    // Build session data with ALL required fields for security rules
    const sessionData: any = {
      clientName: bookingData.clientName,
      phone: bookingData.phone,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      endTime: endTime, // REQUIRED by security rules
      duration: duration, // REQUIRED by security rules (must be divisible by 15)
      status: 'approved', // REQUIRED by security rules
    };
    
    // Add serviceId for multi-language service name lookups
    if (bookingData.serviceId) sessionData.serviceId = bookingData.serviceId;
    
    // Add optional fields if they exist
    if (bookingData.email) sessionData.email = bookingData.email;
    if (bookingData.notes) sessionData.notes = bookingData.notes;
    if (bookingData.amount) sessionData.amount = bookingData.amount;
    
    console.log('Session data to create (with required fields):', sessionData);
    
    // Create session using Cloud Function (centralized validation and logging)
    const createSessionFn = httpsCallable(functions, 'createSession');
    try {
      const result = await createSessionFn({
        ...sessionData,
      });
      
      const data = result.data as { success: boolean; sessionId: string; message?: string };
      
      if (!data.success || !data.sessionId) {
        throw new Error(data.message || 'Failed to create session');
      }
      
      console.log('✅ Created new session:', data.sessionId);
    } catch (addError: any) {
      console.error('❌ Failed to create session:', addError);
      // Extract error message from Firebase HttpsError
      const errorMessage = addError.message || addError.details?.message || 'Failed to create session';
      throw new Error(errorMessage);
    }
    
    // Delete from pending bookings
    try {
      await deleteDoc(docRef);
      console.log('✅ Deleted pending booking');
    } catch (deleteError: any) {
      console.error('❌ Failed to delete pending booking:', deleteError);
      // Don't throw here - session was created, so we should continue
      // The pending booking will be cleaned up later
    }
    
    console.log('Booking approved successfully');
    return true;
  } catch (error) {
    console.error('Error approving booking:', error);
    throw error;
  }
};

/**
 * Reject a pending booking (Admin only)
 * Removes from pendingBookings
 */
export const rejectPendingBooking = async (bookingId: string): Promise<boolean> => {
  try {
    console.log('Rejecting booking with ID:', bookingId);
    
    // Validate bookingId is a string
    if (!bookingId || typeof bookingId !== 'string') {
      throw new Error(`Invalid booking ID: ${bookingId}`);
    }
    
    const pendingRef = doc(db, 'pendingBookings', bookingId);
    await deleteDoc(pendingRef);
    
    console.log('Booking rejected successfully');
    return true;
  } catch (error) {
    console.error('Error rejecting booking:', error);
    throw error;
  }
};

