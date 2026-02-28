'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { FiMail, FiLock, FiUser, FiCheck, FiX, FiCreditCard, FiPackage, FiTrash2, FiShield, FiGlobe, FiDownload, FiAlertTriangle } from 'react-icons/fi';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth.signup.passwordRequirements');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toggling2FA, setToggling2FA] = useState(false);
  const [changingLanguage, setChangingLanguage] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Check for payment success
  useEffect(() => {
    const payment = searchParams?.get('payment');
    if (payment === 'success') {
      setSuccess(t('paymentSuccess'));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Only fetch subscriptions for non-admin users
        const profileData = await api.getProfile();
        setProfile(profileData);
        
        if (profileData.role !== 'admin') {
          const subsData = await api.getActiveSubscriptions();
          setSubscriptions(subsData);
        }
      } catch (err: any) {
        console.error('Failed to fetch profile:', err);
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated]);

  // Password validation helper
  const validatePassword = (password: string) => {
    return {
      length: password.length >= 10,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
  };

  const passwordValidation = validatePassword(newPassword);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet all requirements');
      return;
    }

    setPasswordLoading(true);

    try {
      const result = await api.changePassword(currentPassword, newPassword);
      setSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    const newState = !profile?.twoFactorEnabled;
    const confirmMessage = newState 
      ? t('twoFactor.enableConfirm')
      : t('twoFactor.disableConfirm');
    
    if (!confirm(confirmMessage)) return;

    setToggling2FA(true);
    setError('');
    setSuccess('');

    try {
      await api.toggle2FA(newState);
      setProfile((prev: any) => ({ ...prev, twoFactorEnabled: newState }));
      setSuccess(newState 
        ? t('twoFactor.enabledSuccess')
        : t('twoFactor.disabledSuccess'));
    } catch (err: any) {
      setError(err.response?.data?.message || tErrors('generic'));
    } finally {
      setToggling2FA(false);
    }
  };

  // Handle language change (admin only)
  const handleChangeLanguage = async (newLanguage: string) => {
    if (newLanguage === profile?.preferredLanguage) return;
    
    setChangingLanguage(true);
    setError('');
    setSuccess('');

    try {
      await api.updateLanguage(newLanguage);
      // Update the NEXT_LOCALE cookie for UI translation
      document.cookie = `NEXT_LOCALE=${newLanguage};path=/;max-age=31536000`;
      // Reload page to apply new translations
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to update language:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update language');
      setChangingLanguage(false);
    }
  };

  // Handle exporting user data (GDPR)
  const handleExportData = async () => {
    setExportingData(true);
    setError('');
    
    try {
      const data = await api.exportUserData();
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(t('dataPrivacy.exportSuccess'));
    } catch (err: any) {
      setError(err.response?.data?.message || tErrors('generic'));
    } finally {
      setExportingData(false);
    }
  };

  // Handle account deletion (GDPR Right to be Forgotten)
  const handleDeleteAccount = async () => {
    if (!deletePassword || !deleteConfirm) {
      setError('Please enter your password and confirm deletion');
      return;
    }

    setDeletingAccount(true);
    setError('');

    try {
      await api.deleteAccount(deletePassword, deleteConfirm);
      // Clear tokens and redirect to home
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/?deleted=true';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setDeletingAccount(false);
    }
  };

  if (loading || isLoading) {
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

        {/* Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card variant="glass" className="bg-red-500/10 border-red-500/50">
              <p className="text-red-400">{error}</p>
            </Card>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card variant="glass" className="bg-green-500/10 border-green-500/50">
              <p className="text-neon-green">{success}</p>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Profile Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Panel title={t('info.title')} subtitle={t('info.subtitle')}>
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center">
                    <FiUser className="text-xl sm:text-2xl text-white" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400">{t('info.username')}</p>
                    <p className="text-base sm:text-lg text-white font-semibold">{profile?.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center">
                    <FiMail className="text-xl sm:text-2xl text-white" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400">{t('info.email')}</p>
                    <p className="text-base sm:text-lg text-white font-semibold break-all">{profile?.email}</p>
                  </div>
                </div>
              </div>
            </Panel>
          </motion.div>

          {/* Subscription Info - Only for non-admin users */}
          {profile?.role !== 'admin' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Panel title={t('subscription.title')} subtitle={t('subscription.subtitle')}>
                <div className="space-y-4">
                  {subscriptions.filter(s => !s.isFree).length > 0 ? (
                    <>
                      {subscriptions.filter(s => !s.isFree).map((sub) => (
                        <Card key={sub.id} variant="glass" className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green to-neon-cyan flex items-center justify-center">
                              <FiPackage className="text-xl text-white" />
                            </div>
                            <div>
                              <p className="text-white font-semibold">{sub.packName}</p>
                              <p className="text-sm text-gray-400">€{sub.priceMonthly}{t('subscription.perMonth')}</p>
                            </div>
                          </div>
                          <Badge variant="green">{t('subscription.active')}</Badge>
                        </Card>
                      ))}
                      <p className="text-xs text-gray-500 text-center">
                        {t('subscription.noAutoRenew')}
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-400 mb-4">{t('subscription.noSubscription')}</p>
                      <Button
                        onClick={() => router.push('/packs')}
                        icon={<FiPackage />}
                      >
                        {t('subscription.viewPacks')}
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            </motion.div>
          )}

          {/* Manage Payment Methods - Only for non-admin users */}
          {profile?.role !== 'admin' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
            >
              <Panel title={t('paymentMethods.title')} subtitle={t('paymentMethods.manageSubtitle')}>
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm mb-4">
                    {t('paymentMethods.manageDescription')}
                  </p>
                  <Button
                    onClick={async () => {
                      setOpeningPortal(true);
                      try {
                        const { url } = await api.createCustomerPortal();
                        window.location.href = url;
                      } catch (err: any) {
                        setError(err.response?.data?.message || tErrors('generic'));
                        setOpeningPortal(false);
                      }
                    }}
                    disabled={openingPortal}
                    icon={<FiCreditCard />}
                    variant="secondary"
                  >
                    {openingPortal ? t('paymentMethods.opening') : t('paymentMethods.manageButton')}
                  </Button>
                </div>
              </Panel>
            </motion.div>
          )}

          {/* Change Password */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Panel title={t('changePassword.title')} subtitle={t('changePassword.subtitle')}>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('changePassword.currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-cyber-navy/50 border border-neon-cyan/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('changePassword.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-cyber-navy/50 border border-neon-cyan/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder="••••••••"
                  />
                  {newPassword && (
                    <div className="mt-3 space-y-1 text-xs sm:text-sm">
                      <div className={`flex items-center gap-2 ${passwordValidation.length ? 'text-neon-green' : 'text-gray-400'}`}>
                        {passwordValidation.length ? <FiCheck /> : <FiX />}
                        {tAuth('length')}
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.uppercase ? 'text-neon-green' : 'text-gray-400'}`}>
                        {passwordValidation.uppercase ? <FiCheck /> : <FiX />}
                        {tAuth('uppercase')}
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.lowercase ? 'text-neon-green' : 'text-gray-400'}`}>
                        {passwordValidation.lowercase ? <FiCheck /> : <FiX />}
                        {tAuth('lowercase')}
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.number ? 'text-neon-green' : 'text-gray-400'}`}>
                        {passwordValidation.number ? <FiCheck /> : <FiX />}
                        {tAuth('number')}
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.special ? 'text-neon-green' : 'text-gray-400'}`}>
                        {passwordValidation.special ? <FiCheck /> : <FiX />}
                        {tAuth('special')}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('changePassword.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-cyber-navy/50 border border-neon-cyan/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder="••••••••"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  icon={<FiLock />}
                >
                  {passwordLoading ? t('changePassword.changing') : t('changePassword.submit')}
                </Button>
              </form>
            </Panel>
          </motion.div>
        </div>

        {/* Two-Factor Authentication - Full width below the grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 sm:mt-8"
        >
          <Panel title={t('twoFactor.title')} subtitle={t('twoFactor.subtitle')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center">
                    <FiShield className="text-xl text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{t('twoFactor.emailVerification')}</p>
                    <p className="text-sm text-gray-400">
                      {t('twoFactor.emailVerificationDesc')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggle2FA}
                  disabled={toggling2FA}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    profile?.twoFactorEnabled 
                      ? 'bg-neon-green' 
                      : 'bg-gray-500'
                  } ${toggling2FA ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span 
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      profile?.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className={`p-3 rounded-lg ${
                profile?.twoFactorEnabled 
                  ? 'bg-neon-green/10 border border-neon-green/30' 
                  : 'bg-yellow-500/10 border border-yellow-500/30'
              }`}>
                <p className={`text-sm ${
                  profile?.twoFactorEnabled ? 'text-neon-green' : 'text-yellow-400'
                }`}>
                  {profile?.twoFactorEnabled 
                    ? `✓ ${t('twoFactor.enabled')}`
                    : `⚠ ${t('twoFactor.disabled')}`}
                </p>
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Language Preference - Full width below 2FA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6 sm:mt-8"
        >
          <Panel title={t('language.title')} subtitle={t('language.subtitle')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center">
                    <FiGlobe className="text-xl text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{t('language.preferredLanguage')}</p>
                    <p className="text-sm text-gray-400">
                      {profile?.role === 'admin' 
                        ? t('language.adminHint')
                        : t('language.lockedDescription')}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  {profile?.role === 'admin' ? (
                    <select
                      value={profile?.preferredLanguage || 'en'}
                      onChange={(e) => handleChangeLanguage(e.target.value)}
                      disabled={changingLanguage}
                      className="bg-cyber-navy/50 border border-neon-blue/30 rounded-lg px-4 py-2 text-white cursor-pointer focus:outline-none focus:border-neon-cyan hover:border-neon-cyan/50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      <option value="en">🇬🇧 English</option>
                      <option value="el">🇬🇷 Ελληνικά</option>
                    </select>
                  ) : (
                    <div className="bg-cyber-navy/50 border border-gray-600/30 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed">
                      {profile?.preferredLanguage === 'el' ? '🇬🇷 Ελληνικά' : '🇬🇧 English'}
                    </div>
                  )}
                </div>
              </div>
              {/* Only show warning for non-admin users */}
              {profile?.role !== 'admin' && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400">
                    ⚠️ {t('language.lockedHint')}
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </motion.div>

        {/* Data & Privacy Section - Only for non-admin users */}
        {profile?.role !== 'admin' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 sm:mt-8"
          >
            <Panel title={t('dataPrivacy.title')} subtitle={t('dataPrivacy.subtitle')}>
              <div className="space-y-6">
                {/* Export Data */}
                <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-neon-blue/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-blue to-neon-cyan flex items-center justify-center">
                      <FiDownload className="text-xl text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{t('dataPrivacy.exportData')}</p>
                      <p className="text-sm text-gray-400">
                        {t('dataPrivacy.exportDataDesc')}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleExportData}
                    disabled={exportingData}
                    variant="secondary"
                    icon={<FiDownload />}
                  >
                    {exportingData ? t('dataPrivacy.exporting') : t('dataPrivacy.exportButton')}
                  </Button>
                </div>

                {/* Delete Account */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                      <FiTrash2 className="text-xl text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{t('dataPrivacy.deleteAccount')}</p>
                      <p className="text-sm text-gray-400">
                        {t('dataPrivacy.deleteAccountDesc')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
                  >
                    {t('dataPrivacy.deleteAccount')}
                  </button>
                </div>

                {/* Info box */}
                <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/30">
                  <p className="text-sm text-gray-400">
                    {t('dataPrivacy.gdprInfo')}
                  </p>
                </div>
              </div>
            </Panel>
          </motion.div>
        )}

        {/* Delete Account Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-cyber-dark border border-red-500/50 rounded-xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <FiAlertTriangle className="text-2xl text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-red-400">{t('deleteModal.title')}</h3>
                  <p className="text-sm text-gray-400">{t('deleteModal.subtitle')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">
                    ⚠️ {t('deleteModal.warning')}
                  </p>
                  <ul className="text-sm text-red-300 mt-2 space-y-1 list-disc list-inside">
                    <li>{t('deleteModal.warningList.profile')}</li>
                    <li>{t('deleteModal.warningList.subscriptions')}</li>
                    <li>{t('deleteModal.warningList.telegram')}</li>
                    <li>{t('deleteModal.warningList.access')}</li>
                    <li>{t('deleteModal.warningList.transactions')}</li>
                  </ul>
                  <p className="text-sm text-red-400 mt-3 font-semibold">
                    💰 {t('deleteModal.noRefunds')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {t('deleteModal.passwordLabel')}
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder={t('deleteModal.passwordPlaceholder')}
                    className="w-full px-4 py-2 bg-cyber-navy/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {t('deleteModal.reasonLabel')}
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder={t('deleteModal.reasonPlaceholder')}
                    rows={2}
                    className="w-full px-4 py-2 bg-cyber-navy/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500 transition-colors resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-300">
                    {t('deleteModal.confirmLabel')}
                  </span>
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletePassword('');
                      setDeleteReason('');
                      setDeleteConfirm(false);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    {t('deleteModal.cancel')}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={!deletePassword || !deleteConfirm || deletingAccount}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingAccount ? t('deleteModal.deleting') : t('deleteModal.deleteButton')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
