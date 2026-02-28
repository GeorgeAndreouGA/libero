'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import BetCard from '@/components/ui/BetCard';
import Badge from '@/components/ui/Badge';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import { FiFilter, FiLock, FiUnlock, FiChevronDown, FiTarget, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguageStore } from '@/stores/languageStore';
import { useShouldReduceMotion, useIsMobile } from '@/hooks/useMediaQuery';

type ResultFilter = 'ALL' | 'IN_PROGRESS' | 'FINISHED' | 'WIN' | 'LOST' | 'CASH_OUT';

interface Category {
  id: string;
  name: string;
  nameEl?: string;
  description?: string;
  descriptionEl?: string;
  standardBet: number;
  hasAccess: boolean;
}

// Helper to get category name based on locale
const getCategoryName = (category: Category, locale: string) => {
  if (locale === 'el' && category.nameEl) {
    return category.nameEl;
  }
  return category.name;
};

// Helper to get category description based on locale
const getCategoryDescription = (category: Category, locale: string) => {
  if (locale === 'el' && category.descriptionEl) {
    return category.descriptionEl;
  }
  return category.description;
};

interface Bet {
  id: string;
  imageUrl?: string;
  odds: string;
  result: 'IN_PROGRESS' | 'WIN' | 'LOST' | 'CASH_OUT';
  createdAt: string;
  publishedAt: string;
  categoryId: string;
  categoryName: string;
  categoryNameEl?: string;
  standardBet: number;
}

// Helper to get bet category name based on locale
const getBetCategoryName = (bet: Bet, locale: string) => {
  if (locale === 'el' && bet.categoryNameEl) {
    return bet.categoryNameEl;
  }
  return bet.categoryName;
};

export default function BetsPage() {
  const t = useTranslations('bets');
  const tDashboard = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { locale } = useLanguageStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Performance hooks
  const shouldReduceMotion = useShouldReduceMotion();
  const isMobile = useIsMobile();

  const [categories, setCategories] = useState<Category[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL');
  const [showFinishedDropdown, setShowFinishedDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Check for payment success
  useEffect(() => {
    const payment = searchParams?.get('payment');
    if (payment === 'success') {
      setPaymentSuccess(true);
      window.history.replaceState({}, '', '/bets');
    }
  }, [searchParams]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch categories and stats on initial load
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchInitialData = async () => {
      try {
        const [categoriesData, statsData] = await Promise.all([
          api.getAllCategoriesWithAccess(),
          api.getDashboardStats(),
        ]);
        setCategories(categoriesData);
        setStats(statsData);
      } catch (err: any) {
        console.error('Failed to fetch initial data:', err);
      }
    };

    fetchInitialData();
  }, [isAuthenticated]);

  // Fetch bets whenever filters change (including initial load)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBets();
  }, [isAuthenticated, selectedCategory, resultFilter]);

  const fetchBets = async () => {
    try {
      setLoading(true);
      setPage(1);
      const betsResponse = await api.getBets(
        selectedCategory || undefined,
        resultFilter !== 'ALL' ? resultFilter : undefined,
        1, 50
      );
      setBets(betsResponse.data || []);
      setHasMore((betsResponse.pagination?.page || 1) < (betsResponse.pagination?.totalPages || 1));
    } catch (err: any) {
      console.error('Failed to fetch bets:', err);
      setError(err.response?.data?.message || 'Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  // Load more bets
  const loadMoreBets = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const betsResponse = await api.getBets(
        selectedCategory || undefined,
        resultFilter !== 'ALL' ? resultFilter : undefined,
        nextPage, 50
      );
      setBets(prev => [...prev, ...(betsResponse.data || [])]);
      setPage(nextPage);
      setHasMore(nextPage < (betsResponse.pagination?.totalPages || 1));
    } catch (err) {
      console.error('Failed to load more bets:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle category selection
  const handleCategoryClick = (category: Category) => {
    if (!category.hasAccess) {
      // Redirect to packs page to upgrade
      router.push('/packs');
      return;
    }
    setSelectedCategory(category.id === selectedCategory ? null : category.id);
  };

  // Bets are now filtered server-side, no client-side filtering needed

  // Memoize category lists
  const { accessibleCategories, inaccessibleCategories } = useMemo(() => ({
    accessibleCategories: categories.filter(c => c.hasAccess),
    inaccessibleCategories: categories.filter(c => !c.hasAccess),
  }), [categories]);

  // Animation variants - simplified for mobile
  const containerVariants = shouldReduceMotion ? {} : {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  if (authLoading || !isAuthenticated) {
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

  // Render content - use simpler animations on mobile
  const renderContent = () => (
    <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
      {/* Payment Success Message */}
      {paymentSuccess && (
        <div className={`mb-6 ${shouldReduceMotion ? '' : 'animate-fade-in'}`}>
          <Card variant="glass" className="bg-green-500/10 border-green-500/50" animated={false}>
            <div className="flex items-center gap-3">
              <FiCheckCircle className="text-2xl text-neon-green" />
              <div>
                <p className="text-neon-green font-semibold">{t('paymentSuccessTitle')}</p>
                <p className="text-gray-300 text-sm">{t('paymentSuccessMessage')}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Welcome Header */}
      <div className={`mb-6 sm:mb-8 ${shouldReduceMotion ? '' : 'animate-fade-in'}`}>
        <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-neon-cyan mb-4 text-shadow-glow-light sm:text-shadow-glow">
          {tDashboard('welcome')}, {user?.username?.toUpperCase() || 'USER'}
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-300">
          {t('subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatsCard
          title={tDashboard('stats.betsReceived')}
          value={stats?.betsReceived || 0}
          icon={<FiTarget />}
        />
        <StatsCard
          title={tDashboard('stats.winRate')}
          value={stats?.winRate || 0}
          suffix="%"
          icon={<FiTrendingUp />}
          variant="green"
        />
      </div>

      {/* Categories Grid */}
      <div className="mb-6 sm:mb-8">
        <h2 className="font-orbitron text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FiFilter className="text-neon-cyan" />
          {t('categories')}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* All Button */}
          <button
            onClick={() => setSelectedCategory(null)}
            className={`p-3 sm:p-4 rounded-xl border-2 transition-all active:scale-95 ${selectedCategory === null
                ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                : 'border-white/10 bg-white/5 text-gray-300 sm:hover:border-neon-cyan/50'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FiUnlock className="text-green-400" />
              <span className="font-bold text-sm sm:text-base">{t('allCategories')}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {accessibleCategories.length} {t('categories').toLowerCase()}
            </p>
          </button>

          {/* Accessible Categories */}
          {accessibleCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className={`p-3 sm:p-4 rounded-xl border-2 transition-all active:scale-95 ${selectedCategory === category.id
                  ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                  : 'border-white/10 bg-white/5 text-gray-300 sm:hover:border-neon-cyan/50'
                }`}
              title={getCategoryDescription(category, locale) || undefined}
            >
              <div className="flex items-center justify-center gap-2">
                <FiUnlock className="text-green-400" />
                <span className="font-bold text-xs sm:text-sm">{getCategoryName(category, locale)}</span>
              </div>
              {getCategoryDescription(category, locale) && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{getCategoryDescription(category, locale)}</p>
              )}
            </button>
          ))}

          {/* Inaccessible Categories */}
          {inaccessibleCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className="p-3 sm:p-4 rounded-xl border-2 border-red-500/30 bg-red-500/5 text-gray-400 sm:hover:border-red-500/50 transition-all active:scale-95"
              title={getCategoryDescription(category, locale) || undefined}
            >
              <div className="flex items-center justify-center gap-2">
                <FiLock className="text-red-400" />
                <span className="font-bold text-xs sm:text-sm">{getCategoryName(category, locale)}</span>
              </div>
              {getCategoryDescription(category, locale) && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{getCategoryDescription(category, locale)}</p>
              )}
              <p className="text-xs text-red-400 mt-1">{t('upgradeToAccess')}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Result Filters */}
      <div className="glass-panel-mobile p-3 sm:p-4 rounded-xl mb-6 sm:mb-8 overflow-visible relative z-20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          <span className="text-gray-400 font-bold text-sm sm:text-base">{t('filterByResult')}</span>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setResultFilter('ALL')}
              className="transition-all"
            >
              <Badge
                variant="blue"
                className={`cursor-pointer ${resultFilter === 'ALL' ? 'opacity-100 ring-2 ring-neon-cyan' : 'opacity-50 active:opacity-75 sm:hover:opacity-75'}`}
              >
                {t('results.all')}
              </Badge>
            </button>

            <button
              onClick={() => setResultFilter('IN_PROGRESS')}
              className="transition-all"
            >
              <Badge
                variant="blue"
                className={`cursor-pointer ${resultFilter === 'IN_PROGRESS' ? 'opacity-100 ring-2 ring-neon-cyan' : 'opacity-50 active:opacity-75 sm:hover:opacity-75'}`}
              >
                {t('results.inProgress')}
              </Badge>
            </button>

            {/* Finished dropdown */}
            <div className="relative z-50">
              <button
                onClick={() => setShowFinishedDropdown(!showFinishedDropdown)}
                className="transition-all"
              >
                <Badge
                  variant={resultFilter === 'WIN' ? 'green' : resultFilter === 'LOST' ? 'red' : resultFilter === 'CASH_OUT' ? 'orange' : resultFilter === 'FINISHED' ? 'orange' : 'blue'}
                  className={`cursor-pointer flex items-center gap-1 ${['FINISHED', 'WIN', 'LOST', 'CASH_OUT'].includes(resultFilter)
                      ? 'opacity-100 ring-2 ring-neon-cyan'
                      : 'opacity-50 active:opacity-75 sm:hover:opacity-75'
                    }`}
                >
                  {resultFilter === 'WIN' ? t('results.win') : resultFilter === 'LOST' ? t('results.lost') : resultFilter === 'CASH_OUT' ? t('results.cashOut') : t('results.finished')}
                  <FiChevronDown className={`transition-transform ${showFinishedDropdown ? 'rotate-180' : ''}`} />
                </Badge>
              </button>

              <AnimatePresence>
                {showFinishedDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 z-[100] glass-panel-mobile rounded-lg min-w-[120px] shadow-lg border border-white/10"
                    style={{ background: 'rgba(15, 23, 42, 0.95)' }}
                  >
                    <button
                      onClick={() => {
                        setResultFilter('FINISHED');
                        setShowFinishedDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-gray-300 active:bg-neon-cyan/10 sm:hover:bg-neon-cyan/10 active:text-neon-cyan sm:hover:text-neon-cyan transition-colors"
                    >
                      {t('results.finished')}
                    </button>
                    <button
                      onClick={() => {
                        setResultFilter('WIN');
                        setShowFinishedDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-green-400 active:bg-green-500/10 sm:hover:bg-green-500/10 transition-colors"
                    >
                      {t('results.win')}
                    </button>
                    <button
                      onClick={() => {
                        setResultFilter('LOST');
                        setShowFinishedDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-red-400 active:bg-red-500/10 sm:hover:bg-red-500/10 transition-colors"
                    >
                      {t('results.lost')}
                    </button>
                    <button
                      onClick={() => {
                        setResultFilter('CASH_OUT');
                        setShowFinishedDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-orange-400 active:bg-orange-500/10 sm:hover:bg-orange-500/10 transition-colors"
                    >
                      {t('results.cashOut')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Access Info - Hide upgrade prompt when viewing finished bets */}
      {accessibleCategories.length > 0 && !['FINISHED', 'WIN', 'LOST', 'CASH_OUT'].includes(resultFilter) && (
        <div className="mb-8">
          <Panel>
            <div className="p-4">
              <h3 className="font-orbitron text-lg font-bold text-neon-cyan mb-3">
                {t('yourAccess')}
              </h3>
              <p className="text-gray-300 mb-3">
                {t('accessTo')} <span className="text-neon-orange font-bold">{accessibleCategories.length}</span> {t('bettingCategories')}
              </p>
              <div className="flex flex-wrap gap-2">
                {accessibleCategories.map((cat) => (
                  <Badge key={cat.id} variant="green" size="sm">
                    {getCategoryName(cat, locale)}
                  </Badge>
                ))}
              </div>
              {inaccessibleCategories.length > 0 && (
                <p className="text-gray-500 text-sm mt-3">
                  <span className="text-red-400">{inaccessibleCategories.length}</span> {t('moreCategories')}
                </p>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Bets Grid - optimized for mobile */}
      {bets.length > 0 ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* On mobile, render without AnimatePresence for better performance */}
            {shouldReduceMotion ? (
              bets.map((bet) => (
                <div key={bet.id}>
                  <BetCard {...bet} categoryName={getBetCategoryName(bet, locale)} />
                </div>
              ))
            ) : (
              <AnimatePresence mode="popLayout">
                {bets.map((bet, index) => (
                  <motion.div
                    key={bet.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3) }} // Cap delay at 0.3s
                    layout={!isMobile} // Disable layout animations on mobile
                  >
                    <BetCard {...bet} categoryName={getBetCategoryName(bet, locale)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={loadMoreBets}
                disabled={loadingMore}
              >
                {loadingMore ? tCommon('loading') : tCommon('loadMore') || 'Load More'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20">
          <Panel>
            <div className="py-8">
              <p className="text-2xl text-gray-400 mb-4">
                {accessibleCategories.length === 0
                  ? t('needSubscription')
                  : selectedCategory
                    ? t('noBetsForCategory')
                    : t('noMatchingBets')}
              </p>
              {accessibleCategories.length === 0 ? (
                <Button onClick={() => router.push('/packs')}>
                  {t('viewPacks')}
                </Button>
              ) : selectedCategory ? (
                <Button onClick={() => setSelectedCategory(null)}>
                  {t('showAllBets')}
                </Button>
              ) : (
                <Button onClick={() => setResultFilter('ALL')}>
                  {t('clearFilters')}
                </Button>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      {renderContent()}
    </div>
  );
}
