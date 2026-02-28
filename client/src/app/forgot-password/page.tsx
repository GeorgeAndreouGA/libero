'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Captcha, { CaptchaRef } from '@/components/ui/Captcha';
import { FiMail, FiUser, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('auth.forgotPassword');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const captchaRef = useRef<CaptchaRef>(null);

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!captchaToken) {
      setError(tErrors('pleaseCompleteCaptcha'));
      return;
    }

    setLoading(true);

    try {
      const response = await api.forgotPassword(emailOrUsername, captchaToken);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || tErrors('failedToSendResetLink'));
      setCaptchaToken('');
      captchaRef.current?.reset();
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
                        {t('emailSentTitle')}
                      </h3>
                      <p className="text-gray-300 text-sm">
                        {t('emailSentMessage')}
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        {t('linkExpires')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    icon={<FiArrowLeft />}
                    onClick={() => window.location.href = '/login'}
                  >
                    {t('backToLogin')}
                  </Button>

                  <button
                    onClick={() => setSuccess(false)}
                    className="w-full text-sm text-neon-cyan hover:text-neon-blue transition-colors"
                  >
                    {t('didntReceive')}
                  </button>
                </div>
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

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t('email')}
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-neon-cyan">
                      <FiMail className="w-4 h-4" />
                      <span className="text-gray-500">/</span>
                      <FiUser className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      required
                      className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-16 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                      placeholder={t('emailPlaceholder')}
                    />
                  </div>
                </div>

                <Captcha ref={captchaRef} onVerify={handleCaptchaVerify} />

                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-xl light-sweep overflow-hidden bg-gradient-to-r from-neon-blue to-neon-cyan text-cyber-dark hover:scale-105 glow-blue border-2 border-neon-blue px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? t('sending') : t('submit')}
                    <FiArrowRight />
                  </span>
                  <div className="absolute inset-0 bg-white/20 blur-xl"></div>
                </button>

                <div className="space-y-3 pt-4 border-t border-gray-700">
                  <Link
                    href="/login"
                    className="flex items-center justify-center text-sm text-gray-400 hover:text-neon-cyan transition-colors"
                  >
                    <FiArrowLeft className="mr-2" />
                    {t('backToLogin')}
                  </Link>

                  <div className="text-center text-sm text-gray-400">
                    {t('noAccount')}{' '}
                    <Link
                      href="/signup"
                      className="text-neon-cyan hover:text-neon-blue transition-colors font-semibold"
                    >
                      {t('signUp')}
                    </Link>
                  </div>
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
                <strong className="text-neon-cyan">{t('securityNote')}</strong> {t('securityNoteText')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

