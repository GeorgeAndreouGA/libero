'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Card from './Card';
import { useShouldReduceMotion } from '@/hooks/useMediaQuery';

interface StatsCardProps {
  title: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  variant?: 'blue' | 'orange' | 'purple' | 'green';
}

export default function StatsCard({ title, value, suffix = '', icon, variant = 'blue' }: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const shouldReduceMotion = useShouldReduceMotion();

  useEffect(() => {
    // On mobile, skip the counting animation for performance
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, shouldReduceMotion]);

  // Simple version for mobile
  if (shouldReduceMotion) {
    return (
      <Card variant={variant} hover={false} animated={false} className="text-center">
        {icon && (
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="text-3xl sm:text-4xl md:text-5xl text-neon-cyan">{icon}</div>
          </div>
        )}
        <div>
          <h3 className="hud-text text-gray-400 mb-1 sm:mb-2 text-xs sm:text-sm">{title}</h3>
          <p className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold text-neon-cyan text-shadow-glow-light">
            {displayValue}{suffix}
          </p>
        </div>
      </Card>
    );
  }

  // Desktop: animated version
  return (
    <Card variant={variant} hover={false} className="text-center">
      {icon && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex justify-center mb-3 sm:mb-4"
        >
          <div className="text-3xl sm:text-4xl md:text-5xl text-neon-cyan">{icon}</div>
        </motion.div>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="hud-text text-gray-400 mb-1 sm:mb-2 text-xs sm:text-sm">{title}</h3>
        <p className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold text-neon-cyan text-shadow-glow">
          {displayValue}{suffix}
        </p>
      </motion.div>
    </Card>
  );
}
