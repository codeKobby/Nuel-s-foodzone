
"use client";

import { createContext } from 'react';
import type { UserSession } from '@/lib/types';

export interface AuthContextType {
    session: UserSession | null;
    isLoading: boolean;
    login: (sessionData: Omit<UserSession, 'uid'> & { uid?: string }) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    login: () => { },
    logout: () => { },
});
