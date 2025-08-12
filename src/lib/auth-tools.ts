
'use server';
/**
 * @fileOverview This file contains server-side functions for authentication.
 * Using "use server" allows these to be called from client components for secure operations.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { createHash } from 'crypto';
import type { VerifyPasswordInput, UpdatePasswordInput } from '@/ai/schemas';

const DEFAULT_PASSWORDS = {
    manager: 'Graceland18',
    cashier: 'password', // Default for cashier if ever needed
};

// Hashes a password using SHA256.
function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

/**
 * Verifies a password for a given role against the stored hash in Firestore.
 * If no hash exists, it creates one from the default password.
 */
export async function verifyPassword(input: VerifyPasswordInput): Promise<boolean> {
    const { role, password } = input;
    const credentialRef = doc(db, "credentials", role);

    try {
        const docSnap = await getDoc(credentialRef);

        if (docSnap.exists()) {
            // Document exists, compare password with stored hash
            const storedHash = docSnap.data().passwordHash;
            return storedHash === hashPassword(password);
        } else {
            // Document doesn't exist, this is likely the first run.
            // Check against the default password.
            const defaultPassword = DEFAULT_PASSWORDS[role];
            if (password === defaultPassword) {
                // Password is correct, so create the hash in the database for future logins
                const newHash = hashPassword(defaultPassword);
                await setDoc(credentialRef, { passwordHash: newHash });
                return true;
            }
            return false;
        }
    } catch (error) {
        console.error("Error verifying password:", error);
        // In case of error, deny access.
        return false;
    }
}

/**
 * Updates the password for a given role.
 * It first verifies the current password before setting the new one.
 */
export async function updatePassword(input: UpdatePasswordInput): Promise<{ success: boolean, message: string }> {
    const { role, currentPassword, newPassword } = input;

    // First, verify the current password is correct.
    const isAuthorized = await verifyPassword({ role, password: currentPassword });

    if (!isAuthorized) {
        return { success: false, message: "Incorrect current password." };
    }

    // If authorized, update to the new password hash.
    try {
        const credentialRef = doc(db, "credentials", role);
        const newHash = hashPassword(newPassword);
        await setDoc(credentialRef, { passwordHash: newHash });
        return { success: true, message: "Password updated successfully." };
    } catch (error) {
        console.error("Error updating password:", error);
        return { success: false, message: "An unexpected error occurred while updating the password." };
    }
}
