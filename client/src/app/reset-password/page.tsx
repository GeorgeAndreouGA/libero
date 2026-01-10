'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import { FiLock, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { api } from '@/lib/api';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || null;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const t = useTranslations('auth.resetPassword');
  const tSignup = useTranslations('auth.signup.passwordRequirements');
  const tErrors = useTranslations('errors');

  useEffect(() => {
    if (!token) {
      setError(tErrors('invalidOrMissingToken'));
    }
  }, [token, tErrors]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 10) {
      errors.push(t('atLeast10Chars'));
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push(t('oneLowercase'));
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push(t('oneUppercase'));
    }
    if (!/\d/.test(pwd)) {
      errors.push(t('oneNumber'));
    }
    if (!/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      errors.push(t('oneSpecial'));
    }
    return errors;
  };

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    setValidationErrors(validatePassword(pwd));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(tErrors('invalidOrMissingToken'));
      return;
    }

    if (password !== confirmPassword) {
      setError(tErrors('passwordsDoNotMatch'));
      return;
    }

    const errors = validatePassword(password);
    if (errors.length > 0) {
      setError(tErrors('passwordDoesNotMeetRequirements'));
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || tErrors('failedToResetPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <Panel className="p-6 sm:p-8">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {t('title')}
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">
                {success 
                  ? t('success')
                  : t('subtitle')
                }
              </p>
            </div>

            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg 
                        className="w-6 h-6 text-green-500" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-green-400 font-semibold mb-1">
                        {t('successTitle')}
                      </h3>
                      <p className="text-gray-300 text-sm">
                        {t('successMessage')}
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        {t('redirecting')}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={<FiArrowRight />}
                  onClick={() => router.push('/login')}
                >
                  {t('goToLogin')}
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
                  >
                    <p className="text-red-400 text-sm">{error}</p>
                  </motion.div>
                )}

                {!token && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm">
                      {t('noToken')}{' '}
                      <Link href="/forgot-password" className="text-neon-cyan hover:text-neon-blue underline">
                        {t('forgotPasswordPage')}
                      </Link>.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t('newPassword')}
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan z-10" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      required
                      disabled={!token}
                      className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                      placeholder="••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-neon-cyan transition-colors"
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  
                  {/* Password requirements */}
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-400 font-semibold">{t('passwordMustContain')}</p>
                    {[
                      { text: t('atLeast10Chars'), valid: password.length >= 10 },
                      { text: t('oneUppercase'), valid: /[A-Z]/.test(password) },
                      { text: t('oneLowercase'), valid: /[a-z]/.test(password) },
                      { text: t('oneNumber'), valid: /\d/.test(password) },
                      { text: t('oneSpecial'), valid: /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
                    ].map((req, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            req.valid ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        />
                        <span
                          className={`text-xs ${
                            req.valid ? 'text-green-400' : 'text-gray-500'
                          }`}
                        >
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t('confirmPassword')}
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan z-10" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={!token}
                      className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-3 pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-neon-cyan transition-colors"
                    >
                      {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">{tErrors('passwordsDoNotMatch')}</p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-green-400 mt-1">{t('passwordsMatch')}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token || validationErrors.length > 0 || password !== confirmPassword}
                  className="relative w-full font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-xl light-sweep overflow-hidden bg-gradient-to-r from-neon-blue to-neon-cyan text-cyber-dark hover:scale-105 glow-blue border-2 border-neon-blue px-8 py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? t('resetting') : t('submit')}
                    <FiArrowRight />
                  </span>
                  <div className="absolute inset-0 bg-white/20 blur-xl"></div>
                </button>

                <div className="text-center text-sm text-gray-400 pt-4 border-t border-gray-700">
                  {t('rememberPassword')}{' '}
                  <Link
                    href="/login"
                    className="text-neon-cyan hover:text-neon-blue transition-colors font-semibold"
                  >
                    {t('backToLogin')}
                  </Link>
                </div>
              </form>
            )}
          </Panel>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-center"
          >
            <div className="bg-cyber-navy/50 border border-neon-blue/20 rounded-lg p-4">
              <p className="text-gray-400 text-sm">
                <strong className="text-neon-cyan">{t('securityTip')}</strong> {t('securityTipText')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

