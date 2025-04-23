import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  User,
  UserCredential,
  onAuthStateChanged,
  sendEmailVerification
} from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Register a new user with email and password
 */
export const registerUser = async (
  email: string, 
  password: string, 
  displayName: string, 
  role: 'patient' | 'doctor' | 'admin',
  additionalData: Record<string, any> = {}
): Promise<UserCredential> => {
  try {
    // Create the user with authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update the user profile with display name
    if (user) {
      await updateProfile(user, { displayName });
      await sendEmailVerification(user);
      
      // Create user document in Firestore
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName,
        role,
        createdAt: serverTimestamp(),
        ...additionalData
      };
      
      await setDoc(doc(db, "users", user.uid), userData);
      
      // Create role-specific document if needed
      if (role === 'patient' || role === 'doctor' || role === 'admin') {
        await setDoc(doc(db, `${role}s`, user.uid), {
          ...userData,
          userId: user.uid
        });
      }
    }
    
    return userCredential;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
};

/**
 * Sign in with email and password
 */
export const signInUser = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    return await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    return await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error resetting password:", error);
    throw error;
  }
};

/**
 * Get user role from Firestore
 */
export const getUserRole = async (userId: string): Promise<string | null> => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists() && userDoc.data()?.role) {
      return userDoc.data().role;
    }
    return null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
};

/**
 * Subscribe to auth state changes
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Change user password
 */
export const changePassword = async (user: User, newPassword: string): Promise<void> => {
  try {
    return await updatePassword(user, newPassword);
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
};