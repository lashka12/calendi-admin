import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './config';

export interface Service {
  id: string;
  name?: string; // Old format
  names?: {
    en?: string;
    he?: string;
    ar?: string;
  }; // New multi-language format
  description?: string; // Old format
  descriptions?: {
    en?: string;
    he?: string;
    ar?: string;
  }; // New multi-language format
  price?: number;
  duration?: number; // in minutes
  category?: string;
  active?: boolean;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  deletedAt?: Timestamp | Date;
  [key: string]: any; // Allow additional fields
}

/**
 * Get all services including inactive ones (Admin only)
 * Supports both old format (name) and new format (names)
 */
export const getAllServicesForAdmin = async (): Promise<Service[]> => {
  try {
    const servicesRef = collection(db, 'services');
    const snapshot = await getDocs(servicesRef);
    
    // Return all services (both active and inactive) but exclude soft-deleted ones
    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          active: data.active !== false, // default to true if not set
        } as Service;
      })
      .filter(service => !service.deletedAt) // Filter out soft-deleted services
      .sort((a, b) => {
        // Support both old (name) and new (names.en) format for sorting
        const nameA = a.names?.en || a.name || '';
        const nameB = b.names?.en || b.name || '';
        return nameA.localeCompare(nameB);
      });
  } catch (error) {
    console.error('Error getting services for admin:', error);
    return [];
  }
};

/**
 * Subscribe to real-time services updates
 * Returns an unsubscribe function that should be called to stop listening
 */
export const subscribeToServices = (
  callback: (services: Service[]) => void
): (() => void) => {
  try {
    const servicesRef = collection(db, 'services');
    
    const unsubscribe = onSnapshot(servicesRef, (snapshot) => {
      const services = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            active: data.active !== false,
          } as Service;
        })
        .filter(service => !service.deletedAt)
        .sort((a, b) => {
          const nameA = a.names?.en || a.name || '';
          const nameB = b.names?.en || b.name || '';
          return nameA.localeCompare(nameB);
        });
      
      callback(services);
    }, (error) => {
      console.error('Error in services listener:', error);
      callback([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up services listener:', error);
    return () => {};
  }
};

/**
 * Add a new service (Admin only)
 * Supports both old format (string) and new format (object with multi-language)
 */
export const addService = async (serviceData: Partial<Service>): Promise<string> => {
  try {
    const servicesRef = collection(db, 'services');
    
    const dataToSave = {
      ...serviceData,
      active: serviceData.active !== false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(servicesRef, dataToSave);
    return docRef.id;
  } catch (error) {
    console.error('Error adding service:', error);
    throw error;
  }
};

/**
 * Update a service (Admin only)
 */
export const updateService = async (serviceId: string, updates: Partial<Service>): Promise<boolean> => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    await updateDoc(serviceRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error('Error updating service:', error);
    throw error;
  }
};

/**
 * Delete a service (Admin only)
 * Note: Marks as inactive instead of deleting to preserve history
 */
export const deleteService = async (serviceId: string): Promise<boolean> => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    await updateDoc(serviceRef, {
      active: false,
      deletedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error('Error deleting service:', error);
    throw error;
  }
};

/**
 * Helper to get service name in specified language (with fallback)
 */
export const getServiceName = (service: Service, language: 'en' | 'he' | 'ar' = 'en'): string => {
  return service.names?.[language] || service.names?.en || service.name || 'Unnamed Service';
};

/**
 * Helper to get service description in specified language (with fallback)
 */
export const getServiceDescription = (service: Service, language: 'en' | 'he' | 'ar' = 'en'): string => {
  return service.descriptions?.[language] || service.descriptions?.en || service.description || '';
};

