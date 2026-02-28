'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Button from '@/components/ui/Button';
import { FiArrowRight } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useShouldReduceMotion } from '@/hooks/useMediaQuery';

export default function Home() {
  const t = useTranslations('home');
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();
  const shouldReduceMotion = useShouldReduceMotion();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Redirect based on role
      if (user?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  // Simplified version for mobile - no framer-motion
  if (shouldReduceMotion) {
    return (
      <div className="min-h-screen">
        <Navbar />
        
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
          <div className="container mx-auto text-center">
            <div>
              <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold mb-6 text-shadow-glow-light sm:text-shadow-glow">
                <span className="bg-gradient-neon bg-clip-text text-transparent">
                  {t('hero.title1')}
                </span>
                <br />
                <span className="text-white">{t('hero.title2')}</span>
              </h1>

              <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-8 sm:mb-12 max-w-2xl mx-auto px-4">
                {t('hero.subtitle')}
              </p>

              <div>
                <Link href="/packs">
                  <Button size="lg" icon={<FiArrowRight />}>
                    {t('hero.cta')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Ready to Win Section */}
            <div className="mt-16 sm:mt-24 glass-panel-mobile neon-border p-6 sm:p-8 md:p-12 rounded-3xl max-w-3xl mx-auto">
              <h2 className="font-orbitron text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                {t('readyToWin.title')}
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8">
                {t('readyToWin.subtitle')}
              </p>
              <Link href="/signup">
                <Button size="lg" icon={<FiArrowRight />}>
                  {t('readyToWin.cta')}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Desktop version with full animations
  return (
    <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              className="font-orbitron text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold mb-6 text-shadow-glow"
              animate={{
                textShadow: [
                  '0 0 20px rgba(0, 229, 255, 0.8)',
                  '0 0 40px rgba(0, 229, 255, 1), 0 0 60px rgba(0, 229, 255, 0.8)',
                  '0 0 20px rgba(0, 229, 255, 0.8)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="bg-gradient-neon bg-clip-text text-transparent">
                {t('hero.title1')}
              </span>
              <br />
              <span className="text-white">{t('hero.title2')}</span>
            </motion.h1>

            <motion.p
              className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-8 sm:mb-12 max-w-2xl mx-auto px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Link href="/packs">
                <Button size="lg" icon={<FiArrowRight />}>
                  {t('hero.cta')}
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Ready to Win Section - Moved closer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            className="mt-16 sm:mt-24 glass-panel neon-border p-6 sm:p-8 md:p-12 rounded-3xl max-w-3xl mx-auto"
          >
            <h2 className="font-orbitron text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              {t('readyToWin.title')}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8">
              {t('readyToWin.subtitle')}
            </p>
            <Link href="/signup">
              <Button size="lg" icon={<FiArrowRight />}>
                {t('readyToWin.cta')}
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
