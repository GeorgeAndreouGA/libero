'use client';

import { create } from 'zustand';
import { Locale, defaultLocale, locales } from '@/i18n';

interface LanguageState {
  locale: Locale;
  isHydrated: boolean;
  setLocale: (locale: Locale) => void;
  hydrate: () => void;
}

// Helper to get locale from cookie
function getLocaleFromCookie(): Locale {
  if (typeof window !== 'undefined') {
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (match) {
      const value = match[1] as Locale;
      if (locales.includes(value)) {
        return value;
      }
    }
  }
  return defaultLocale;
}

// Simple store without persist to avoid hydration issues
// Language is managed via cookie and server-side detection
// Start with defaultLocale to match server-side rendering, then hydrate on client
export const useLanguageStore = create<LanguageState>()((set) => ({
  locale: defaultLocale, // Always start with default to match SSR
  isHydrated: false,
  hydrate: () => {
    if (typeof window !== 'undefined') {
      set({ locale: getLocaleFromCookie(), isHydrated: true });
    }
  },
  setLocale: (locale: Locale) => {
    // Set cookie for server-side detection
    if (typeof window !== 'undefined') {
      document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
      set({ locale });
      // Reload the page to apply translations
      window.location.reload();
    }
  },
}));

// Auto-hydrate on client side
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure this runs after initial render
  setTimeout(() => {
    useLanguageStore.getState().hydrate();
  }, 0);
}
