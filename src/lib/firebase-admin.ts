import admin from "firebase-admin";

// Initialize Admin SDK lazily to avoid build-time errors
// Set GOOGLE_APPLICATION_CREDENTIALS in your environment to the service
// account JSON before running server-side scripts or the app in a trusted
// environment.

let initialized = false;

function initializeFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    initialized = true;
  } catch (err) {
    // If initialization fails, log warning but don't throw
    // This allows the build to complete even without credentials
    if (err instanceof Error) {
      console.warn("firebase-admin initialization warning:", err.message);
    } else {
      console.warn("firebase-admin initialization warning:", err);
    }
  }
}

// Lazy getter for adminDb that initializes on first access
export function getAdminDb() {
  initializeFirebaseAdmin();
  return admin.firestore();
}

// For backwards compatibility - but prefer getAdminDb()
export const adminDb = {
  collection: (
    ...args: Parameters<admin.firestore.Firestore["collection"]>
  ) => {
    initializeFirebaseAdmin();
    return admin.firestore().collection(...args);
  },
};

export default admin;
