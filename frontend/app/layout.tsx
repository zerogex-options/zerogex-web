import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';

const dmSans = DM_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '700']
});

export const metadata: Metadata = {
  title: 'ZeroGEX™ | Real-Time Options Analytics',
  description: 'Professional options analytics platform featuring real-time gamma exposure, dealer positioning, and options flow analysis',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body 
        className={dmSans.className}
        style={{ 
          backgroundColor: '#423d3f',
          margin: 0,
          padding: 0
        }}
      >
        <ThemeProvider value="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
