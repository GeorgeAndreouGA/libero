'use client';

import { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { FiClock, FiCheckCircle, FiXCircle, FiLoader, FiImage, FiX, FiDollarSign } from 'react-icons/fi';
import Card from './Card';
import Badge from './Badge';
import { API_BASE_URL } from '@/lib/api';
import { useShouldReduceMotion, useIsMobile } from '@/hooks/useMediaQuery';

interface BetCardProps {
  id: string;
  imageUrl?: string;
  odds: string;
  result: 'IN_PROGRESS' | 'WIN' | 'LOST' | 'CASH_OUT';
  createdAt?: string;
  publishedAt?: string;
  categoryName?: string;
  standardBet?: number;
}

// Memoize the component to prevent unnecessary re-renders
const BetCard = memo(function BetCard({
  imageUrl,
  odds,
  result,
  createdAt,
  publishedAt,
  categoryName,
  standardBet,
}: BetCardProps) {
  const [imageError, setImageError] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('common');
  
  // Performance hooks - only for animations, NOT for image loading
  const shouldReduceMotion = useShouldReduceMotion();
  const isMobile = useIsMobile();

  // For portal to work in SSR
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const resultConfig = {
    IN_PROGRESS: {
      variant: 'blue' as const,
      icon: <FiLoader className={shouldReduceMotion ? '' : 'animate-spin'} />,
      label: t('inProgress'),
      bgClass: 'from-blue-500/20 to-cyan-500/20',
    },
    WIN: {
      variant: 'green' as const,
      icon: <FiCheckCircle />,
      label: t('win'),
      bgClass: 'from-green-500/20 to-emerald-500/20',
    },
    LOST: {
      variant: 'red' as const,
      icon: <FiXCircle />,
      label: t('lost'),
      bgClass: 'from-red-500/20 to-rose-500/20',
    },
    CASH_OUT: {
      variant: 'orange' as const,
      icon: <FiDollarSign />,
      label: t('cashOut'),
      bgClass: 'from-orange-500/20 to-amber-500/20',
    },
  };

  const config = resultConfig[result] || resultConfig.IN_PROGRESS;

  // Card content - works on both mobile and desktop
  const cardContent = (
    <Card 
      variant="glass" 
      hover={!isMobile} // Disable hover effects on mobile only
      animated={!shouldReduceMotion} // Disable framer-motion animations on mobile
      className="relative overflow-hidden h-full"
    >
      {/* Result indicator line at top */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.bgClass} ${
          result === 'IN_PROGRESS' && !shouldReduceMotion ? 'animate-pulse' : ''
        }`}
      />
      
      <div className="space-y-3 sm:space-y-4">
        {/* Image - ALWAYS show, use native lazy loading */}
        {imageUrl && !imageError && (
          <div 
            className="relative w-full rounded-lg overflow-hidden bg-cyber-dark/50 cursor-pointer active:opacity-90 sm:hover:opacity-90 transition-opacity"
            onClick={() => setShowImageModal(true)}
          >
            <img
              src={`${API_BASE_URL}${imageUrl}`}
              alt="Bet image"
              className="w-full h-auto max-h-48 sm:max-h-64 object-contain"
              onError={() => setImageError(true)}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        
        {/* Image Zoom Modal - rendered via portal to escape overflow:hidden */}
        {mounted && showImageModal && imageUrl && createPortal(
          <div
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowImageModal(false)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute -top-10 right-0 text-white active:text-neon-cyan sm:hover:text-neon-cyan transition-colors z-10"
                aria-label="Close"
              >
                <FiX className="w-8 h-8" />
              </button>
              <img
                src={`${API_BASE_URL}${imageUrl}`}
                alt="Bet image"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          </div>,
          document.body
        )}
        
        {/* Fallback when image fails to load or no image */}
        {(!imageUrl || imageError) && (
          <div className="relative w-full h-32 sm:h-48 rounded-lg overflow-hidden bg-cyber-dark/50 flex items-center justify-center">
            <FiImage className="w-8 h-8 sm:w-12 sm:h-12 text-gray-600" />
          </div>
        )}
        
        {/* Header with Category and Result aligned on same row */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {categoryName && (
              <Badge variant="blue" size="sm">
                {categoryName}
              </Badge>
            )}
            <Badge variant={config.variant} size="sm" className="flex items-center gap-1 shrink-0 ml-auto">
              {config.icon}
              {config.label}
            </Badge>
          </div>
        </div>
        
        {/* Odds */}
        <div className="glass-panel-light p-3 sm:p-4 rounded-lg sm:rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs sm:text-sm uppercase font-medium">{t('odds')}</span>
            <span className="font-orbitron text-xl sm:text-2xl font-bold text-neon-orange text-shadow-orange-light">
              {odds}
            </span>
          </div>
        </div>
        
        {/* Standard Bet */}
        {standardBet !== undefined && (
          <div className="glass-panel-light p-3 sm:p-4 rounded-lg sm:rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs sm:text-sm uppercase font-medium">Standard Bet</span>
              <span className="font-orbitron text-lg sm:text-xl font-bold text-neon-cyan text-shadow-glow-light">
                €{standardBet.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        
        {/* Meta Info */}
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-2 border-t border-white/10">
          <FiClock className="shrink-0" />
          <span>{createdAt || publishedAt || t('recentlyAdded')}</span>
        </div>
      </div>
    </Card>
  );

  // On mobile, skip framer-motion wrapper for better performance
  if (shouldReduceMotion) {
    return cardContent;
  }

  // Desktop: use framer-motion animations
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.3 }}
    >
      {cardContent}
    </motion.div>
  );
});

export default BetCard;
