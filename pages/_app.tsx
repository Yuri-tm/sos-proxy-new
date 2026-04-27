import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/react';

import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Check for updates every time the app loads
        registration.update();

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, reload the page
                window.location.reload();
              }
            });
          }
        });
      }).catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
    }
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
