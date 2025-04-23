// Re-export everything from Firebase services
export * from './auth.service';
export * from './firestore.service';
export * from './storage.service';

// Export Firebase config objects
export { app, auth, db, storage, functions } from '@/config/firebase';