'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface BadgeProps {
  children: ReactNode;
  variant?: 'blue' | 'orange' | 'purple' | 'green' | 'red';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  className?: string;
}

export default function Badge({
  children,
  variant = 'blue',
  size = 'md',
  glow = true,
  className,
}: BadgeProps) {
  const isMobile = useIsMobile();
  
  // Disable glow effects on mobile for performance
  const enableGlow = glow && !isMobile;

  const variantClasses = {
    blue: 'bg-neon-blue/20 text-neon-blue border-neon-blue',
    orange: 'bg-neon-orange/20 text-neon-orange border-neon-orange',
    purple: 'bg-neon-purple/20 text-neon-purple border-neon-purple',
    green: 'bg-neon-green/20 text-neon-green border-neon-green',
    red: 'bg-red-500/20 text-red-400 border-red-400',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const glowClasses = {
    blue: enableGlow ? 'shadow-neon-blue' : '',
    orange: enableGlow ? 'shadow-neon-orange' : '',
    purple: enableGlow ? 'shadow-neon-purple' : '',
    green: enableGlow ? 'shadow-[0_0_20px_rgba(0,255,157,0.5)]' : '',
    red: enableGlow ? 'shadow-[0_0_20px_rgba(239,68,68,0.5)]' : '',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center font-exo font-semibold uppercase tracking-wider',
        'border-2 rounded-full',
        isMobile ? '' : 'backdrop-blur-sm', // Disable backdrop-blur on mobile
        'transition-all duration-300',
        variantClasses[variant],
        sizeClasses[size],
        glowClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
