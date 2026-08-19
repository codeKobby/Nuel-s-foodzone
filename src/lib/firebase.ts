import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";
import type { Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let app: FirebaseApp;
let auth: Auth | undefined;
let db: Firestore;

let resolveAuth: (authInstance: Auth | undefined) => void = () => undefined;
export const authReadyPromise = new Promise<Auth | undefined>((resolve) => {
  resolveAuth = resolve;
});

/**
 * Firebase is initialized in two modes:
 * - Server: Firestore uses a named app and memory cache; client Auth is not
 *   initialized because browser persistence is not available during SSR.
 * - Browser: the default app is reused and Auth uses browser-local
 *   persistence so Firebase remains the source of session truth.
 */
if (firebaseConfigured) {
  if (typeof window === "undefined") {
    const serverAppName = "server-app";
    const existingServerApp = getApps().find(
      (candidate) => candidate.name === serverAppName
    );
    app = existingServerApp || initializeApp(firebaseConfig, serverAppName);

    try {
      db = initializeFirestore(app, { localCache: memoryLocalCache() });
    } catch (error: unknown) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;

      if (code === "failed-precondition") {
        db = getFirestore(app);
      } else {
        console.warn("Firebase server Firestore initialization warning:", error);
      }
    }

    // Client Auth must never be initialized during SSR.
    resolveAuth(undefined);
  } else {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);

    import("firebase/auth")
      .then(({ browserLocalPersistence, getAuth, initializeAuth }) => {
        try {
          auth = initializeAuth(app as FirebaseApp, {
            persistence: browserLocalPersistence,
          });
        } catch (error: unknown) {
          const code = error && typeof error === "object" && "code" in error
            ? (error as { code?: string }).code
            : undefined;

          if (code === "auth/already-initialized") {
            auth = getAuth(app as FirebaseApp);
          } else {
            console.error("Firebase Auth initialization failed:", error);
          }
        }

        resolveAuth(auth);
      })
      .catch((error: unknown) => {
        console.error("Failed to load Firebase Auth:", error);
        resolveAuth(undefined);
      });
  }
} else {
  console.warn(
    "Firebase configuration is missing or incomplete. Firebase services are disabled."
  );
  resolveAuth(undefined);
}

export { app, auth, db, firebaseConfigured };
