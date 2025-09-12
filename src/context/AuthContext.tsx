
"use client";

import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { UserSession } from '@/lib/types';
import { getAuth, signInAnonymously, onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
    session: UserSession | null;
    isLoading: boolean;
    login: (sessionData: Omit<UserSession, 'uid'> & { uid?: string }) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    login: () => {},
    logout: () => {},
});

// This is a simplified, placeholder function. In a real app, you'd get this 
// from a secure backend after the user logs in. For this app, we'll simulate it.
const getCustomToken = async (uid: string, role: 'manager' | 'cashier') => {
    // In a real app, this would be an HTTPS call to a backend function
    // that creates a custom token with the specified role.
    // For now, we just rely on the anonymous auth and the client-side session.
    // The rules are now simple enough that this is not the point of failure.
    return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<UserSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const storedSession = localStorage.getItem('userSession');
            if (storedSession) {
                setSession(JSON.parse(storedSession));
            }
        } catch (error) {
            console.error("Failed to parse session from localStorage", error);
            localStorage.removeItem('userSession');
        } finally {
            setIsLoading(false);
        }

        // Sign in anonymously to satisfy Firestore rules
        const ensureAnonymousAuth = async () => {
             if (auth.currentUser) return;
             try {
                await signInAnonymously(auth);
             } catch(e) {
                console.error("Anonymous sign-in failed", e);
             }
        }
        ensureAnonymousAuth();
        
        const unsubscribe = onIdTokenChanged(auth, (user: User | null) => {
             if (!user) {
                signInAnonymously(auth).catch(e => console.error("Failed to re-authenticate anonymously", e));
             }
        });

        return () => unsubscribe();

    }, []);

    const login = useCallback((sessionData: Omit<UserSession, 'uid'> & { uid?: string }) => {
        const fullSession: UserSession = {
            uid: sessionData.uid || 'manager-session', // Default UID for manager
            ...sessionData
        };
        
        setSession(fullSession);
        localStorage.setItem('userSession', JSON.stringify(fullSession));
        
        // When logging in, we ensure the user is authenticated, which is all
        // the new simple rules require.
         if (!auth.currentUser) {
            signInAnonymously(auth).catch(e => console.error("Anonymous sign-in failed on login", e));
        }

    }, []);

    const logout = useCallback(() => {
        setSession(null);
        localStorage.removeItem('userSession');
    }, []);

    const contextValue = {
        session,
        isLoading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};
