// Shared i18n configuration - can be imported from both client and server
export const locales = ['en', 'el'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
