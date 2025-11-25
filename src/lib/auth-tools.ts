"use server";
/**
 * @fileOverview This file contains server-side functions for authentication.
 * Using "use server" allows these to be called from client components for secure operations.
 */
import { collection, query, where, getDocs } from "firebase/firestore/lite";

// Lazy-initialize Admin SDK at runtime only on the server to avoid bundling
// `firebase-admin` into client-side code. Calls to getAdminDb() will throw
// if invoked in a browser environment.
function getAdminDb() {
  if (typeof window !== "undefined") {
    throw new Error("Admin Firestore not available in browser");
  }

  // Require here so bundlers don't try to resolve `firebase-admin` for client bundles
  // and so the dependency is only loaded at runtime on the server.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require("firebase-admin");

  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  return admin.firestore();
}
import { createHash } from "crypto";
import type { VerifyPasswordInput, UpdatePasswordInput } from "@/ai/schemas";
import type { CashierAccount } from "./types";

const DEFAULT_PASSWORDS = {
  manager: "Graceland18",
};

const MASTER_PASSWORD = "Richboy";

// Hashes a password using SHA256.
export async function hashPassword(password: string): Promise<string> {
  return createHash("sha256").update(password).digest("hex");
}

/**
 * Verifies a password for a given role against the stored hash in Firestore.
 * Includes a master password check for the manager role.
 */
export async function verifyPassword(
  input: VerifyPasswordInput
): Promise<boolean> {
  const { role, password } = input;

  if (!password) return false;

  // Master password check for manager
  if (role === "manager" && password === MASTER_PASSWORD) {
    return true;
  }

  // Try to get an Admin SDK Firestore instance. If unavailable (e.g. running
  // in a client or non-admin environment), fall back to limited checks that
  // allow the master password and the default password without attempting
  // to read/update the credentials document (persistence requires Admin SDK).
  let credentialRef: any = null;
  try {
    const adminDb = getAdminDb();
    // Use collection().doc() to get a DocumentReference — this is compatible
    // across admin SDK versions and avoids method resolution issues.
    credentialRef = adminDb.collection("credentials").doc(role);
  } catch (err) {
    // Admin SDK not available in this runtime — we will not attempt to read
    // or write the credentials doc. Fall through to default-only checks.
    credentialRef = null;
  }

  try {
    if (credentialRef) {
      const docSnap = await credentialRef.get();

      if (docSnap.exists) {
        // Document exists, compare against stored hash
        const data = docSnap.data() || {};
        const storedHash = data.passwordHash;
        const hashedInputPassword = await hashPassword(password);

        if (storedHash === hashedInputPassword) {
          return true;
        }

        // If supplied password equals the default for the role, accept it
        // and update the stored hash to the default so future checks use it.
        const defaultPassword = DEFAULT_PASSWORDS[role as keyof typeof DEFAULT_PASSWORDS];
        if (defaultPassword && password === defaultPassword) {
          const newHash = await hashPassword(defaultPassword);
          try {
            await credentialRef.update({ passwordHash: newHash });
          } catch (updateErr) {
            // If update fails (permissions/environment), allow login anyway.
            console.warn("Could not persist default manager hash:", updateErr);
          }
          return true;
        }
        return false;
      } else {
        // Document doesn't exist, check against default password
        const defaultPassword =
          DEFAULT_PASSWORDS[role as keyof typeof DEFAULT_PASSWORDS];
        if (password === defaultPassword) {
          // If it matches, create the document with the hashed default password for future use
          const newHash = await hashPassword(defaultPassword);
          try {
            await credentialRef.set({ passwordHash: newHash });
          } catch (setErr) {
            // If set fails, allow login but warn — persistence requires Admin SDK
            console.warn("Could not create credentials document:", setErr);
          }
          return true;
        }
        return false;
      }
    } else {
      // No Admin SDK available: allow default password (if provided) or master only.
      const defaultPassword = DEFAULT_PASSWORDS[role as keyof typeof DEFAULT_PASSWORDS];
      if (defaultPassword && password === defaultPassword) {
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

/**
 * Verifies a cashier's username and password.
 */
export async function verifyCashierPassword(
  username: string,
  password: string
): Promise<{ success: boolean; user: CashierAccount | null; message: string }> {
  try {
    const q = query(
      collection(db, "cashierAccounts"),
      where("username", "==", username)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, user: null, message: "Username not found." };
    }

    const userDoc = querySnapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() } as CashierAccount;

    if (user.status === "revoked") {
      return {
        success: false,
        user: null,
        message: "This account has been revoked.",
      };
    }

    const hashedPassword = await hashPassword(password);

    if (user.passwordHash === hashedPassword) {
      return { success: true, user, message: "Login successful" };
    } else {
      return { success: false, user: null, message: "Incorrect password." };
    }
  } catch (error) {
    console.error("Error verifying cashier password:", error);
    return {
      success: false,
      user: null,
      message: "An unexpected error occurred.",
    };
  }
}

/**
 * Updates the password for a given role.
 * It first verifies the current password before setting the new one.
 */
export async function updatePassword(
  input: UpdatePasswordInput
): Promise<{ success: boolean; message: string }> {
  const { role, currentPassword, newPassword } = input;

  // First, verify the current password is correct.
  const isAuthorized = await verifyPassword({
    role,
    password: currentPassword,
  });

  if (!isAuthorized) {
    return { success: false, message: "Incorrect current password." };
  }

  // If authorized, proceed to update the password.
  try {
    const credentialRef = doc(db, "credentials", role);
    const newHash = await hashPassword(newPassword);

    // Ensure the document exists before updating, or create it.
    const docSnap = await getDoc(credentialRef);
    if (docSnap.exists()) {
      await updateDoc(credentialRef, { passwordHash: newHash });
    } else {
      await setDoc(credentialRef, { passwordHash: newHash });
    }

    return { success: true, message: "Password updated successfully." };
  } catch (error) {
    console.error("Error updating password:", error);
    return {
      success: false,
      message: "An unexpected error occurred while updating the password.",
    };
  }
}

/**
 * Generates a unique username based on the full name.
 * e.g., "John Doe" -> "john". If "john" exists, it tries "john1", "john2", etc.
 */
export async function generateUniqueUsername(
  fullName: string
): Promise<string> {
  const firstName = fullName
    .split(" ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  let username = firstName;
  let counter = 1;

  if (!username) {
    // Handle cases where the name has no letters/numbers
    username = "cashier";
  }

  while (true) {
    const q = query(
      collection(db, "cashierAccounts"),
      where("username", "==", username)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return username; // Username is unique
    }
    username = `${firstName}${counter}`;
    counter++;
  }
}

/**
 * Generates a random, secure one-time password.
 */
export async function generateOneTimePassword(
  length: number = 8
): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
