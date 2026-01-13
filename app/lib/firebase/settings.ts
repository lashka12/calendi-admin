import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';

/**
 * Business settings stored in Firestore at settings/businessSettings
 */
export interface BusinessSettings {
  businessName: string;
  establishedYear?: number;
  timezone: string;
  slotDuration: number;
  currency: string;
  description?: string;
}

/**
 * Default settings used as fallback
 */
export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: 'My Business',
  timezone: 'Asia/Jerusalem',
  slotDuration: 15,
  currency: 'ILS',
};

/**
 * Subscribe to real-time business settings updates
 * Returns an unsubscribe function
 */
export const subscribeToBusinessSettings = (
  callback: (settings: BusinessSettings) => void
): (() => void) => {
  try {
    const settingsRef = doc(db, 'settings', 'businessSettings');
    
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          businessName: data.businessName || DEFAULT_SETTINGS.businessName,
          establishedYear: data.establishedYear,
          timezone: data.timezone || DEFAULT_SETTINGS.timezone,
          slotDuration: data.slotDuration || DEFAULT_SETTINGS.slotDuration,
          currency: data.currency || DEFAULT_SETTINGS.currency,
          description: data.description,
        });
      } else {
        callback(DEFAULT_SETTINGS);
      }
    }, (error) => {
      console.error('Error in settings listener:', error);
      callback(DEFAULT_SETTINGS);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up settings listener:', error);
    return () => {};
  }
};

/**
 * Update business settings
 */
export const updateBusinessSettings = async (
  updates: Partial<BusinessSettings>
): Promise<boolean> => {
  try {
    const settingsRef = doc(db, 'settings', 'businessSettings');
    await updateDoc(settingsRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (error) {
    console.error('Error updating business settings:', error);
    throw error;
  }
};
