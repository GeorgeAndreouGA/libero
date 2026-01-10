'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import { FiTrendingUp, FiTrendingDown, FiAward, FiCalendar, FiDollarSign, FiClock, FiPackage, FiChevronDown, FiArchive } from 'react-icons/fi';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguageStore } from '@/stores/languageStore';

interface CategoryStatistics {
  id: string;
  name: string;
  nameEl?: string;
  standardBet: number;
  wins: number;
  losses: number;
  cashOuts: number;
  totalBets: number; // wins + losses (excludes cash outs for win rate)
  winRate: number;
  totalProfit: number;
}

// Helper to get category name based on locale
const getCategoryName = (category: CategoryStatistics, locale: string) => {
  if (locale === 'el' && category.nameEl) {
    return category.nameEl;
  }
  return category.name;
};

interface StatisticsResponse {
  categories: CategoryStatistics[];
  month: string | null;
  year: number | null;
}

interface MonthOption {
  month: number;
  year: number;
  label: string;
}

interface YearOption {
  year: number;
  label: string;
}

interface SubscriptionInfo {
  packName: string;
  daysRemaining: number;
  endDate: string;
  startDate: string;
  isActive: boolean;
}

interface HistoricalStatistic {
  id: string;
  year: number;
  month: number;
  isProfit: boolean;
  amount: number;
  runningTotal: number;
  notes: string | null;
}

interface HistoricalStatisticsResponse {
  statistics: HistoricalStatistic[];
  years: number[];
}

export default function StatisticsPage() {
  const t = useTranslations('statistics');
  const tCommon = useTranslations('common');
  const tSubscription = useTranslations('subscription');
  const { user, isAuthenticated } = useAuth();
  const { locale } = useLanguageStore();

  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [availableYears, setAvailableYears] = useState<YearOption[]>([]);
  const [historicalStats, setHistoricalStats] = useState<HistoricalStatisticsResponse | null>(null);
  const [historicalYearFilter, setHistoricalYearFilter] = useState<number | undefined>(undefined);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Get current month/year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Group months by year for better organization
  const monthsByYear = useMemo(() => {
    const grouped: { [year: number]: MonthOption[] } = {};
    availableMonths.forEach((m) => {
      if (!grouped[m.year]) {
        grouped[m.year] = [];
      }
      grouped[m.year].push(m);
    });
    return grouped;
  }, [availableMonths]);

  // Fetch available months and years
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const [months, years] = await Promise.all([
          api.getAvailableMonths(),
          api.getAvailableYears()
        ]);
        setAvailableMonths(months);
        setAvailableYears(years);
      } catch (err) {
        console.error('Failed to fetch available data:', err);
      }
    };
    fetchAvailableData();
  }, []);

  // Fetch historical statistics
  useEffect(() => {
    const fetchHistoricalStats = async () => {
      try {
        const data = await api.getHistoricalStatistics(historicalYearFilter);
        setHistoricalStats(data);
      } catch (err) {
        console.error('Failed to fetch historical statistics:', err);
      }
    };
    fetchHistoricalStats();
  }, [historicalYearFilter]);

  // Fetch subscription info for authenticated non-admin users
  useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      if (isAuthenticated && user?.role !== 'admin') {
        try {
          const dashboardStats = await api.getDashboardStats();
          if (dashboardStats.subscription) {
            setSubscriptionInfo(dashboardStats.subscription);
          }
        } catch (err) {
          console.error('Failed to fetch subscription info:', err);
        }
      }
    };
    fetchSubscriptionInfo();
  }, [isAuthenticated, user?.role]);

  // Fetch statistics
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        let month: number | undefined;
        let year: number | undefined;

        if (selectedPeriod === 'current') {
          month = currentMonth;
          year = currentYear;
        } else if (selectedPeriod === 'all') {
          // No filters for all time
        } else if (selectedPeriod.startsWith('year-')) {
          // Year only filter (e.g., "year-2025")
          year = parseInt(selectedPeriod.replace('year-', ''), 10);
        } else {
          // Month-Year filter (e.g., "12-2025")
          const [m, y] = selectedPeriod.split('-').map(Number);
          month = m;
          year = y;
        }

        const data = await api.getStatistics(month, year);
        setStatistics(data);
        setError('');
      } catch (err: any) {
        console.error('Failed to fetch statistics:', err);
        setError(err.response?.data?.message || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [selectedPeriod, currentMonth, currentYear]);

  // Calculate totals
  const totals = statistics?.categories.reduce(
    (acc, cat) => ({
      wins: acc.wins + cat.wins,
      losses: acc.losses + cat.losses,
      cashOuts: acc.cashOuts + (cat.cashOuts || 0),
      totalBets: acc.totalBets + cat.totalBets,
      totalProfit: acc.totalProfit + cat.totalProfit,
    }),
    { wins: 0, losses: 0, cashOuts: 0, totalBets: 0, totalProfit: 0 }
  ) || { wins: 0, losses: 0, cashOuts: 0, totalBets: 0, totalProfit: 0 };

  // Win rate excludes cash outs (only wins vs losses)
  const overallWinRate = totals.totalBets > 0 ? (totals.wins / totals.totalBets) * 100 : 0;

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
                className="px-4 py-2 bg-neon-cyan/20 text-neon-cyan rounded-lg hover:bg-neon-cyan/30 transition-colors"
              >
                {tCommon('retry')}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-neon-cyan mb-4 text-shadow-glow">
            {t('title')}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Period Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 sm:mb-8"
        >
          <Panel>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <FiCalendar className="text-neon-cyan text-xl" />
                <span className="text-gray-400 font-bold">{t('filterByPeriod')}:</span>
              </div>

              {/* Quick Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setSelectedPeriod('current')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedPeriod === 'current'
                      ? 'bg-neon-cyan text-dark-100'
                      : 'bg-dark-200 text-gray-300 hover:bg-dark-100 border border-gray-700'
                    }`}
                >
                  {t('currentMonth')}
                </button>
                <button
                  onClick={() => setSelectedPeriod('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedPeriod === 'all'
                      ? 'bg-neon-cyan text-dark-100'
                      : 'bg-dark-200 text-gray-300 hover:bg-dark-100 border border-gray-700'
                    }`}
                >
                  {t('allTime')}
                </button>
              </div>

              {/* Year Tabs */}
              {availableYears.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">{t('byYear')}:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableYears.map((y) => (
                      <button
                        key={y.year}
                        onClick={() => setSelectedPeriod(`year-${y.year}`)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedPeriod === `year-${y.year}`
                            ? 'bg-neon-orange text-dark-100'
                            : 'bg-dark-200 text-gray-300 hover:bg-dark-100 border border-gray-700'
                          }`}
                      >
                        {y.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Month Selection by Year */}
              {Object.keys(monthsByYear).length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">{t('byMonth')}:</p>
                  <div className="space-y-3">
                    {Object.entries(monthsByYear)
                      .sort(([a], [b]) => parseInt(b) - parseInt(a))
                      .map(([year, months]) => (
                        <div key={year}>
                          <p className="text-xs text-gray-400 mb-1 font-semibold">{year}</p>
                          <div className="flex flex-wrap gap-2">
                            {months.map((m) => {
                              const isCurrentMonth = m.month === currentMonth && m.year === currentYear;
                              return (
                                <button
                                  key={`${m.month}-${m.year}`}
                                  onClick={() => setSelectedPeriod(`${m.month}-${m.year}`)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedPeriod === `${m.month}-${m.year}`
                                      ? 'bg-neon-green text-dark-100'
                                      : isCurrentMonth
                                        ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30'
                                        : 'bg-dark-200 text-gray-300 hover:bg-dark-100 border border-gray-700'
                                    }`}
                                >
                                  {new Date(m.year, m.month - 1).toLocaleString('default', { month: 'short' })}
                                  {isCurrentMonth && ' ✓'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Current Selection Display */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  {t('showing')}: <span className="text-white font-semibold">
                    {selectedPeriod === 'current'
                      ? `${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                      : selectedPeriod === 'all'
                        ? t('allTime')
                        : selectedPeriod.startsWith('year-')
                          ? `${t('fullYear')} ${selectedPeriod.replace('year-', '')}`
                          : (() => {
                            const [m, y] = selectedPeriod.split('-').map(Number);
                            return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          })()
                    }
                  </span>
                </p>
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Subscription Status - Only for authenticated non-admin users */}
        {isAuthenticated && user?.role !== 'admin' && subscriptionInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 sm:mb-8"
          >
            <Panel>
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${subscriptionInfo.daysRemaining <= 3
                        ? 'bg-red-500/20'
                        : subscriptionInfo.daysRemaining <= 7
                          ? 'bg-yellow-500/20'
                          : 'bg-neon-green/20'
                      }`}>
                      <FiClock className={`text-2xl ${subscriptionInfo.daysRemaining <= 3
                          ? 'text-red-400'
                          : subscriptionInfo.daysRemaining <= 7
                            ? 'text-yellow-400'
                            : 'text-neon-green'
                        }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <FiPackage className="text-neon-cyan" />
                        <span className="text-white font-semibold">{subscriptionInfo.packName}</span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {tSubscription('expires')}: {new Date(subscriptionInfo.endDate).toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-US')}
                      </p>
                    </div>
                  </div>
                  <div className={`text-center sm:text-right px-4 py-2 rounded-lg ${subscriptionInfo.daysRemaining <= 3
                      ? 'bg-red-500/10 border border-red-500/30'
                      : subscriptionInfo.daysRemaining <= 7
                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                        : 'bg-neon-green/10 border border-neon-green/30'
                    }`}>
                    <p className={`text-2xl font-orbitron font-bold ${subscriptionInfo.daysRemaining <= 3
                        ? 'text-red-400'
                        : subscriptionInfo.daysRemaining <= 7
                          ? 'text-yellow-400'
                          : 'text-neon-green'
                      }`}>
                      {subscriptionInfo.daysRemaining}
                    </p>
                    <p className="text-xs text-gray-400">{tCommon('daysRemaining')}</p>
                  </div>
                </div>
                {subscriptionInfo.daysRemaining <= 7 && (
                  <p className={`mt-3 text-sm ${subscriptionInfo.daysRemaining <= 3 ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                    {subscriptionInfo.daysRemaining <= 3
                      ? `⚠️ ${tSubscription('expiringWarning')}! ${tSubscription('renewNow')}.`
                      : `⏰ ${tSubscription('expiresSoon')}`}
                  </p>
                )}
              </div>
            </Panel>
          </motion.div>
        )}

        {/* Overall Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 sm:mb-8"
        >
          <Panel>
            <div className="p-4 text-center">
              <FiAward className="mx-auto text-3xl text-green-400 mb-2" />
              <p className="text-2xl sm:text-3xl font-orbitron font-bold text-white">{totals.wins + totals.cashOuts}</p>
              <p className="text-gray-400 text-sm">{t('totalWins')}</p>
            </div>
          </Panel>
          <Panel>
            <div className="p-4 text-center">
              <FiTrendingDown className="mx-auto text-3xl text-red-400 mb-2" />
              <p className="text-2xl sm:text-3xl font-orbitron font-bold text-white">{totals.losses}</p>
              <p className="text-gray-400 text-sm">{t('totalLosses')}</p>
            </div>
          </Panel>
          <Panel>
            <div className="p-4 text-center">
              <FiTrendingUp className="mx-auto text-3xl text-neon-cyan mb-2" />
              <p className="text-2xl sm:text-3xl font-orbitron font-bold text-white">{overallWinRate.toFixed(1)}%</p>
              <p className="text-gray-400 text-sm">{t('winRate')}</p>
            </div>
          </Panel>
          <Panel>
            <div className="p-4 text-center">
              <FiDollarSign className="mx-auto text-3xl text-neon-orange mb-2" />
              <p className={`text-2xl sm:text-3xl font-orbitron font-bold ${totals.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totals.totalProfit >= 0 ? '+' : ''}€{totals.totalProfit.toFixed(2)}
              </p>
              <p className="text-gray-400 text-sm">{t('totalProfit')}</p>
            </div>
          </Panel>
        </motion.div>

        {/* Category Standard Bets Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6 sm:mb-8"
        >
          <Panel>
            <div className="p-4">
              <h3 className="font-orbitron text-lg font-bold text-neon-cyan mb-4 flex items-center gap-2">
                <FiDollarSign />
                {t('standardBets')}
              </h3>
              <div className="flex flex-wrap gap-3">
                {statistics?.categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-gray-300">{getCategoryName(cat, locale)}:</span>
                    <span className="font-orbitron font-bold text-neon-orange">€{cat.standardBet.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Category Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="font-orbitron text-xl sm:text-2xl font-bold text-white mb-4">
            {t('categoryBreakdown')}
          </h2>

          <div className="space-y-4">
            {statistics?.categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Panel>
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-orbitron text-lg sm:text-xl font-bold text-white">
                            {getCategoryName(category, locale)}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{t('wins')}:</span>
                            <span className="text-green-400 font-bold">{category.wins + (category.cashOuts || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{t('losses')}:</span>
                            <span className="text-red-400 font-bold">{category.losses}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{t('winRate')}:</span>
                            <span className="text-neon-cyan font-bold">{category.winRate.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-gray-400 text-sm mb-1">{t('profit')}</p>
                        <p className={`font-orbitron text-2xl sm:text-3xl font-bold ${category.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                          {category.totalProfit >= 0 ? '+' : ''}€{category.totalProfit.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar - shows success rate (wins + cashOuts) / total */}
                    {(category.wins + category.losses + (category.cashOuts || 0)) > 0 && (
                      <div className="mt-4">
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                            style={{ 
                              width: `${((category.wins + (category.cashOuts || 0)) / (category.wins + category.losses + (category.cashOuts || 0))) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Panel>
              </motion.div>
            ))}

            {statistics?.categories.length === 0 && (
              <Panel>
                <div className="text-center py-12">
                  <p className="text-2xl text-gray-400">{t('noStatistics')}</p>
                </div>
              </Panel>
            )}
          </div>
        </motion.div>

        {/* Historical Statistics Section */}
        {historicalStats && historicalStats.statistics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 sm:mt-12"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-orbitron text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <FiArchive className="text-neon-orange" />
                  {t('historical.title')}
                </h2>
                <p className="text-gray-400 text-sm mt-1">{t('historical.subtitle')}</p>
              </div>

              {/* Year Filter */}
              {historicalStats.years.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{t('historical.filterByYear')}:</span>
                  <select
                    value={historicalYearFilter || ''}
                    onChange={(e) => setHistoricalYearFilter(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="appearance-none bg-cyber-navy border border-gray-700 rounded-lg px-3 py-2 pr-8 text-gray-300 focus:border-neon-cyan focus:outline-none"
                  >
                    <option value="">{t('historical.allYears')}</option>
                    {historicalStats.years.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Note about calculation */}
            <div className="mb-4 p-3 bg-neon-orange/10 border border-neon-orange/30 rounded-lg">
              <p className="text-sm text-neon-orange">
                ℹ️ {t('historical.note')}
              </p>
            </div>

            <Panel>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">{t('historical.yearMonth')}</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">{t('historical.result')}</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">{t('historical.monthlyProfitLoss')}</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">{t('historical.runningTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalStats.statistics.map((stat, index) => {
                      const monthName = new Date(stat.year, stat.month - 1).toLocaleString(locale === 'el' ? 'el-GR' : 'en-US', { month: 'long' });
                      return (
                        <tr
                          key={stat.id}
                          className={`border-b border-gray-700/50 hover:bg-white/5 transition-colors ${index % 2 === 0 ? 'bg-dark-200/30' : ''}`}
                        >
                          <td className="py-3 px-4">
                            <span className="text-white font-medium">{monthName}</span>
                            <span className="text-gray-400 ml-2">{stat.year}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${stat.isProfit
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                              }`}>
                              {stat.isProfit ? t('historical.profit') : t('historical.loss')}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-orbitron font-bold ${stat.isProfit ? 'text-green-400' : 'text-red-400'
                            }`}>
                            {stat.isProfit ? '+' : '-'}€{stat.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-orbitron font-bold text-neon-cyan">
                            €{stat.runningTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </motion.div>
        )}
      </div>
    </div>
  );
}
