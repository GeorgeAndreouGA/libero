'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import clsx from 'clsx';
import { useShouldReduceMotion } from '@/hooks/useMediaQuery';

interface PanelProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'bordered';
  className?: string;
}

export default function Panel({
  children,
  title,
  subtitle,
  variant = 'default',
  className,
}: PanelProps) {
  const shouldReduceMotion = useShouldReduceMotion();

  const content = (
    <>
      {(title || subtitle) && (
        <div className="mb-4 sm:mb-6 border-b border-white/10 pb-3 sm:pb-4">
          {title && (
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-neon-cyan mb-1 sm:mb-2 text-shadow-glow-light sm:text-shadow-glow">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </>
  );

  // On mobile, skip framer-motion for better performance
  if (shouldReduceMotion) {
    return (
      <div
        className={clsx(
          'glass-panel-mobile p-4 sm:p-6 md:p-8',
          variant === 'bordered' && 'border-2 border-neon-blue/30',
          className
        )}
      >
        {content}
      </div>
    );
  }

  // Desktop: use framer-motion animation
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={clsx(
        'glass-panel p-4 sm:p-6 md:p-8',
        variant === 'bordered' && 'border-2 border-neon-blue/30',
        className
      )}
    >
      {content}
    </motion.div>
  );
}
