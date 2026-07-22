import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Job Portal",
  description: "Aggregated technical job listings, curated for India",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="main-content">
            <Navbar />
            <div className="main-scroll-area">
              {children}
              <Footer />
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
