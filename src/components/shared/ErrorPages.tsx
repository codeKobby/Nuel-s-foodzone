
"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, WifiOff, Search, ArrowLeft, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// Main Error Boundary Component
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });

    // Log error to your monitoring service
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ApplicationError
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// 404 Not Found Page
export const NotFoundPage: React.FC<{ onNavigateHome?: () => void }> = ({ onNavigateHome }) => {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-4">
          <Coffee className="h-16 w-16 text-muted-foreground mx-auto" />
          <Badge variant="secondary" className="text-lg px-4 py-2">404</Badge>
          <h1 className="text-3xl font-bold text-foreground">Page Not Found</h1>
          <p className="text-muted-foreground">
            Oops! The page you're looking for seems to have wandered off.
            Maybe it's taking a coffee break?
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onNavigateHome || (() => window.location.href = '/')}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Button>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};

// Network Error Page
export const NetworkErrorPage: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-4">
          <WifiOff className="h-16 w-16 text-red-500 mx-auto" />
          <Badge variant="destructive" className="text-lg px-4 py-2">Connection Error</Badge>
          <h1 className="text-3xl font-bold text-foreground">No Internet Connection</h1>
          <p className="text-muted-foreground">
            Unable to connect to the server. Please check your internet connection
            and try again.
          </p>
        </div>

        <Button onClick={onRetry || (() => window.location.reload())} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  );
};

// Application Error Page
export const ApplicationError: React.FC<{
  error?: Error;
  onRetry?: () => void;
  showDetails?: boolean;
}> = ({ error, onRetry, showDetails = false }) => {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="space-y-4 text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
          <Badge variant="secondary" className="text-lg px-4 py-2">System Error</Badge>
          <h1 className="text-3xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground">
            We encountered an unexpected error. Our team has been notified and is working to fix it.
          </p>
        </div>

        {showDetails && error && (
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="text-sm text-yellow-800 dark:text-yellow-200">
                Error Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-yellow-700 dark:text-yellow-300 font-mono bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded max-h-32 overflow-y-auto">
                {error.message}
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={onRetry || (() => window.location.reload())} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Application
        </Button>
      </div>
    </div>
  );
};


// Loading Error (when data fails to load)
export const LoadingError: React.FC<{
  title?: string;
  description?: string;
  onRetry?: () => void;
}> = ({
  title = "Failed to load data",
  description = "Unable to fetch the requested information. Please try again.",
  onRetry
}) => {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  };

// Maintenance Page
export const MaintenancePage: React.FC<{
  estimatedTime?: string;
  message?: string;
}> = ({
  estimatedTime = "30 minutes",
  message = "We're performing scheduled maintenance to improve your experience."
}) => {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="space-y-4">
            <div className="relative">
              <Coffee className="h-16 w-16 text-blue-500 mx-auto" />
              <div className="absolute -top-1 -right-1 h-6 w-6 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white">⚡</span>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">Under Maintenance</Badge>
            <h1 className="text-3xl font-bold text-foreground">We'll be right back!</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>

          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Again
          </Button>
        </div>
      </div>
    );
  };

// Search No Results
export const NoSearchResults: React.FC<{
  query: string;
  onClearSearch?: () => void;
}> = ({ query, onClearSearch }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
      <Search className="h-16 w-16 text-muted-foreground" />

      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">No results found</h3>
        <p className="text-muted-foreground">
          We couldn't find any orders matching <strong>"{query}"</strong>
        </p>
      </div>

      {onClearSearch && (
        <Button variant="outline" onClick={onClearSearch}>
          Clear Search
        </Button>
      )}
    </div>
  );
};

// Empty State (when no data exists)
export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ComponentType<{ className?: string }>;
}> = ({ title, description, action, icon: Icon = Coffee }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
      <Icon className="h-20 w-20 text-muted-foreground/50" />

      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-muted-foreground max-w-sm">{description}</p>
      </div>

      {action && (
        <Button onClick={action.onClick} className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  );
};

