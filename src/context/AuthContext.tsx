
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<UserSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initializeSession = () => {
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
        };

        const ensureAnonymousAuth = async () => {
            if (auth.currentUser) {
                initializeSession();
                return;
            }
            try {
                await signInAnonymously(auth);
            } catch (e) {
                console.error("Anonymous sign-in failed", e);
            }
        };

        ensureAnonymousAuth();
        
        const unsubscribe = onIdTokenChanged(auth, (user: User | null) => {
             if (user) {
                // Now that we have a Firebase user, we can safely load the client-side session.
                initializeSession();
             } else {
                // If the user is ever null (e.g., token expired and failed to refresh), try to sign in again.
                signInAnonymously(auth).catch(e => console.error("Failed to re-authenticate anonymously", e));
             }
        });

        return () => unsubscribe();
    }, []);

    const login = useCallback((sessionData: Omit<UserSession, 'uid'> & { uid?: string }) => {
        const fullSession: UserSession = {
            uid: sessionData.uid || 'manager-session', 
            ...sessionData
        };
        
        setSession(fullSession);
        localStorage.setItem('userSession', JSON.stringify(fullSession));
        
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
