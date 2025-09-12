
'use server';
/**
 * @fileOverview This file contains server-side functions for authentication.
 * Using "use server" allows these to be called from client components for secure operations.
 */
import { doc, getDoc, setDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { createHash } from 'crypto';
import type { VerifyPasswordInput, UpdatePasswordInput } from '@/ai/schemas';
import type { CashierAccount } from './types';

const DEFAULT_PASSWORDS = {
    manager: 'Graceland18',
};

const MASTER_PASSWORD = "RichBoy";

// Hashes a password using SHA256.
export async function hashPassword(password: string): Promise<string> {
    return createHash('sha256').update(password).digest('hex');
}

/**
 * Verifies a password for a given role against the stored hash in Firestore.
 * Includes a master password check for the manager role.
 */
export async function verifyPassword(input: VerifyPasswordInput): Promise<boolean> {
    const { role, password } = input;

    if (!password) return false;

    // Master password check for manager
    if (role === 'manager' && password === MASTER_PASSWORD) {
        return true;
    }

    const credentialRef = doc(db, "credentials", role);

    try {
        const docSnap = await getDoc(credentialRef);
        const hashedPassword = await hashPassword(password);

        if (docSnap.exists()) {
            const storedHash = docSnap.data().passwordHash;
            return storedHash === hashedPassword;
        } else {
            const defaultPassword = DEFAULT_PASSWORDS[role as keyof typeof DEFAULT_PASSWORDS];
            if (password === defaultPassword) {
                // Lazily create the credential document if it doesn't exist
                const newHash = await hashPassword(defaultPassword);
                await setDoc(credentialRef, { passwordHash: newHash });
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
export async function verifyCashierPassword(username: string, password: string):Promise<{success: boolean, user: CashierAccount | null, message: string}> {
    try {
        const q = query(collection(db, "cashierAccounts"), where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { success: false, user: null, message: "Username not found." };
        }

        const userDoc = querySnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() } as CashierAccount;
        
        if (user.status === 'revoked') {
             return { success: false, user: null, message: "This account has been revoked." };
        }

        const hashedPassword = await hashPassword(password);
        
        if (user.passwordHash === hashedPassword) {
            return { success: true, user, message: "Login successful" };
        } else {
            return { success: false, user: null, message: "Incorrect password." };
        }

    } catch (error) {
        console.error("Error verifying cashier password:", error);
        return { success: false, user: null, message: "An unexpected error occurred." };
    }
}


/**
 * Updates the password for a given role.
 * It first verifies the current password before setting the new one.
 */
export async function updatePassword(input: UpdatePasswordInput): Promise<{ success: boolean, message: string }> {
    const { role, currentPassword, newPassword } = input;

    const isAuthorized = await verifyPassword({ role, password: currentPassword });

    if (!isAuthorized) {
        return { success: false, message: "Incorrect current password." };
    }

    try {
        const credentialRef = doc(db, "credentials", role);
        const newHash = await hashPassword(newPassword);
        await updateDoc(credentialRef, { passwordHash: newHash });
        return { success: true, message: "Password updated successfully." };
    } catch (error) {
        console.error("Error updating password:", error);
        return { success: false, message: "An unexpected error occurred while updating the password." };
    }
}

/**
 * Generates a unique username based on the full name.
 * e.g., "John Doe" -> "john". If "john" exists, it tries "john1", "john2", etc.
 */
export async function generateUniqueUsername(fullName: string): Promise<string> {
    const firstName = fullName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = firstName;
    let counter = 1;

    if (!username) { // Handle cases where the name has no letters/numbers
        username = 'cashier';
    }

    while (true) {
        const q = query(collection(db, "cashierAccounts"), where("username", "==", username));
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
export async function generateOneTimePassword(length: number = 8): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}
