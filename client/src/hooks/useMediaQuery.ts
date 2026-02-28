'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to check if a media query matches
 * Handles SSR safely by returning false initially
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    // Set initial value after mount
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Hook to detect mobile devices (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/**
 * Hook to detect small screens (< 640px)
 */
export function useIsSmallScreen(): boolean {
  return useMediaQuery('(max-width: 639px)');
}

/**
 * Hook to detect if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Combined hook for performance-sensitive components
 * Returns true if we should use reduced/simpler animations
 * On mobile devices OR when user prefers reduced motion
 */
export function useShouldReduceMotion(): boolean {
  const isMobile = useIsMobile();
  const prefersReduced = usePrefersReducedMotion();
  
  // Reduce motion on mobile OR if user explicitly prefers it
  return isMobile || prefersReduced;
}

/**
 * Hook to detect if device is likely low-power (mobile + no hover capability)
 */
export function useIsLowPowerDevice(): boolean {
  const isMobile = useIsMobile();
  const noHover = useMediaQuery('(hover: none)');
  
  return isMobile && noHover;
}
