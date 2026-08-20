
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from '@/hooks/use-toast';
import { AuthProvider } from '@/context/AuthProvider';
import { PublicCartProvider } from '@/context/PublicCartContext';

export const metadata: Metadata = {
  title: "Nuel’s Foodzone | Dinner & Catering",
  description: "Nuel’s Foodzone brings Ghanaian comfort food, restaurant dinners, and memorable catering to your table.",
  icons: null,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>
            <PublicCartProvider>
              {children}
              <Toaster />
            </PublicCartProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
