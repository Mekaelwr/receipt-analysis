'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext';
import TopBar from '../components/TopBar';
import ProtectedRoute from '@/contexts/ProtectedRoute';
import { Analytics } from "@vercel/analytics/react"
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Roboto_Mono } from "next/font/google";

// Prevent Font Awesome from adding its CSS since we did it manually above
config.autoAddCss = false;

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700']
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
  weight: ['400', '700']
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;700&display=swap" 
          rel="stylesheet"
        />
      </head>
      <body>
        <Analytics mode="auto" />
        <AuthProvider>   
          <ProtectedRoute>
            <TopBar />    
            <main>{children}</main>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}
