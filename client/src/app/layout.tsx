import type { Metadata } from 'next';
import { Inter, Orbitron, Exo_2 } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import Script from 'next/script';
import '../styles/globals.css';
import Background from '@/components/ui/Background';
import Footer from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin', 'greek'], variable: '--font-inter' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' });
const exo2 = Exo_2({ subsets: ['latin', 'latin-ext'], variable: '--font-exo' });

export const metadata: Metadata = {
  title: 'Libero - Premium Tips',
  description: 'Get the best tips from professional analysts',
  icons: {
    icon: '/branding/favicon.ico',
    shortcut: '/branding/favicon.ico',
    apple: '/branding/logo.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${orbitron.variable} ${exo2.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/branding/favicon.ico" />
        {/* Suppress hydration warnings completely */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress React hydration warnings in production
              (function() {
                const originalError = console.error;
                console.error = function(...args) {
                  // Suppress React hydration errors
                  if (args[0] && typeof args[0] === 'string' && 
                      (args[0].includes('Hydration') || 
                       args[0].includes('hydrat') ||
                       args[0].includes('418') ||
                       args[0].includes('did not match'))) {
                    return;
                  }
                  // Suppress minified React errors for hydration
                  if (args[0] && args[0].message && 
                      (args[0].message.includes('418') || 
                       args[0].message.includes('Hydration'))) {
                    return;
                  }
                  originalError.apply(console, args);
                };
                
                // Also patch window.onerror for uncaught errors
                const originalOnError = window.onerror;
                window.onerror = function(message, source, lineno, colno, error) {
                  if (message && (message.includes('418') || message.includes('Hydration'))) {
                    return true; // Prevent error propagation
                  }
                  if (originalOnError) {
                    return originalOnError.apply(window, arguments);
                  }
                  return false;
                };
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <Background />
          <div className="relative z-10 min-h-screen flex flex-col">
            <div className="flex-grow">
              {children}
            </div>
            <Footer />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}