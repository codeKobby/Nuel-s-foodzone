import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// This function ensures that we initialize the app only once.
function initializeFirebaseApp() {
    if (!getApps().length) {
        return initializeApp(firebaseConfig);
    } else {
        return getApp();
    }
}

app = initializeFirebaseApp();
auth = getAuth(app);
db = getFirestore(app);

export { app, db, auth };
