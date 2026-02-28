'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useLanguageStore } from '@/stores/languageStore';
import { useAuthStore } from '@/stores/authStore';
import { locales, Locale } from '@/i18n';
import { useShouldReduceMotion, useIsMobile } from '@/hooks/useMediaQuery';

const languageFlags: Record<Locale, string> = {
  en: '🇬🇧',
  el: '🇬🇷',
};

const languageNames: Record<Locale, string> = {
  en: 'English',
  el: 'Ελληνικά',
};

export default function LanguageSwitcher() {
  const t = useTranslations('common');
  const { locale, setLocale, hydrate } = useLanguageStore();
  const { user, isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useShouldReduceMotion();
  const isMobile = useIsMobile();

  // Hydrate language store and mark as mounted
  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    // Don't allow language change if user is logged in
    if (isAuthenticated) {
      setIsOpen(false);
      return;
    }
    if (newLocale !== locale) {
      setLocale(newLocale);
    }
    setIsOpen(false);
  };

  // For logged-in users, use their preferred language from profile
  // For guests, use the locale from the store (cookie-based)
  const displayLocale: Locale = mounted 
    ? (isAuthenticated && user?.preferred_language ? user.preferred_language : locale) 
    : 'en';

  // If user is logged in, just show the flag without dropdown functionality
  if (isAuthenticated && mounted) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-glass-white border border-neon-cyan/30 ${isMobile ? '' : 'backdrop-blur-sm'}`}>
        <span className="text-lg">{languageFlags[displayLocale]}</span>
        <span className="hidden sm:inline text-sm text-gray-300">{languageNames[displayLocale]}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-glass-white border border-neon-cyan/30 active:border-neon-cyan sm:hover:border-neon-cyan transition-colors ${isMobile ? '' : 'backdrop-blur-sm'}`}
        aria-label={t('language')}
      >
        <span className="text-lg">{languageFlags[displayLocale]}</span>
        <span className="hidden sm:inline text-sm text-gray-300">{languageNames[displayLocale]}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown - simplified on mobile */}
      {shouldReduceMotion ? (
        isOpen && (
          <div
            className={`absolute right-0 mt-2 w-40 rounded-xl bg-cyber-navy/95 border border-neon-cyan/30 shadow-lg overflow-hidden z-50 ${isMobile ? '' : 'backdrop-blur-xl'}`}
          >
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  displayLocale === loc
                    ? 'bg-neon-cyan/20 text-neon-cyan'
                    : 'text-gray-300 active:bg-white/10'
                }`}
              >
                <span className="text-lg">{languageFlags[loc]}</span>
                <span className="text-sm font-medium">{languageNames[loc]}</span>
                {displayLocale === loc && (
                  <svg className="w-4 h-4 ml-auto text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )
      ) : (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-40 rounded-xl bg-cyber-navy/95 backdrop-blur-xl border border-neon-cyan/30 shadow-lg overflow-hidden z-50"
            >
              {locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => handleLocaleChange(loc)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    displayLocale === loc
                      ? 'bg-neon-cyan/20 text-neon-cyan'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">{languageFlags[loc]}</span>
                  <span className="text-sm font-medium">{languageNames[loc]}</span>
                  {displayLocale === loc && (
                    <svg className="w-4 h-4 ml-auto text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
