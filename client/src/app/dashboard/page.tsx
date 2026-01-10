'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Card from '@/components/ui/Card';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import StatsCard from '@/components/ui/StatsCard';
import { FiTrendingUp, FiTarget, FiCheckCircle } from 'react-icons/fi';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    // Check for payment success query param
    const payment = searchParams?.get('payment');
    if (payment === 'success') {
      setPaymentSuccess(true);
      // Clear the query param from URL without refresh
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (err: any) {
        console.error('Failed to fetch dashboard stats:', err);
        setError(err.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
            <p className="mt-4 text-gray-400">{tCommon('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
          <Panel>
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>{tCommon('retry')}</Button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const statsCards = [
    { title: t('stats.betsReceived'), value: stats?.betsReceived || 0, icon: <FiTarget /> },
    { title: t('stats.winRate'), value: stats?.winRate || 0, suffix: '%', icon: <FiTrendingUp />, variant: 'green' as const },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        {/* Payment Success Message */}
        {paymentSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card variant="glass" className="bg-green-500/10 border-green-500/50">
              <div className="flex items-center gap-3">
                <FiCheckCircle className="text-2xl text-neon-green" />
                <div>
                  <p className="text-neon-green font-semibold">Payment Successful!</p>
                  <p className="text-gray-300 text-sm">Your subscription is now active. Enjoy your premium content!</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12"
        >
          <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-neon-cyan mb-4 text-shadow-glow">
            {t('welcome')}, {user?.username?.toUpperCase() || 'USER'}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <StatsCard {...stat} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
