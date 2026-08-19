"use client";

import React, { useContext, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader, AlertTriangle, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthContext } from "@/context/AuthContext";
import { MANAGER_EMAIL } from "@/lib/auth-config";

type LoginRole = "manager" | "cashier";

interface PasswordModalProps {
  role: LoginRole;
  onSuccess: () => void;
  onClose: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  role,
  onSuccess,
  onClose,
}) => {
  const { signIn, sendPasswordReset } = useContext(AuthContext);
  const { toast } = useToast();
  const [email, setEmail] = useState(role === "manager" ? MANAGER_EMAIL : "");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (role === "manager" ? "Manager sign-in" : "Cashier sign-in"),
    [role]
  );

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signIn({ email, password, expectedRole: role });
      onSuccess();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Sign-in failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (role !== "manager") return;

    setIsResetting(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      toast({
        title: "Password reset email sent",
        description: "Check the configured manager inbox for the reset link.",
      });
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to send the password reset email."
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleVerify}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Sign in with the Firebase Auth account assigned to this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor={`${role}-email`}>Email address</Label>
              <Input
                id={`${role}-email`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={role === "manager"}
                required
                autoFocus={role === "cashier"}
                autoComplete="username"
              />
              {role === "manager" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Only the configured manager email can access this workspace.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor={`${role}-password`}>Password</Label>
              <Input
                id={`${role}-password`}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoFocus={role === "manager"}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            {role === "manager" && (
              <Button
                type="button"
                variant="link"
                onClick={handleForgotPassword}
                disabled={isLoading || isResetting}
              >
                {isResetting ? (
                  <Loader className="mr-2 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send reset email
              </Button>
            )}
            <div className="flex-grow" />
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isResetting || !email || !password}>
              {isLoading && <Loader className="mr-2 animate-spin" />}
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordModal;
