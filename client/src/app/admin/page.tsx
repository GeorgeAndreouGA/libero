'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import StatsCard from '@/components/ui/StatsCard';
import Panel from '@/components/ui/Panel';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { FiUsers, FiDollarSign, FiTrendingUp, FiActivity, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { api } from '@/lib/api';

interface RevenueData {
  monthlyData: { month: string; total: number; transactions: number }[];
  totalRevenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  growth: number;
}

export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const tCommon = useTranslations('common');
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, revenueData] = await Promise.all([
          api.getAdminStats(),
          api.getRevenueOverview(),
        ]);
        setStats(statsData);
        setRevenue(revenueData);
      } catch (err: any) {
        console.error('Failed to fetch admin stats:', err);
        setError(err.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-neon-cyan text-cyber-dark rounded-lg hover:bg-neon-blue transition-colors"
              >
                {tCommon('retry')}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const statsCards = [
    { title: t('stats.activeUsers'), value: stats?.activeUsers || 0, icon: <FiUsers />, variant: 'blue' as const },
    { title: t('stats.monthlyRevenue'), value: stats?.monthlyRevenue || 0, suffix: '€', icon: <FiDollarSign />, variant: 'green' as const },
    { title: t('stats.activeSubscriptions'), value: stats?.activeSubscriptions || 0, icon: <FiTrendingUp />, variant: 'orange' as const },
    { title: t('stats.betsPublished'), value: stats?.betsPublished || 0, icon: <FiActivity />, variant: 'purple' as const },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12"
        >
          <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-neon-cyan mb-4 text-shadow-glow">
            {t('title')}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Recent Subscriptions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Panel title={t('recentSubscriptions.title')} subtitle={t('recentSubscriptions.subtitle')}>
              {stats?.recentSubscriptions?.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {stats.recentSubscriptions.map((sub: any, index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                    >
                      <Card variant="glass" hover={false}>
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-white font-semibold truncate">{sub.user}</span>
                            <span className="font-orbitron text-neon-orange font-bold">
                              €{sub.amount}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                              {sub.packs?.map((pack: string) => (
                                <Badge key={pack} variant="blue" size="sm">
                                  {pack}
                                </Badge>
                              ))}
                            </div>
                            <span className="text-xs text-gray-400">{sub.date}</span>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-400">
                  {t('recentSubscriptions.noSubscriptions')}
                </div>
              )}
            </Panel>
          </motion.div>

          {/* Revenue Overview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Panel title={t('revenueOverview.title')} subtitle={t('revenueOverview.subtitle')}>
              <div className="space-y-6">
                {/* Revenue Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-panel p-4 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">This Month</p>
                    <p className="font-orbitron text-2xl font-bold text-neon-cyan">
                      €{revenue?.thisMonthRevenue?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div className="glass-panel p-4 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
                    <p className="font-orbitron text-2xl font-bold text-neon-orange">
                      €{revenue?.totalRevenue?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>

                {/* Growth Indicator */}
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Month over Month Growth</p>
                    <p className="text-gray-500 text-xs">vs Last Month: €{revenue?.lastMonthRevenue?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className={`flex items-center gap-2 font-orbitron text-xl font-bold ${
                    (revenue?.growth || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(revenue?.growth || 0) >= 0 ? <FiArrowUp /> : <FiArrowDown />}
                    {Math.abs(revenue?.growth || 0)}%
                  </div>
                </div>

                {/* Monthly Chart */}
                <div className="glass-panel p-4 rounded-xl">
                  <p className="text-gray-400 text-sm mb-4">Last 6 Months</p>
                  <div className="flex items-end justify-between gap-2 h-32">
                    {revenue?.monthlyData?.length ? (
                      revenue.monthlyData.map((month, index) => {
                        const maxValue = Math.max(...revenue.monthlyData.map(m => m.total), 1);
                        const height = (month.total / maxValue) * 100;
                        return (
                          <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                            <div 
                              className="w-full bg-gradient-to-t from-neon-cyan to-neon-blue rounded-t transition-all hover:opacity-80"
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`€${month.total.toFixed(2)} - ${month.transactions} transactions`}
                            />
                            <span className="text-xs text-gray-500">
                              {new Date(month.month + '-01').toLocaleDateString('en', { month: 'short' })}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No revenue data yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
