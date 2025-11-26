import admin from "firebase-admin";

// Initialize Admin SDK using Application Default Credentials. Set
// GOOGLE_APPLICATION_CREDENTIALS in your environment to the service
// account JSON before running server-side scripts or the app in a trusted
// environment.

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (err) {
    // If initialization fails, rethrow so callers can handle it.
    if (err instanceof Error) {
      console.warn("firebase-admin initialization warning:", err.message);
    } else {
      console.warn("firebase-admin initialization warning:", err);
    }
  }
}

export const adminDb = admin.firestore();
export default admin;
