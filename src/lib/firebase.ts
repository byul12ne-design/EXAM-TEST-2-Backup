import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

type FirebaseEnvKey =
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_APP_ID';

const requiredEnv = (key: FirebaseEnvKey) => {
  const value = import.meta.env[key];

  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const firebaseConfig = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
