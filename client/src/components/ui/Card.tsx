'use client';

import { motion } from 'framer-motion';
import { ReactNode, memo } from 'react';
import clsx from 'clsx';
import { useShouldReduceMotion, useIsMobile } from '@/hooks/useMediaQuery';

interface CardProps {
  children: ReactNode;
  variant?: 'blue' | 'orange' | 'purple' | 'green' | 'glass';
  hover?: boolean;
  onClick?: () => void;
  className?: string;
  animated?: boolean;
}

// Memoize to prevent unnecessary re-renders
const Card = memo(function Card({
  children,
  variant = 'glass',
  hover = true,
  onClick,
  className,
  animated = true,
}: CardProps) {
  const shouldReduceMotion = useShouldReduceMotion();
  const isMobile = useIsMobile();

  // Disable animations on mobile or when user prefers reduced motion
  const enableAnimations = animated && !shouldReduceMotion;
  // Disable hover effects on mobile (touch devices)
  const enableHover = hover && !isMobile;

  const variantClasses = {
    blue: 'neon-border bg-cyber-navy/50 backdrop-blur-mobile',
    orange: 'neon-border-orange bg-cyber-navy/50 backdrop-blur-mobile',
    purple: 'neon-border-purple bg-cyber-navy/50 backdrop-blur-mobile',
    green: 'border-2 border-neon-green/50 rounded-xl bg-cyber-navy/50 backdrop-blur-mobile shadow-card-green',
    glass: 'glass-panel-mobile',
  };

  const hoverClasses = enableHover ? 'hover:scale-105 hover:shadow-2xl cursor-pointer' : onClick ? 'cursor-pointer' : '';

  const card = (
    <div
      onClick={onClick}
      className={clsx(
        'relative rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 transition-all duration-300',
        variantClasses[variant],
        hoverClasses,
        className
      )}
    >
      {/* Animated inner glow - only on desktop with animations enabled */}
      {enableAnimations && !isMobile && (
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none"
          animate={{
            background: [
              'radial-gradient(circle at 0% 0%, rgba(0, 229, 255, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 100% 100%, rgba(0, 229, 255, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 0% 0%, rgba(0, 229, 255, 0.3) 0%, transparent 50%)',
            ],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      
      <div className="relative z-10">{children}</div>
    </div>
  );

  // Skip framer-motion wrapper on mobile
  if (!enableAnimations || isMobile) {
    return card;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={enableHover ? { scale: 1.02 } : undefined}
    >
      {card}
    </motion.div>
  );
});

export default Card;
