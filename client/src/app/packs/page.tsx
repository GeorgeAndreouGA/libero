'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Panel from '@/components/ui/Panel';
import { FiShoppingCart, FiCheck, FiLock, FiArrowUp } from 'react-icons/fi';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguageStore } from '@/stores/languageStore';

// Helper to get category name based on locale
const getCategoryName = (category: any, locale: string) => {
  if (locale === 'el' && category.nameEl) {
    return category.nameEl;
  }
  return category.name;
};

// Helper to get category description based on locale
const getCategoryDescription = (category: any, locale: string) => {
  if (locale === 'el' && category.descriptionEl) {
    return category.descriptionEl;
  }
  return category.description;
};

export default function PlansPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { locale } = useLanguageStore();
  const t = useTranslations('packs');
  const tCommon = useTranslations('common');
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [packs, setPacks] = useState<any[]>([]);
  const [currentUserPack, setCurrentUserPack] = useState<any | null>(null);
  const [userPacks, setUserPacks] = useState<any[]>([]); // All user's active packs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const packsData = await api.getPacks();
        setPacks(packsData);

        // If user is logged in, fetch their current subscription
        if (isAuthenticated && user) {
          try {
            const myPacks = await api.getMyPacks();
            if (myPacks && myPacks.length > 0) {
              // Store ALL user packs
              setUserPacks(myPacks);
              // Get the highest tier PAID pack the user has (for upgrade comparison)
              const paidPacks = myPacks.filter((p: any) => !p.isFree);
              if (paidPacks.length > 0) {
                setCurrentUserPack(paidPacks[0]);
              }
            }
          } catch (err) {
            console.error('Failed to fetch user packs:', err);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch packs:', err);
        setError(err.response?.data?.message || 'Failed to load packs');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchData();
    }
  }, [isAuthenticated, user, authLoading]);

  const handlePackClick = (packId: string) => {
    if (!isAuthenticated) {
      // Not logged in - redirect to signup
      router.push('/signup');
      return;
    }

    // Check if it's a free pack - can't purchase free packs
    const selectedPackData = packs.find(p => p.id === packId);
    if (selectedPackData?.isFree) {
      return; // Free packs are auto-assigned, can't be purchased
    }

    // Check if trying to downgrade
    if (currentUserPack) {
      if (selectedPackData && selectedPackData.priceMonthly < currentUserPack.priceMonthly) {
        alert('Downgrades are not allowed. You can only upgrade to higher tiers.');
        return;
      }
    }

    setSelectedPack(packId);
  };

  const handleCheckout = async () => {
    if (!selectedPack) return;

    try {
      const response = await api.createSubscription(selectedPack);
      // Redirect to Stripe checkout or show success
      window.location.href = response.checkoutUrl || '/dashboard';
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create subscription');
    }
  };

  const selectedPackData = packs.find((p) => p.id === selectedPack);

  // Calculate upgrade price
  const getUpgradePrice = (pack: any) => {
    if (!currentUserPack || pack.priceMonthly <= currentUserPack.priceMonthly) {
      return pack.priceMonthly;
    }
    return pack.priceMonthly - currentUserPack.priceMonthly;
  };

  const isUpgrade = (pack: any) => {
    return currentUserPack && pack.priceMonthly > currentUserPack.priceMonthly;
  };

  // Check if pack should show as ACTIVE
  // - If user has a paid pack: only show that paid pack as active
  // - If user has no paid pack: show all free packs as active
  const isCurrentPack = (pack: any) => {
    if (currentUserPack) {
      // User has a paid pack - only show the paid pack as active
      return pack.id === currentUserPack.id;
    }
    // User has no paid pack - show free packs as active
    return userPacks.some((userPack: any) => userPack.id === pack.id);
  };

  const isDowngrade = (pack: any) => {
    return currentUserPack && pack.priceMonthly < currentUserPack.priceMonthly && !pack.isFree;
  };

  if (loading || authLoading) {
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

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-16"
        >
          <h1 className="font-orbitron text-3xl sm:text-5xl md:text-7xl font-bold text-neon-cyan mb-4 sm:mb-6 text-shadow-glow">
            {t('title')}
          </h1>
          <p className="text-base sm:text-xl text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            {isAuthenticated ? t('subtitleAuth') : t('subtitle')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <Badge variant="blue" size="lg">
              {t('hierarchicalAccess')}
            </Badge>
            {isAuthenticated && (
              <Badge variant="green" size="lg">
                {t('upgradeOnly')}
              </Badge>
            )}
            {!isAuthenticated && (
              <Badge variant="orange" size="lg">
                {t('signUpRequired')}
              </Badge>
            )}
          </div>

          {currentUserPack && (
            <div className="mt-4 sm:mt-6">
              <Badge variant="green" size="lg">
                {t('currentPack')}: {currentUserPack.name}
              </Badge>
            </div>
          )}
        </motion.div>

        {/* Packs Grid */}
        {packs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto mb-12 sm:mb-16">
              {packs.map((pack, index) => {
                // Free packs are auto-included, can't be selected for purchase
                const canSelect = isAuthenticated && !isCurrentPack(pack) && !isDowngrade(pack) && !pack.isFree;
                const upgradePrice = getUpgradePrice(pack);

                return (
                  <motion.div
                    key={pack.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.15 }}
                    onClick={() => canSelect && handlePackClick(pack.id)}
                    className={`glass-panel p-4 sm:p-6 rounded-2xl transition-all duration-300 ${isCurrentPack(pack)
                        ? 'ring-2 ring-neon-green opacity-75'
                        : isDowngrade(pack)
                          ? 'opacity-50 cursor-not-allowed'
                          : canSelect
                            ? selectedPack === pack.id
                              ? 'neon-border ring-2 ring-neon-cyan cursor-pointer'
                              : 'border border-gray-700 hover:border-neon-cyan/50 cursor-pointer'
                            : !isAuthenticated
                              ? 'border border-gray-700 hover:border-neon-cyan/50 cursor-pointer'
                              : 'opacity-75 cursor-not-allowed'
                      }`}
                  >
                    {/* Pack Header */}
                    <div className="mb-4 sm:mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-orbitron text-lg sm:text-2xl font-bold text-white">
                          {pack.name}
                        </h3>
                        {selectedPack === pack.id && isAuthenticated && !isCurrentPack(pack) && (
                          <FiCheck className="text-neon-cyan text-xl sm:text-2xl" />
                        )}
                        {isCurrentPack(pack) && (
                          <Badge variant="green" size="sm">{t('active')}</Badge>
                        )}
                        {isDowngrade(pack) && (
                          <FiLock className="text-red-400 text-lg sm:text-xl" />
                        )}
                      </div>

                      {pack.isFree ? (
                        <p className="font-orbitron text-2xl sm:text-3xl font-bold text-neon-green">
                          {t('free')}
                        </p>
                      ) : isUpgrade(pack) ? (
                        <div>
                          <p className="font-orbitron text-2xl sm:text-3xl font-bold text-neon-orange">
                            €{upgradePrice}
                            <span className="text-xs sm:text-sm text-gray-400">{t('perMonth')}</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {t('upgradeFrom', { price: currentUserPack.priceMonthly, savings: currentUserPack.priceMonthly })}
                          </p>
                        </div>
                      ) : (
                        <p className="font-orbitron text-2xl sm:text-3xl font-bold text-neon-orange">
                          €{pack.priceMonthly}
                          <span className="text-xs sm:text-sm text-gray-400">{t('perMonth')}</span>
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    {pack.description && (
                      <p className="text-gray-400 text-xs sm:text-sm mb-4">{pack.description}</p>
                    )}

                    {/* Categories */}
                    <div className="space-y-2 sm:space-y-3">
                      <p className="text-xs font-bold text-neon-cyan uppercase tracking-wider">
                        {t('includedCategories')}
                      </p>
                      {pack.categories && pack.categories.length > 0 ? (
                        <ul className="space-y-1 sm:space-y-2">
                          {pack.categories.map((category: any) => (
                            <li key={category.id} className="flex items-start gap-2 text-xs sm:text-sm" title={getCategoryDescription(category, locale) || undefined}>
                              <FiCheck className="text-neon-green mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-gray-300">{getCategoryName(category, locale)}</span>
                                {getCategoryDescription(category, locale) && (
                                  <p className="text-gray-500 text-xs line-clamp-1">{getCategoryDescription(category, locale)}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-xs sm:text-sm italic">{t('noCategories')}</p>
                      )}
                    </div>

                    {/* Includes lower packs info */}
                    {pack.includedPacks && pack.includedPacks.filter((p: any) => p?.name).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <p className="text-xs text-neon-cyan mb-1">{t('includesFrom')}</p>
                        <p className="text-xs text-gray-400">
                          {pack.includedPacks.filter((p: any) => p?.name).map((p: any) => p.name).join(', ')}
                        </p>
                      </div>
                    )}

                    {/* Status Messages */}
                    {Boolean(pack.isFree) && isAuthenticated && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <p className="text-xs text-neon-green flex items-center gap-2">
                          <FiCheck /> {t('includedWithAccount')}
                        </p>
                      </div>
                    )}
                    {!isAuthenticated && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <p className="text-xs text-orange-400 flex items-center gap-2">
                          <FiLock /> {t('signUpToAccess')}
                        </p>
                      </div>
                    )}
                    {isDowngrade(pack) && !Boolean(pack.isFree) && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <p className="text-xs text-red-400 flex items-center gap-2">
                          <FiLock /> {t('downgradeNotAllowed')}
                        </p>
                      </div>
                    )}
                    {isUpgrade(pack) && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <p className="text-xs text-neon-green flex items-center gap-2">
                          <FiArrowUp /> {t('upgradeAvailable')}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Checkout Summary */}
            {selectedPack && selectedPackData && isAuthenticated && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <div className="glass-panel neon-border p-4 sm:p-8 rounded-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
                    <div>
                      <h3 className="font-orbitron text-xl sm:text-2xl font-bold text-neon-cyan mb-2">
                        {t('checkout.selectedPack')} {selectedPackData.name}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {selectedPackData.categories?.length || 0} {t('includedCategories')}
                        {selectedPackData.includedPacks && selectedPackData.includedPacks.filter((p: any) => p?.name).length > 0 &&
                          ` + ${t('includesFrom')} ${selectedPackData.includedPacks.filter((p: any) => p?.name).map((p: any) => p.name).join(', ')}`}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm text-gray-400 mb-1">
                        {isUpgrade(selectedPackData) ? t('checkout.upgradePrice') : t('checkout.price')}
                      </p>
                      <p className="font-orbitron text-3xl sm:text-4xl font-bold text-neon-orange text-shadow-orange">
                        €{getUpgradePrice(selectedPackData)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={isUpgrade(selectedPackData) ? <FiArrowUp /> : <FiShoppingCart />}
                    onClick={handleCheckout}
                  >
                    {t('checkout.proceedToPayment')}
                  </Button>

                  {/* Billing explanation */}
                  <div className="mt-4 p-4 bg-dark-200 border border-gray-700 rounded-lg">
                    {isUpgrade(selectedPackData) ? (
                      <>
                        <p className="text-xs text-neon-orange font-bold mb-2">{t('billing.upgradeTitle')}</p>
                        <p className="text-xs text-gray-300 mb-1">
                          • {t('billing.thisMonth', { price: getUpgradePrice(selectedPackData) })}
                        </p>
                        <p className="text-xs text-gray-300 mb-1">
                          • {t('billing.newSubscriptionPeriod')}
                        </p>
                        <p className="text-xs text-gray-300 mb-2">
                          • {t('billing.nextRenewal', { price: selectedPackData.priceMonthly })}
                        </p>
                        <p className="text-xs text-red-400 font-bold mb-2">
                          {t('billing.noCancellationsUpgrade')}
                        </p>
                        <p className="text-xs text-red-500 font-bold mb-2">
                          {t('billing.noAutoRenewal')}
                        </p>
                        <p className="text-xs text-neon-cyan">
                          {t('billing.confirmationEmail')}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-300 mb-1">
                          {t('billing.monthlyBilling', { price: selectedPackData.priceMonthly })}
                        </p>
                        <p className="text-xs text-gray-300 mb-2">
                          {t('billing.subscriptionPeriod')}
                        </p>
                        <p className="text-xs text-red-400 font-bold mb-2">
                          {t('billing.noCancellationsNew')}
                        </p>
                        <p className="text-xs text-red-500 font-bold mb-2">
                          {t('billing.noAutoRenewal')}
                        </p>
                        <p className="text-xs text-neon-cyan">
                          {t('billing.confirmationEmailNew')}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <Panel>
              <div className="py-8">
                <p className="text-2xl text-gray-400">{t('noPacksAvailable')}</p>
              </div>
            </Panel>
          </div>
        )}

      </div>
    </div>
  );
}


