'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { FiCheck } from 'react-icons/fi';
import Card from './Card';
import Button from './Button';
import Badge from './Badge';
import { useShouldReduceMotion, useIsMobile } from '@/hooks/useMediaQuery';

interface PlanCardProps {
  name: string;
  price: number;
  packLevel: 'SIMPLE' | 'SIMPLE_PLUS' | 'PREMIUM';
  features: string[];
  isSelected?: boolean;
  isPopular?: boolean;
  onSelect?: () => void;
}

export default function PlanCard({
  name,
  price,
  packLevel,
  features,
  isSelected = false,
  isPopular = false,
  onSelect,
}: PlanCardProps) {
  const t = useTranslations('common');
  const shouldReduceMotion = useShouldReduceMotion();
  const isMobile = useIsMobile();
  
  const variantMap = {
    SIMPLE: 'blue',
    SIMPLE_PLUS: 'orange',
    PREMIUM: 'purple',
  } as const;

  const variant = variantMap[packLevel];

  const cardContent = (
    <div className="relative">
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Badge variant="orange" glow={!isMobile}>{t('mostPopular')}</Badge>
        </div>
      )}
      
      <Card
        variant={variant}
        hover={false}
        animated={!shouldReduceMotion}
        className={`h-full transition-all duration-300 ${
          isSelected ? 'ring-4 ring-neon-cyan scale-105' : ''
        }`}
      >
        <div className="text-center">
          {/* Plan Name */}
          <h3 className="font-orbitron text-lg sm:text-xl md:text-2xl font-bold text-neon-cyan mb-2 uppercase">
            {name}
          </h3>
          
          {/* Price */}
          <div className="my-4 sm:my-6">
            <span className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold text-white text-shadow-glow-light sm:text-shadow-glow">
              €{price}
            </span>
            <span className="text-gray-400 text-xs sm:text-sm ml-2">/month</span>
          </div>
          
          {/* Features - simplified for mobile */}
          <div className="space-y-2 sm:space-y-3 my-6 sm:my-8 text-left">
            {features.map((feature, index) => (
              shouldReduceMotion ? (
                <div key={index} className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-cyan/20 flex items-center justify-center">
                    <FiCheck className="text-neon-cyan text-xs sm:text-sm" />
                  </div>
                  <span className="text-gray-300 text-xs sm:text-sm">{feature}</span>
                </div>
              ) : (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2 sm:gap-3"
                >
                  <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-cyan/20 flex items-center justify-center">
                    <FiCheck className="text-neon-cyan text-xs sm:text-sm" />
                  </div>
                  <span className="text-gray-300 text-xs sm:text-sm">{feature}</span>
                </motion.div>
              )
            ))}
          </div>
          
          {/* CTA Button */}
          <Button
            variant={isSelected ? 'secondary' : 'primary'}
            fullWidth
            onClick={onSelect}
          >
            {isSelected ? t('selected') : t('selectPlan')}
          </Button>
        </div>
      </Card>
    </div>
  );

  // On mobile, skip framer-motion wrapper
  if (shouldReduceMotion) {
    return cardContent;
  }

  // Desktop: animated wrapper
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      {cardContent}
    </motion.div>
  );
}
