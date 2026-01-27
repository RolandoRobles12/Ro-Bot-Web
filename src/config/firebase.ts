import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Configuración del proyecto principal (Ro-Bot)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Configuración del proyecto externo (Usuarios/Auth)
// Permite usar el Firestore de otro proyecto para la gestión de usuarios
const externalFirebaseConfig = {
  apiKey: import.meta.env.VITE_EXTERNAL_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_EXTERNAL_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_EXTERNAL_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_EXTERNAL_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_EXTERNAL_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_EXTERNAL_FIREBASE_APP_ID,
};

const hasExternalConfig = !!externalFirebaseConfig.apiKey && !!externalFirebaseConfig.projectId;

// Debug: Log config to verify env vars are loaded (remove in production)
console.log('Firebase Config (Principal):', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'FALTA',
  authDomain: firebaseConfig.authDomain || 'FALTA',
  projectId: firebaseConfig.projectId || 'FALTA',
});

if (hasExternalConfig) {
  console.log('Firebase Config (Externo - Usuarios):', {
    projectId: externalFirebaseConfig.projectId || 'FALTA',
  });
}

// Inicializar Firebase principal
export const app = initializeApp(firebaseConfig);

// Inicializar proyecto externo para usuarios (si está configurado)
const externalApp = hasExternalConfig
  ? initializeApp(externalFirebaseConfig, 'external-users')
  : null;

// Servicios del proyecto principal
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Firestore externo para usuarios - usa el proyecto externo si está configurado,
// de lo contrario usa el proyecto principal
export const usersDb = externalApp ? getFirestore(externalApp) : db;

// Proveedores de autenticación
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
