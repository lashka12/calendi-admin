import { collection, doc, addDoc, deleteDoc, onSnapshot, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface BlacklistedClient {
  id: string;
  phone: string;
  clientName: string;
  reason: string;
  dateAdded: Timestamp | Date;
}

/**
 * Subscribe to real-time blacklist updates (Admin only)
 * Returns an unsubscribe function that should be called to stop listening
 * 
 * @param callback - Called with updated blacklist array whenever data changes
 * @returns Unsubscribe function
 */
export const subscribeToBlacklist = (
  callback: (clients: BlacklistedClient[]) => void
): (() => void) => {
  try {
    const blacklistRef = collection(db, 'blacklist');
    
    const unsubscribe = onSnapshot(blacklistRef, (snapshot) => {
      const clients = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id
          } as BlacklistedClient;
        })
        .sort((a, b) => {
          // Sort by date added (most recent first)
          const dateA = (a.dateAdded && typeof a.dateAdded === 'object' && 'toDate' in a.dateAdded) 
            ? (a.dateAdded as Timestamp).toDate() 
            : (a.dateAdded instanceof Date ? a.dateAdded : new Date());
          const dateB = (b.dateAdded && typeof b.dateAdded === 'object' && 'toDate' in b.dateAdded) 
            ? (b.dateAdded as Timestamp).toDate() 
            : (b.dateAdded instanceof Date ? b.dateAdded : new Date());
          return dateB.getTime() - dateA.getTime();
        });
      
      callback(clients);
    }, (error) => {
      console.error('Error in blacklist listener:', error);
      callback([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up blacklist listener:', error);
    return () => {};
  }
};

/**
 * Add a client to the blacklist (Admin only)
 * @param clientData - { phone, clientName, reason }
 * @returns Document ID
 */
export const addToBlacklist = async (clientData: {
  phone: string;
  clientName: string;
  reason: string;
}): Promise<string> => {
  try {
    // Check if already blacklisted
    const existing = await checkIfBlacklisted(clientData.phone);
    if (existing) {
      throw new Error('Client is already blacklisted');
    }

    const blacklistRef = collection(db, 'blacklist');
    const docRef = await addDoc(blacklistRef, {
      phone: clientData.phone.trim(),
      clientName: clientData.clientName.trim(),
      reason: clientData.reason.trim(),
      dateAdded: Timestamp.now(),
    });

    return docRef.id;
  } catch (error: any) {
    console.error('Error adding to blacklist:', error);
    throw error;
  }
};


/**
 * Remove a client from the blacklist (Admin only)
 * @param blacklistId - Document ID
 */
export const removeFromBlacklist = async (blacklistId: string): Promise<boolean> => {
  try {
    const blacklistRef = doc(db, 'blacklist', blacklistId);
    await deleteDoc(blacklistRef);
    console.log('✅ Client removed from blacklist');
    return true;
  } catch (error: any) {
    console.error('❌ Error removing from blacklist:', error);
    throw error;
  }
};

/**
 * Check if a phone number is blacklisted
 * @param phone - Phone number to check
 * @returns Blacklist entry or null
 */
export const checkIfBlacklisted = async (phone: string): Promise<BlacklistedClient | null> => {
  try {
    const blacklistRef = collection(db, 'blacklist');
    const q = query(blacklistRef, where('phone', '==', phone.trim()));
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      ...data,
      id: doc.id
    } as BlacklistedClient;
  } catch (error: any) {
    console.error('Error checking blacklist:', error);
    // Return null on error (don't block operations)
    return null;
  }
};

