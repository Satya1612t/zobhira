import type { Metadata } from "next";
import type { ReactNode } from "react";
import FirebaseAnalytics from "@/components/FirebaseAnalytics";
import { AuthProvider } from "@/components/AuthProvider";
import { AdminChrome } from "@/components/AdminChrome";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Portal Admin",
  description: "Admin panel for the Job Portal — jobs, contests, scheduler, sources",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FirebaseAnalytics />
        <ToastProvider>
          <AuthProvider>
            <AdminChrome>{children}</AdminChrome>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
