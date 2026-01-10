'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import clsx from 'clsx';
import { useShouldReduceMotion, useIsMobile } from '@/hooks/useMediaQuery';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  icon,
  className,
  type = 'button',
}: ButtonProps) {
  const shouldReduceMotion = useShouldReduceMotion();
  const isMobile = useIsMobile();

  const baseClasses = 'relative font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-xl overflow-hidden';
  
  // Simplified variant classes for mobile (no glow effects)
  const variantClasses = {
    primary: `bg-gradient-to-r from-neon-blue to-neon-cyan text-cyber-dark sm:hover:scale-105 border-2 border-neon-blue ${isMobile ? '' : 'glow-blue'}`,
    secondary: `bg-gradient-to-r from-neon-orange to-yellow-500 text-cyber-dark sm:hover:scale-105 border-2 border-neon-orange ${isMobile ? '' : 'glow-orange'}`,
    danger: `bg-gradient-to-r from-red-500 to-red-700 text-white sm:hover:scale-105 border-2 border-red-500 ${isMobile ? '' : 'shadow-neon-orange'}`,
    ghost: `bg-glass-white text-neon-cyan border-2 border-neon-cyan/30 sm:hover:border-neon-cyan ${isMobile ? '' : 'backdrop-blur-sm sm:hover:glow-blue'}`,
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  const buttonContent = (
    <>
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        {children}
      </span>
      
      {/* Animated glow effect - only on desktop */}
      {!shouldReduceMotion && (
        <motion.div
          className="absolute inset-0 bg-white/20 blur-xl"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </>
  );

  // On mobile, use simple button without framer-motion
  if (shouldReduceMotion) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        type={type}
        className={clsx(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          disabled && 'opacity-50 cursor-not-allowed',
          'active:scale-95', // Use CSS for touch feedback
          className
        )}
      >
        {buttonContent}
      </button>
    );
  }

  // Desktop: use framer-motion
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      type={type}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={clsx(
        baseClasses,
        'light-sweep',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {buttonContent}
    </motion.button>
  );
}
