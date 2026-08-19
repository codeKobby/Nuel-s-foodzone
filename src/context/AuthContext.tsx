"use client";

import { createContext } from "react";
import type { UserSession } from "@/lib/types";
import type { StaffRole } from "@/lib/auth-config";

export interface AuthContextType {
  session: UserSession | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (input: {
    email: string;
    password: string;
    expectedRole?: StaffRole;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  authError: null,
  signIn: async () => undefined,
  signOut: async () => undefined,
  sendPasswordReset: async () => undefined,
  changePassword: async () => undefined,
});
