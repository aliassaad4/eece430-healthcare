/**
 * Firebase Firestore Query Utilities
 * 
 * These utilities help work around Firestore index requirements by using simpler queries
 * with client-side filtering/sorting instead of complex queries that require custom indexes.
 */

import { collection, query, where, onSnapshot, getDocs, orderBy, Unsubscribe, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Fetch documents without requiring complex indexes
 * This uses a simple primary filter and applies additional filters client-side
 */
export async function fetchWithoutIndex<T>(
  collectionName: string,
  primaryFilter: { field: string; value: any },
  additionalFilters: Array<{ field: string; operator: string; value: any }> = []
): Promise<T[]> {
  try {
    // Create a simple query with just the primary filter
    const q = query(
      collection(db, collectionName),
      where(primaryFilter.field, '==', primaryFilter.value)
    );
    
    // Execute the query
    const querySnapshot = await getDocs(q);
    
    // Process results, applying additional filters client-side
    let results: T[] = [];
    
    querySnapshot.forEach((doc) => {
      const docData = { id: doc.id, ...doc.data() } as T;
      
      // Apply additional filters on the client side
      let matches = true;
      
      for (const filter of additionalFilters) {
        const { field, operator, value } = filter;
        const fieldValue = (doc.data() as any)[field];
        
        switch (operator) {
          case '==':
            if (fieldValue !== value) matches = false;
            break;
          case '!=':
            if (fieldValue === value) matches = false;
            break;
          case '>':
            if (fieldValue <= value) matches = false;
            break;
          case '>=':
            if (fieldValue < value) matches = false;
            break;
          case '<':
            if (fieldValue >= value) matches = false;
            break;
          case '<=':
            if (fieldValue > value) matches = false;
            break;
          default:
            console.warn(`Unsupported operator: ${operator}`);
        }
        
        if (!matches) break;
      }
      
      if (matches) {
        results.push(docData);
      }
    });
    
    return results;
  } catch (error) {
    console.error(`Error in fetchWithoutIndex for ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Subscribe to appointments without requiring complex indexes
 * Uses a simple userId filter and applies date filtering client-side
 */
export function subscribeToAppointments<T>(
  userId: string,
  userRole: 'patient' | 'doctor',
  dateFilter?: string,
  sortDirection: 'asc' | 'desc' = 'asc',
  callback: (appointments: Array<T & { id: string }>) => void
): Unsubscribe {
  // Determine the field to filter by based on user role
  const fieldName = userRole === 'patient' ? 'patientId' : 'doctorId';
  
  // Create a simple query with just the user ID filter
  const q = query(
    collection(db, 'appointments'),
    where(fieldName, '==', userId)
  );
  
  // Set up the real-time listener
  return onSnapshot(
    q,
    (snapshot) => {
      let appointments: Array<T & { id: string }> = [];
      
      snapshot.forEach((doc) => {
        const appointment = { id: doc.id, ...doc.data() } as T & { id: string };
        
        // Apply date filtering on the client side if needed
        if (dateFilter !== undefined) {
          const appointmentDate = (doc.data() as any).date;
          if (appointmentDate !== dateFilter) {
            return; // Skip this appointment if date doesn't match
          }
        }
        
        appointments.push(appointment);
      });
      
      // Sort on the client side
      appointments.sort((a: any, b: any) => {
        if (!a.time || !b.time) return 0;
        return sortDirection === 'asc' 
          ? a.time.localeCompare(b.time) 
          : b.time.localeCompare(a.time);
      });
      
      // Pass the filtered and sorted appointments to the callback
      callback(appointments);
    },
    (error) => {
      console.error('Error subscribing to appointments:', error);
    }
  );
}

/**
 * Subscribe to waitlists without requiring complex indexes
 */
export function subscribeToWaitlists<T>(
  userId: string,
  userRole: 'patient' | 'doctor',
  callback: (waitlistItems: Array<T & { id: string }>) => void
): Unsubscribe {
  // Determine the field to filter by based on user role
  const fieldName = userRole === 'patient' ? 'patientId' : 'doctorId';
  
  // Create a simple query with just the user ID filter
  const q = query(
    collection(db, 'waitlists'),
    where(fieldName, '==', userId)
  );
  
  // Set up the real-time listener
  return onSnapshot(
    q,
    (snapshot) => {
      let waitlistItems: Array<T & { id: string }> = [];
      
      snapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as T & { id: string };
        waitlistItems.push(item);
      });
      
      // Sort on the client side
      waitlistItems.sort((a: any, b: any) => {
        // Sort by position if available
        if (a.position !== undefined && b.position !== undefined) {
          return a.position - b.position;
        }
        // Fall back to creation time if available
        if (a.createdAt && b.createdAt) {
          return a.createdAt.seconds - b.createdAt.seconds;
        }
        return 0;
      });
      
      // Pass the sorted waitlist items to the callback
      callback(waitlistItems);
    },
    (error) => {
      console.error('Error subscribing to waitlist:', error);
    }
  );
}