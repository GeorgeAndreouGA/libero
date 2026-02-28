'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Captcha, { CaptchaRef } from '@/components/ui/Captcha';
import { FiMail, FiLock, FiArrowRight, FiShield } from 'react-icons/fi';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get('redirect') ?? null;
  const setUser = useAuthStore((state) => state.setUser);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [resending, setResending] = useState(false);

  const captchaRef = useRef<CaptchaRef>(null);

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!captchaToken) {
      setError('Please complete the security check');
      return;
    }

    setLoading(true);

    try {
      const response = await api.login({ emailOrUsername, password, captchaToken });
      
      // Check if 2FA is required
      if (response.requiresTwoFactor) {
        setRequires2FA(true);
        setTwoFactorUserId(response.userId);
        setLoading(false);
        return;
      }
      
      setUser(response.user);
      
      // Set user's preferred language cookie before redirect
      const userLang = response.user.preferred_language || 'en';
      document.cookie = `NEXT_LOCALE=${userLang};path=/;max-age=31536000`;
      
      // Use full page navigation to ensure translations load correctly
      if (redirectUrl && response.user.role === 'admin') {
        window.location.href = redirectUrl;
      } else if (response.user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/bets';
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
      setCaptchaToken('');
      captchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.verify2FA(twoFactorUserId, twoFactorCode);
      setUser(response.user);
      
      // Set user's preferred language cookie before redirect
      const userLang = response.user.preferred_language || 'en';
      document.cookie = `NEXT_LOCALE=${userLang};path=/;max-age=31536000`;
      
      // Use full page navigation to ensure translations load correctly
      if (redirectUrl && response.user.role === 'admin') {
        window.location.href = redirectUrl;
      } else if (response.user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/bets';
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend2FA = async () => {
    setResending(true);
    setError('');
    
    try {
      await api.resend2FA(twoFactorUserId);
      setError(''); // Clear any previous error
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  // 2FA verification screen
  if (requires2FA) {
    return (
      <div className="min-h-screen">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <div className="text-center mb-6 sm:mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
                <FiShield className="text-3xl text-white" />
              </div>
              <h1 className="font-orbitron text-2xl sm:text-3xl font-bold text-neon-cyan mb-4 text-shadow-glow">
                Two-Factor Authentication
              </h1>
              <p className="text-gray-300 text-sm sm:text-base">
                Enter the verification code sent to your email
              </p>
            </div>

            <Panel>
              <form onSubmit={handleVerify2FA} className="space-y-4 sm:space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500 rounded-lg p-3 sm:p-4 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-4 px-4 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors"
                    placeholder="000000"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length !== 6}
                  className="relative w-full font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-xl light-sweep overflow-hidden bg-gradient-to-r from-neon-blue to-neon-cyan text-cyber-dark hover:scale-105 glow-blue border-2 border-neon-blue px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? 'Verifying...' : 'Verify'}
                    <FiArrowRight />
                  </span>
                  <div className="absolute inset-0 bg-white/20 blur-xl"></div>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResend2FA}
                    disabled={resending}
                    className="text-neon-cyan hover:text-neon-blue transition-colors text-sm"
                  >
                    {resending ? 'Sending...' : "Didn't receive a code? Resend"}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setRequires2FA(false);
                      setTwoFactorCode('');
                      setTwoFactorUserId('');
                    }}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    ← Back to login
                  </button>
                </div>
              </form>
            </Panel>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold text-neon-cyan mb-4 text-shadow-glow">
              {t('title')}
            </h1>
            <p className="text-gray-300 text-sm sm:text-base">
              {t('subtitle')}
            </p>
          </div>

          <Panel>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/20 border border-red-500 rounded-lg p-3 sm:p-4 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('emailOrUsername')}
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="text"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    required
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder={t('emailPlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('password')}
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder={t('passwordPlaceholder')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link
                  href="/forgot-password"
                  className="text-neon-cyan hover:text-neon-blue transition-colors"
                >
                  {t('forgotPassword')}
                </Link>
              </div>

              <Captcha
                ref={captchaRef}
                onVerify={handleCaptchaVerify}
              />

              <button
                type="submit"
                disabled={loading}
                className="relative w-full font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-xl light-sweep overflow-hidden bg-gradient-to-r from-neon-blue to-neon-cyan text-cyber-dark hover:scale-105 glow-blue border-2 border-neon-blue px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? t('loggingIn') : t('submit')}
                  <FiArrowRight />
                </span>
                <div className="absolute inset-0 bg-white/20 blur-xl"></div>
              </button>

              <div className="text-center text-sm text-gray-400">
                {t('noAccount')}{' '}
                <Link
                  href="/signup"
                  className="text-neon-cyan hover:text-neon-blue transition-colors font-semibold"
                >
                  {t('signUp')}
                </Link>
              </div>
            </form>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}