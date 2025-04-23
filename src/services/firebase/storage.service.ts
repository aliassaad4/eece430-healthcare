import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable,
  listAll,
  UploadTaskSnapshot,
  UploadMetadata
} from 'firebase/storage';
import { storage } from '@/config/firebase';

/**
 * Upload a file to Firebase Storage
 * @param path Storage path where the file will be stored
 * @param file File to upload
 * @param metadata Optional metadata for the file
 * @returns Download URL of the uploaded file
 */
export const uploadFile = async (
  path: string, 
  file: File | Blob, 
  metadata?: UploadMetadata
): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const uploadResult = await uploadBytes(storageRef, file, metadata);
    return await getDownloadURL(uploadResult.ref);
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Upload a file with progress tracking
 * @param path Storage path where the file will be stored
 * @param file File to upload
 * @param progressCallback Callback function that receives upload progress updates
 * @param metadata Optional metadata for the file
 * @returns Promise that resolves with the download URL when upload is complete
 */
export const uploadFileWithProgress = (
  path: string,
  file: File | Blob,
  progressCallback: (progress: number, snapshot: UploadTaskSnapshot) => void,
  metadata?: UploadMetadata
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          progressCallback(progress, snapshot);
        },
        (error) => {
          console.error('Error uploading file:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    } catch (error) {
      console.error('Error starting upload:', error);
      reject(error);
    }
  });
};

/**
 * Get the download URL for a file in Firebase Storage
 * @param path Path to the file in storage
 * @returns Download URL as a string
 */
export const getFileDownloadURL = async (path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting file download URL:', error);
    throw error;
  }
};

/**
 * Delete a file from Firebase Storage
 * @param path Path to the file to delete
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    return await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * List all files in a directory in Firebase Storage
 * @param path Directory path in storage
 * @returns Array of download URLs for all files in the directory
 */
export const listAllFiles = async (path: string): Promise<string[]> => {
  try {
    const storageRef = ref(storage, path);
    const fileList = await listAll(storageRef);
    
    const downloadURLs = await Promise.all(
      fileList.items.map(async (itemRef) => {
        return await getDownloadURL(itemRef);
      })
    );
    
    return downloadURLs;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

/**
 * Create a storage path with user ID and timestamp to avoid naming conflicts
 * @param userId User ID of the uploader
 * @param folderName Folder name for organization
 * @param fileName Original file name
 * @returns Unique storage path
 */
export const createUniqueStoragePath = (
  userId: string,
  folderName: string,
  fileName: string
): string => {
  const timestamp = new Date().getTime();
  const fileExtension = fileName.split('.').pop();
  const uniqueFileName = `${timestamp}_${fileName}`;
  
  return `${folderName}/${userId}/${uniqueFileName}`;
};