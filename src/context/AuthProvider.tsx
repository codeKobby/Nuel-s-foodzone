"use client";

import React, { useState, useCallback, ReactNode, useEffect } from 'react';
import type { UserSession } from '@/lib/types';
import { type User } from 'firebase/auth';
import { auth, authReadyPromise } from '@/lib/firebase';
import { AuthContext } from './AuthContext';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<UserSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initializeSession = () => {
            try {
                // Guard against localStorage being unavailable (Safari private mode, etc.)
                if (typeof window !== 'undefined' && window.localStorage) {
                    const storedSession = localStorage.getItem('userSession');
                    if (storedSession) {
                        setSession(JSON.parse(storedSession));
                    }
                }
            } catch (error) {
                console.error("Failed to parse session from localStorage", error);
                try {
                    localStorage.removeItem('userSession');
                } catch (e) {
                    // localStorage not available
                }
            } finally {
                setIsLoading(false);
            }
        };

        let unsubscribe: (() => void) | undefined;

        const initAuth = async () => {
            // Guard dynamic import and auth initialization so transient chunk-load failures
            // or network hiccups don't throw unhandled rejections and stop the app from rendering.
            let signInAnonymously: any = null;
            let onIdTokenChanged: any = null;
            try {
                const authModule = await import('firebase/auth');
                signInAnonymously = authModule.signInAnonymously;
                onIdTokenChanged = authModule.onIdTokenChanged;
            } catch (e) {
                console.error('Failed to load firebase/auth dynamically', e);
                // fallback: proceed with client session from localStorage
                initializeSession();
                return;
            }

            const authInstance = await authReadyPromise;

            if (!authInstance) {
                console.warn("Auth not initialized, skipping anonymous auth");
                initializeSession();
                return;
            }

            if (!authInstance.currentUser) {
                try {
                    await signInAnonymously(authInstance);
                } catch (e) {
                    console.error("Anonymous sign-in failed", e);
                }
            } else {
                initializeSession();
            }

            try {
                unsubscribe = onIdTokenChanged(authInstance, (user: User | null) => {
                    if (user) {
                        // Now that we have a Firebase user, we can safely load the client-side session.
                        initializeSession();
                    } else {
                        // If the user is ever null (e.g., token expired and failed to refresh), try to sign in again.
                        signInAnonymously(authInstance).catch((err: any) => console.error("Failed to re-authenticate anonymously", err));
                    }
                });
            } catch (e) {
                console.error('Failed to attach onIdTokenChanged listener', e);
            }
        };

        initAuth();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const login = useCallback((sessionData: Omit<UserSession, 'uid'> & { uid?: string }) => {
        const fullSession: UserSession = {
            uid: sessionData.uid || 'manager-session',
            ...sessionData
        };

        setSession(fullSession);
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('userSession', JSON.stringify(fullSession));
            }
        } catch (e) {
            console.warn('localStorage not available, session will not persist');
        }

        if (auth && !auth.currentUser) {
            import('firebase/auth').then(({ signInAnonymously }) => {
                signInAnonymously(auth!).catch(e => console.error("Anonymous sign-in failed on login", e));
            });
        }
    }, []);

    const logout = useCallback(() => {
        setSession(null);
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem('userSession');
            }
        } catch (e) {
            // localStorage not available
        }
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
