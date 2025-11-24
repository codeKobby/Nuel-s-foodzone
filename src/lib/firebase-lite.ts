import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  const appName = "server-lite";
  const existingApp = getApps().find((a) => a.name === appName);
  if (existingApp) {
    app = existingApp;
  } else {
    app = initializeApp(firebaseConfig, appName);
  }
  db = getFirestore(app);
} else {
  console.warn(
    "Firebase configuration missing; server-side Firestore disabled."
  );
}

export { app, db };
