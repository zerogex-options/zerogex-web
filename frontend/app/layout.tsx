import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';
import { TimeframeProvider } from '@/core/TimeframeContext';
import ClientLayout from '@/components/ClientLayout';

const dmSans = DM_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '700']
});

export const metadata: Metadata = {
  title: 'ZeroGEX™ | Real-Time Options Analytics',
  description: 'Professional options analytics platform featuring real-time gamma exposure, dealer positioning, and options flow analysis',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body 
        className={dmSans.className}
        style={{ 
          margin: 0,
          padding: 0
        }}
      >
        <ThemeProvider>
          <TimeframeProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </TimeframeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
