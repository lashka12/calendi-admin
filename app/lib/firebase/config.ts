import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

// Your Firebase configuration (same as business-management project)
const firebaseConfig = {
  apiKey: "AIzaSyA9AcvY6S2AB_sPUh8QxID-S10TANMgfbs",
  authDomain: "bussiness-managment-syst-da008.firebaseapp.com",
  projectId: "bussiness-managment-syst-da008",
  storageBucket: "bussiness-managment-syst-da008.firebasestorage.app",
  messagingSenderId: "333252803339",
  appId: "1:333252803339:web:74b350a22eeb5f584fc00e"
};

// Initialize Firebase (only if not already initialized)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// 🔧 BEST PRACTICE: Auto-connect to Firebase Emulators in development mode
// This is the industry standard - automatically use emulators locally, production in production
// No need to set environment variables - it just works!
if (
  process.env.NODE_ENV === 'development' && 
  typeof window !== 'undefined'
) {
  // Check if user explicitly wants to disable emulators (override)
  const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== 'false';
  
  if (useEmulators) {
    console.log('🔧 Development mode detected - Connecting to Firebase Emulators');
    console.log('   📡 Functions:  http://localhost:5001');
    console.log('   🗄️  Firestore: http://localhost:8080');
    console.log('   🔐 Auth:      http://localhost:9099');
    console.log('   📊 UI:        http://localhost:4000');
    
    try {
      // Check if we're already connected to avoid multiple connections
      const dbSettings = (db as any)._delegate?._settings;
      const functionsUrl = (functions as any)._delegate?._url;
      const authConfig = (auth as any)._delegate?._config;
      
      // Only connect if not already connected to emulators
      if (!dbSettings?.host?.includes('localhost')) {
        connectFirestoreEmulator(db, 'localhost', 8080);
      }
      
      if (!functionsUrl?.includes('localhost')) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      
      if (!authConfig?.emulator) {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }
      
      console.log('✅ Connected to Firebase Emulators successfully');
    } catch (error: any) {
      // Emulators already connected or not available
      if (error.message?.includes('already been initialized')) {
        // This is fine, emulators are already connected
        console.log('✅ Already connected to Firebase Emulators');
      } else {
        console.warn('⚠️ Firebase emulator connection issue:', error.message);
        console.warn('   Make sure emulators are running: npm run emulators');
        console.warn('   Or set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false to use production');
      }
    }
  }
}

export default app;

// ============================================================================
// PUSH NOTIFICATIONS (Firebase Cloud Messaging)
// ============================================================================

let messagingInstance: Messaging | null = null;

/**
 * Get Firebase Messaging instance (browser only)
 * Returns null if messaging is not supported
 */
export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  
  // Check if already initialized
  if (messagingInstance) return messagingInstance;
  
  // Check if messaging is supported
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser');
    return null;
  }
  
  messagingInstance = getMessaging(app);
  return messagingInstance;
};

/**
 * Request notification permission and get FCM token
 * @param vapidKey - VAPID key from Firebase Console (Cloud Messaging settings)
 * @returns FCM token or null if permission denied
 */
export const requestNotificationPermission = async (vapidKey: string): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }
    
    const messaging = await getMessagingInstance();
    if (!messaging) return null;
    
    // Get the FCM token
    const token = await getToken(messaging, { vapidKey });
    console.log('FCM Token obtained:', token?.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

/**
 * Listen for foreground messages (when app is open)
 * @param callback - Called when a message is received while app is in foreground
 * @returns Unsubscribe function
 */
export const onForegroundMessage = (callback: (payload: any) => void): (() => void) => {
  let unsubscribe = () => {};
  
  getMessagingInstance().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, callback);
    }
  });
  
  return () => unsubscribe();
};
