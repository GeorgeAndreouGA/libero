'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import { api } from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || null;
  const t = useTranslations('auth.verifyEmail');
  const tErrors = useTranslations('errors');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(tErrors('noVerificationToken'));
      return;
    }

    // Verify the email
    const verifyEmail = async () => {
      try {
        const response = await api.verifyEmail(token);
        setStatus('success');
        setMessage(response.message || t('successTitle'));
        // No automatic redirect - let user click the button
      } catch (error: any) {
        setStatus('error');
        const errorMessage = error.response?.data?.message || tErrors('verificationFailed');
        setMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [token, t, tErrors]);

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto text-center"
        >
          <Panel>
            <div className="py-8">
              {/* Verifying State */}
              {status === 'verifying' && (
                <>
                  <div className="w-20 h-20 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <h2 className="font-orbitron text-3xl font-bold text-neon-cyan mb-4">
                    {t('verifying')}
                  </h2>
                  <p className="text-gray-300">
                    {t('pleaseWait')}
                  </p>
                </>
              )}

              {/* Success State */}
              {status === 'success' && (
                <>
                  <div className="w-20 h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-neon-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="font-orbitron text-3xl font-bold text-neon-green mb-4">
                    {t('successTitle')} ✓
                  </h2>
                  <p className="text-gray-300 mb-4">
                    {message}
                  </p>
                  <div className="space-y-3 mt-6">
                    <p className="text-sm text-gray-400">
                      {t('accountActive')}
                    </p>
                    <Link
                      href="/login"
                      className="inline-block px-6 py-3 bg-neon-cyan text-cyber-dark rounded-lg hover:bg-neon-blue transition-colors font-semibold"
                    >
                      {t('goToLogin')}
                    </Link>
                  </div>
                </>
              )}

              {/* Error State */}
              {status === 'error' && (
                <>
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="font-orbitron text-3xl font-bold text-red-400 mb-4">
                    {t('failedTitle')}
                  </h2>
                  <p className="text-gray-300 mb-6">
                    {message}
                  </p>
                  
                  <div className="bg-cyber-navy/50 border border-neon-blue/30 rounded-lg p-4 mb-6 text-left">
                    <h3 className="text-neon-cyan font-semibold mb-2">{t('possibleReasons')}</h3>
                    <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                      <li>{t('reasonExpired')}</li>
                      <li>{t('reasonUsed')}</li>
                      <li>{t('reasonRemoved')}</li>
                      <li>{t('reasonInvalid')}</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <Link
                      href="/signup"
                      className="inline-block px-6 py-3 bg-neon-cyan text-cyber-dark rounded-lg hover:bg-neon-blue transition-colors font-semibold"
                    >
                      {t('signUpAgain')}
                    </Link>
                    <br />
                    <Link
                      href="/login"
                      className="inline-block text-neon-cyan hover:text-neon-blue transition-colors text-sm"
                    >
                      {t('orTryLogin')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail');
  
  return (
    <Suspense fallback={
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 pb-20">
          <div className="max-w-md mx-auto text-center">
            <Panel>
              <div className="py-8">
                <div className="w-20 h-20 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="font-orbitron text-3xl font-bold text-neon-cyan mb-4">
                  {t('loading')}
                </h2>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

