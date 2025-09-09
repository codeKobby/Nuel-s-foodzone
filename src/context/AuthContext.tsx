
"use client";

import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { UserSession } from '@/lib/types';

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
    }, []);

    const login = useCallback((sessionData: Omit<UserSession, 'uid'> & { uid?: string }) => {
        const fullSession: UserSession = {
            uid: sessionData.uid || 'manager-session', // Default UID for manager
            ...sessionData
        };
        setSession(fullSession);
        localStorage.setItem('userSession', JSON.stringify(fullSession));
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
