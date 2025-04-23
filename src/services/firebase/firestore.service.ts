import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  DocumentData,
  DocumentReference,
  CollectionReference,
  onSnapshot,
  QueryConstraint,
  QuerySnapshot,
  Timestamp,
  setDoc,
  WhereFilterOp
} from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Get a document from Firestore
 */
export const getDocument = async <T = DocumentData>(
  collectionPath: string, 
  documentId: string
): Promise<T | null> => {
  try {
    const docRef = doc(db, collectionPath, documentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as unknown as T;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting document from ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Get all documents in a collection, optionally filtered and ordered
 */
export const getDocuments = async <T = DocumentData>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> => {
  try {
    const collectionRef = collection(db, collectionPath);
    const q = query(collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    const documents: T[] = [];
    querySnapshot.forEach((doc) => {
      documents.push({ id: doc.id, ...doc.data() } as unknown as T);
    });
    
    return documents;
  } catch (error) {
    console.error(`Error getting documents from ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Create a document in Firestore
 */
export const createDocument = async <T extends DocumentData>(
  collectionPath: string, 
  data: Omit<T, 'id'>,
  documentId?: string
): Promise<string> => {
  try {
    const timestampedData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    let docRef: DocumentReference;
    if (documentId) {
      docRef = doc(db, collectionPath, documentId);
      await setDoc(docRef, timestampedData);
    } else {
      const collectionRef = collection(db, collectionPath);
      docRef = await addDoc(collectionRef, timestampedData);
    }
    
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Update a document in Firestore
 */
export const updateDocument = async <T extends DocumentData>(
  collectionPath: string, 
  documentId: string, 
  data: Partial<T>
): Promise<void> => {
  try {
    const docRef = doc(db, collectionPath, documentId);
    const timestampedData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    return updateDoc(docRef, timestampedData);
  } catch (error) {
    console.error(`Error updating document in ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Delete a document from Firestore
 */
export const deleteDocument = async (
  collectionPath: string, 
  documentId: string
): Promise<void> => {
  try {
    const docRef = doc(db, collectionPath, documentId);
    return deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Subscribe to a document's real-time updates
 */
export const subscribeToDocument = <T = DocumentData>(
  collectionPath: string,
  documentId: string,
  callback: (data: T | null) => void
) => {
  try {
    const docRef = doc(db, collectionPath, documentId);
    
    return onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        callback({ id: docSnapshot.id, ...docSnapshot.data() } as unknown as T);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`Error subscribing to document in ${collectionPath}:`, error);
      throw error;
    });
  } catch (error) {
    console.error(`Error setting up subscription to document in ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Subscribe to a collection's real-time updates
 */
export const subscribeToCollection = <T = DocumentData>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  callback: (data: T[]) => void
) => {
  try {
    const collectionRef = collection(db, collectionPath);
    const q = query(collectionRef, ...constraints);
    
    return onSnapshot(q, (querySnapshot) => {
      const documents: T[] = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() } as unknown as T);
      });
      callback(documents);
    }, (error) => {
      console.error(`Error subscribing to collection in ${collectionPath}:`, error);
      throw error;
    });
  } catch (error) {
    console.error(`Error setting up subscription to collection in ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Utility functions for creating common query constraints
 */
export const queryConstraints = {
  whereEquals: (field: string, value: any) => where(field, "==", value),
  whereNotEquals: (field: string, value: any) => where(field, "!=", value),
  whereGreaterThan: (field: string, value: any) => where(field, ">", value),
  whereLessThan: (field: string, value: any) => where(field, "<", value),
  whereGreaterThanOrEqual: (field: string, value: any) => where(field, ">=", value),
  whereLessThanOrEqual: (field: string, value: any) => where(field, "<=", value),
  whereIn: (field: string, values: any[]) => where(field, "in", values),
  orderByAsc: (field: string) => orderBy(field, "asc"),
  orderByDesc: (field: string) => orderBy(field, "desc"),
  limitTo: (count: number) => limit(count)
};

/**
 * Interface for filter condition
 */
export interface FilterCondition {
  field: string;
  operator?: WhereFilterOp;
  value: any;
}

/**
 * Fetch documents from a collection without composite index requirements
 * Useful for simple equality queries when you want to avoid creating indexes
 */
export const fetchWithoutIndex = async <T = DocumentData>(
  collectionPath: string,
  mainFilter: FilterCondition,
  additionalFilters: FilterCondition[] = []
): Promise<T[]> => {
  try {
    // First query with just the main filter
    const collectionRef = collection(db, collectionPath);
    const mainQuery = query(
      collectionRef, 
      where(mainFilter.field, mainFilter.operator || "==", mainFilter.value)
    );
    
    const querySnapshot = await getDocs(mainQuery);
    
    if (additionalFilters.length === 0) {
      // If no additional filters, return all results
      const documents: T[] = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() } as unknown as T);
      });
      return documents;
    } else {
      // If additional filters, apply them in memory
      const documents: T[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check if document meets all additional filter conditions
        const matchesAllFilters = additionalFilters.every(filter => {
          const operator = filter.operator || "==";
          const fieldValue = data[filter.field];
          
          switch (operator) {
            case "==": return fieldValue === filter.value;
            case "!=": return fieldValue !== filter.value;
            case ">": return fieldValue > filter.value;
            case "<": return fieldValue < filter.value;
            case ">=": return fieldValue >= filter.value;
            case "<=": return fieldValue <= filter.value;
            case "array-contains": return Array.isArray(fieldValue) && fieldValue.includes(filter.value);
            case "in": return Array.isArray(filter.value) && filter.value.includes(fieldValue);
            case "array-contains-any": 
              return Array.isArray(fieldValue) && Array.isArray(filter.value) && 
                     filter.value.some(v => fieldValue.includes(v));
            case "not-in": 
              return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
            default: return false;
          }
        });
        
        if (matchesAllFilters) {
          documents.push({ id: doc.id, ...data } as unknown as T);
        }
      });
      
      return documents;
    }
  } catch (error) {
    console.error(`Error fetching documents from ${collectionPath}:`, error);
    throw error;
  }
};