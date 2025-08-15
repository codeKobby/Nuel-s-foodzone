
"use client"

import { ToastContainer, useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts, dismissToast } = useToast()
  return <ToastContainer toasts={toasts} onDismiss={dismissToast} />;
}

    