import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "@/components/Navigation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Society Fund Manager",
  description: "Manage society funds and expenses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <header>
          <div className="bg-white shadow">
            <div className="max-w-3xl mx-auto py-4 px-4">
              <h1 className="text-2xl font-bold text-gray-900">Society Fund Manager</h1>
            </div>
          </div>
          <Navigation />
        </header>
        {children}
      </body>
    </html>
  );
}
