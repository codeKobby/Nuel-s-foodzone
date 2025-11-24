import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import {
  getFirestore,
  Firestore,
  initializeFirestore,
  memoryLocalCache,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth | undefined;
let db: Firestore;

let resolveAuth: (auth: Auth | undefined) => void = () => {};
const authReadyPromise = new Promise<Auth | undefined>((resolve) => {
  resolveAuth = resolve;
});

// This check is to prevent crashing during server-side rendering or in environments where env vars are not set.
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  if (typeof window === "undefined") {
    // Server-side: Use a named app to avoid conflicts and ensure memory cache
    const serverAppName = "server-app";
    const existingApp = getApps().find((a) => a.name === serverAppName);

    if (existingApp) {
      app = existingApp;
    } else {
      app = initializeApp(firebaseConfig, serverAppName);
    }

    // We skip Auth initialization on the server to avoid localStorage issues.
    // auth will be undefined on the server.
    resolveAuth(undefined);

    try {
      db = initializeFirestore(app, { localCache: memoryLocalCache() });
    } catch (e: any) {
      // If it's already initialized, we assume it was initialized correctly (with memory cache)
      // because we are using a unique app name 'server-app'.
      if (e.code === "failed-precondition") {
        try {
          db = getFirestore(app);
        } catch (innerError) {
          // If getFirestore fails, it means we can't use Firestore on the server.
          // We leave db undefined.
        }
      }
    }
  } else {
    // Client-side: Use default app
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    db = getFirestore(app);

    // Initialize Auth dynamically to avoid server-side import issues
    import("firebase/auth")
      .then(({ getAuth, initializeAuth, browserLocalPersistence }) => {
        try {
          auth = initializeAuth(app, {
            persistence: browserLocalPersistence,
          });
        } catch (e: any) {
          if (e.code === "auth/already-initialized") {
            auth = getAuth(app);
          } else {
            console.error("Error initializing client auth:", e);
          }
        }
        resolveAuth(auth);
      })
      .catch((err) => {
        console.error("Failed to load firebase/auth", err);
        resolveAuth(undefined);
      });
  }
} else {
  console.warn(
    "Firebase configuration is missing or incomplete. Firebase services will be disabled."
  );
  resolveAuth(undefined);
}

export { app, db, auth, authReadyPromise };
