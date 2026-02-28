import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Locale } from '@/i18n';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const loadUser = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const profile = await api.getProfile();
        // Set user's preferred language from their profile (overrides guest language)
        const userLanguage = profile.preferredLanguage as Locale;
        const currentCookieLocale = document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] as Locale | undefined;
        
        if (userLanguage && userLanguage !== currentCookieLocale) {
          // Set the cookie and reload to apply the user's preferred language
          if (typeof window !== 'undefined') {
            document.cookie = `NEXT_LOCALE=${userLanguage};path=/;max-age=31536000`;
            // Reload to apply translations
            window.location.reload();
            return;
          }
        }
        setUser({
          ...profile,
          preferred_language: userLanguage || 'en',
        });
      } catch (error) {
        console.error('Failed to load user:', error);
        setUser(null);
      }
    };

    if (isLoading) {
      loadUser();
    }
  }, [isLoading, setUser, setLoading]);

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
  };
}

