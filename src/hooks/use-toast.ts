
"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
    X as XIcon, 
    CheckCircle as CheckCircleIcon, 
    AlertTriangle as AlertTriangleIcon, 
    Info as InfoIcon, 
    XCircle as XCircleIcon, 
    Wifi as WifiIcon, 
    WifiOff as WifiOffIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  networkStatus: (isOnline: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastIcon: React.FC<{ type: Toast['type'] }> = ({ type }) => {
  const colorClasses = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };
  
  const iconClassName = cn('h-5 w-5', colorClasses[type]);

  switch (type) {
    case 'success':
      return <CheckCircleIcon className={iconClassName} />;
    case 'error':
      return <XCircleIcon className={iconClassName} />;
    case 'warning':
      return <AlertTriangleIcon className={iconClassName} />;
    case 'info':
      return <InfoIcon className={iconClassName} />;
    default:
      return null;
  }
};

const ToastComponent: React.FC<{ 
  toast: Toast; 
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast.persistent && toast.duration !== 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.persistent, toast.id]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const borderColors = {
    success: 'border-l-green-500 bg-green-50 dark:bg-green-950/20',
    error: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
    warning: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
  };

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-lg border border-l-4 p-4 shadow-lg transition-all duration-300 ease-out',
        borderColors[toast.type],
        isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        isExiting && 'translate-x-full opacity-0 scale-95'
      )}
    >
      <div className="flex items-start">
        <ToastIcon type={toast.type} />
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toast.action.onClick}
                className="text-xs h-8"
              >
                {toast.action.label}
              </Button>
            </div>
          )}
        </div>
        <div className="ml-4 flex flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-[100] flex items-end px-4 py-6 sm:items-start sm:p-6"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => (
          <ToastComponent
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Network status monitoring
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      setIsOnline(window.navigator.onLine);
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const toast = useCallback((toastData: Omit<Toast, 'id'>) => {
    const id = generateId();
    const newToast: Toast = {
      ...toastData,
      id,
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title: string, description?: string) => {
    toast({ title, description, type: 'success' });
  }, [toast]);

  const error = useCallback((title: string, description?: string) => {
    toast({ title, description, type: 'error', duration: 7000 });
  }, [toast]);

  const warning = useCallback((title: string, description?: string) => {
    toast({ title, description, type: 'warning', duration: 6000 });
  }, [toast]);

  const info = useCallback((title: string, description?: string) => {
    toast({ title, description, type: 'info' });
  }, [toast]);

  const networkStatus = useCallback((online: boolean) => {
    if (online) {
      success('Back Online', 'Connection restored. Your data is being synchronized.');
    } else {
      warning('Connection Lost', 'Working offline. Changes will sync when connection is restored.');
    }
  }, [success, warning]);

  // Auto-show network status changes
  useEffect(() => {
    const hasToggledBefore = typeof window !== 'undefined' ? localStorage.getItem('hasToggledNetwork') : null;
    if (hasToggledBefore) {
      networkStatus(isOnline);
    } else if (typeof window !== 'undefined') {
      localStorage.setItem('hasToggledNetwork', 'true');
    }
  }, [isOnline, networkStatus]);

  const contextValue: ToastContextType = {
    toasts,
    toast,
    dismissToast,
    success,
    error,
    warning,
    info,
    networkStatus,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Network Status Indicator */}
      <div className="fixed bottom-4 left-4 z-40">
        <div
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium shadow-lg transition-all duration-500',
            isOnline
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white animate-pulse'
          )}
        >
          {isOnline ? (
            <>
              <WifiIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOffIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </div>
      </div>
    </ToastContext.Provider>
  );
};
