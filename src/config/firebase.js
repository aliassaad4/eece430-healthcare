// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAnalytics, isSupported } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAKcCuORczb3fneqpbhdoyj1CDU2778reE",
  authDomain: "project-3ebac.firebaseapp.com",
  projectId: "project-3ebac",
  storageBucket: "project-3ebac.appspot.com",
  messagingSenderId: "684888876755",
  appId: "1:684888876755:web:8ae5fbb6fef400a79d5626",
  measurementId: "G-ET30Q4CLPV"
};

// Initialize Firebase
let app;
let analytics;
let auth;
let db;
let storage;
let functions;

try {
  // Initialize Firebase app
  app = initializeApp(firebaseConfig);
  
  // Initialize Auth
  auth = getAuth(app);
  
  // Initialize Firestore
  db = getFirestore(app);
  
  // Enable offline persistence for Firestore
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence.');
    }
  });
  
  // Initialize Storage
  storage = getStorage(app);
  
  // Initialize Functions
  functions = getFunctions(app);
  
  // Initialize Analytics only in browser environments
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(err => {
    console.error("Analytics initialization error:", err);
  });
  
  // Connect to emulators in development environment
  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    // For future use with emulators
    console.log("Using Firebase emulators");
  }
  
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { app, auth, db, storage, functions, analytics };
export default app;