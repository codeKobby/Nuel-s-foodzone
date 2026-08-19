"use client";

import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  EmailAuthProvider,
  onIdTokenChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as updateFirebasePassword,
  type Auth,
  type User,
} from "firebase/auth";
import type { UserSession } from "@/lib/types";
import {
  isAllowedManagerEmail,
  resolveStaffRole,
  type StaffRole,
} from "@/lib/auth-config";
import { authReadyPromise } from "@/lib/firebase";
import { AuthContext } from "./AuthContext";

function getAuthMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: string }).code
      : undefined;

  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "The email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again later.";
    case "auth/network-request-failed":
      return "The network request failed. Check the connection and try again.";
    case "auth/email-already-in-use":
      return "That email is already associated with a Firebase account.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 8 characters.";
    case "auth/requires-recent-login":
      return "Please sign in again before changing the password.";
    default:
      return error instanceof Error
        ? error.message
        : "Authentication failed. Please try again.";
  }
}

async function createSessionFromUser(user: User): Promise<UserSession> {
  if (!user.email) {
    throw new Error("This staff account does not have an email address.");
  }

  if (!user.emailVerified) {
    throw new Error("Verify the staff account email before entering the back office.");
  }

  const tokenResult = await user.getIdTokenResult();
  const role = resolveStaffRole(tokenResult.claims, user.email);

  if (!role) {
    throw new Error(
      "This account is authenticated but has not been granted an approved staff role."
    );
  }

  if (role === "kitchen") {
    throw new Error(
      "Kitchen display accounts must use the dedicated kitchen display route."
    );
  }

  const fullNameClaim = tokenResult.claims.fullName;
  const usernameClaim = tokenResult.claims.username;

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    role,
    fullName:
      user.displayName ||
      (typeof fullNameClaim === "string" ? fullNameClaim : undefined),
    username:
      typeof usernameClaim === "string" ? usernameClaim : undefined,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const initialize = async () => {
      const authInstance = await authReadyPromise;

      if (!mounted) return;

      if (!authInstance) {
        setAuthError(
          "Firebase Auth is not configured. Add the public Firebase environment variables before using the back office."
        );
        setIsLoading(false);
        return;
      }

      unsubscribe = onIdTokenChanged(authInstance, async (user) => {
        if (!mounted) return;

        setIsLoading(true);
        setAuthError(null);

        if (!user) {
          setSession(null);
          setIsLoading(false);
          return;
        }

        try {
          const nextSession = await createSessionFromUser(user);
          if (!mounted) return;
          setSession(nextSession);
        } catch (error) {
          console.warn("Firebase staff session rejected:", error);
          await firebaseSignOut(authInstance).catch(() => undefined);
          if (!mounted) return;
          setSession(null);
          setAuthError(getAuthMessage(error));
        } finally {
          if (mounted) setIsLoading(false);
        }
      });
    };

    void initialize().catch((error) => {
      console.error("Failed to initialize Firebase Auth:", error);
      if (!mounted) return;
      setAuthError(getAuthMessage(error));
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(
    async (input: {
      email: string;
      password: string;
      expectedRole?: StaffRole;
    }) => {
      setAuthError(null);
      const authInstance: Auth | undefined = await authReadyPromise;

      if (!authInstance) {
        throw new Error("Firebase Auth is not configured.");
      }

      if (
        input.expectedRole === "manager" &&
        !isAllowedManagerEmail(input.email)
      ) {
        throw new Error("Only the configured manager email may use this login.");
      }

      try {
        const credential = await signInWithEmailAndPassword(
          authInstance,
          input.email.trim().toLowerCase(),
          input.password
        );
        const nextSession = await createSessionFromUser(credential.user);

        if (input.expectedRole && nextSession.role !== input.expectedRole) {
          await firebaseSignOut(authInstance);
          throw new Error("This account is not authorized for the selected workspace.");
        }

        setSession(nextSession);
      } catch (error) {
        setSession(null);
        const message = getAuthMessage(error);
        setAuthError(message);
        throw new Error(message);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    const authInstance = await authReadyPromise;
    if (authInstance) {
      await firebaseSignOut(authInstance);
    }
    setSession(null);
    setAuthError(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!isAllowedManagerEmail(email)) {
      throw new Error("Password reset is available only for the configured manager email.");
    }

    const authInstance = await authReadyPromise;
    if (!authInstance) {
      throw new Error("Firebase Auth is not configured.");
    }

    await sendPasswordResetEmail(authInstance, email.trim().toLowerCase());
  }, []);

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string }) => {
      if (input.newPassword.length < 8) {
        throw new Error("Choose a new password with at least 8 characters.");
      }

      const authInstance = await authReadyPromise;
      const user = authInstance?.currentUser;

      if (!authInstance || !user || !user.email) {
        throw new Error("You must be signed in to change the password.");
      }

      const credential = EmailAuthProvider.credential(
        user.email,
        input.currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      await updateFirebasePassword(user, input.newPassword);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        authError,
        signIn,
        signOut,
        sendPasswordReset,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
