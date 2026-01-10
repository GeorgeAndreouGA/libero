'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Captcha, { CaptchaRef } from '@/components/ui/Captcha';
import { FiMail, FiLock, FiUser, FiArrowRight, FiCheck, FiX, FiGlobe, FiCalendar } from 'react-icons/fi';
import { api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations('auth.signup');
  const tCommon = useTranslations('common');
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    language: 'en',
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const captchaRef = useRef<CaptchaRef>(null);

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

  // Age validation helper - must be at least 18 years old
  const validateAge = (dateOfBirth: string): boolean => {
    if (!dateOfBirth) return false;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  // Calculate max date (18 years ago from today)
  const getMaxDate = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 18);
    return today.toISOString().split('T')[0];
  };

  const passwordValidation = validatePassword(formData.password);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);
  const isAgeValid = validateAge(formData.dateOfBirth);

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet all requirements');
      return;
    }

    if (!isAgeValid) {
      setError('You must be at least 18 years old to use this service');
      return;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!captchaToken) {
      setError('Please complete the security check');
      return;
    }

    setLoading(true);

    try {
      await api.signup({
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        dateOfBirth: formData.dateOfBirth,
        language: formData.language,
        captchaToken,
      });
      
      setSuccess(true);
      // Removed auto-redirect - user should keep tab open until verified
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
      setCaptchaToken('');
      captchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  // Handler for resending verification email
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleResendVerification = async () => {
    if (resending) return;
    setResending(true);
    setResendMessage('');
    
    try {
      await api.resendVerificationEmail(formData.email);
      setResendMessage('Verification email resent! Check your inbox.');
    } catch (err: any) {
      setResendMessage('Could not resend email. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto text-center"
          >
            <Panel>
              <div className="py-6 sm:py-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-neon-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-neon-cyan mb-4">
                  {t('success.title')}
                </h2>
                <p className="text-gray-300 mb-4 text-sm sm:text-base">
                  {t('success.message')}
                </p>
                
                {/* Warning Box - Keep Tab Open */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-left">
                      <p className="text-yellow-500 font-semibold text-sm mb-1">
                        {t('success.keepTabOpen') || 'Keep This Tab Open!'}
                      </p>
                      <p className="text-yellow-400/80 text-xs">
                        {t('success.keepTabOpenMessage') || 'Do not close this browser tab until you verify your email. Click the link in your email to complete registration.'}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-gray-400 mb-4">
                  {t('success.warning')}
                </p>

                {/* Resend Verification Link */}
                <div className="border-t border-neon-blue/20 pt-4 mt-4">
                  <p className="text-xs text-gray-400 mb-3">
                    {t('success.didntReceive') || "Didn't receive the email?"}
                  </p>
                  <button
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-neon-cyan hover:text-neon-blue transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resending ? (t('success.resending') || 'Resending...') : (t('success.resendLink') || 'Resend Verification Email')}
                  </button>
                  {resendMessage && (
                    <p className={`text-xs mt-2 ${resendMessage.includes('resent') ? 'text-neon-green' : 'text-red-400'}`}>
                      {resendMessage}
                    </p>
                  )}
                </div>

                <div className="space-y-3 mt-6">
                  <p className="text-xs text-gray-500">
                    {t('success.alreadyVerified') || 'Already verified? You can now log in.'}
                  </p>
                  <Link
                    href="/login"
                    className="inline-block px-6 py-2 bg-neon-cyan text-cyber-dark rounded-lg hover:bg-neon-blue transition-colors font-semibold text-sm sm:text-base"
                  >
                    {t('success.goToLogin')}
                  </Link>
                </div>
              </div>
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
            <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold text-neon-cyan mb-3 sm:mb-4 text-shadow-glow">
              {t('title')}
            </h1>
            <p className="text-gray-300 text-sm sm:text-base">
              {t('subtitle')}
            </p>
          </div>

          <Panel>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    minLength={2}
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder={t('fullNamePlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('username')}
                </label>
                <p className="text-xs text-red-400 font-medium mb-2">
                  ⚠️ {t('usernameEnglishOnly')}
                </p>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                    required
                    minLength={3}
                    maxLength={50}
                    pattern="[a-zA-Z0-9_]+"
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder={t('usernamePlaceholder')}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('usernameHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('email')}
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder={t('emailPlaceholder')}
                  />
                </div>
              </div>

              {/* Date of Birth - Age Verification */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('dateOfBirth') || 'Date of Birth'}
                </label>
                <div className="relative">
                  <FiCalendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    required
                    max={getMaxDate()}
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {formData.dateOfBirth && (
                    <span className={`flex items-center gap-1 text-xs ${isAgeValid ? 'text-neon-green' : 'text-red-400'}`}>
                      {isAgeValid ? <FiCheck /> : <FiX />}
                      {isAgeValid 
                        ? (t('ageVerified') || 'Age verified (18+)')
                        : (t('ageNotValid') || 'You must be at least 18 years old')
                      }
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('dateOfBirthHint') || 'You must be at least 18 years old to use this service'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('password')}
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder="••••••••"
                  />
                </div>
                {/* Password Requirements */}
                <div className="mt-3 space-y-1 text-xs sm:text-sm">
                  <div className={`flex items-center gap-2 ${passwordValidation.length ? 'text-neon-green' : 'text-gray-400'}`}>
                    {passwordValidation.length ? <FiCheck /> : <FiX />}
                    {t('passwordRequirements.length')}
                  </div>
                  <div className={`flex items-center gap-2 ${passwordValidation.uppercase ? 'text-neon-green' : 'text-gray-400'}`}>
                    {passwordValidation.uppercase ? <FiCheck /> : <FiX />}
                    {t('passwordRequirements.uppercase')}
                  </div>
                  <div className={`flex items-center gap-2 ${passwordValidation.lowercase ? 'text-neon-green' : 'text-gray-400'}`}>
                    {passwordValidation.lowercase ? <FiCheck /> : <FiX />}
                    {t('passwordRequirements.lowercase')}
                  </div>
                  <div className={`flex items-center gap-2 ${passwordValidation.number ? 'text-neon-green' : 'text-gray-400'}`}>
                    {passwordValidation.number ? <FiCheck /> : <FiX />}
                    {t('passwordRequirements.number')}
                  </div>
                  <div className={`flex items-center gap-2 ${passwordValidation.special ? 'text-neon-green' : 'text-gray-400'}`}>
                    {passwordValidation.special ? <FiCheck /> : <FiX />}
                    {t('passwordRequirements.special')}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('confirmPassword')}
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Language Preference */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  {t('language')}
                </label>
                <div className="relative">
                  <FiGlobe className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan" />
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    required
                    className="w-full bg-cyber-navy/50 border border-neon-blue/30 rounded-lg py-2.5 sm:py-3 pl-12 pr-4 text-white focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base appearance-none cursor-pointer"
                  >
                    <option value="en">🇬🇧 English</option>
                    <option value="el">🇬🇷 Ελληνικά</option>
                  </select>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-xs text-yellow-400 flex items-start gap-1">
                    <span className="mt-0.5">⚠️</span>
                    <span>{t('languageWarning') || 'This cannot be changed after signup. Your language determines which Telegram VIP channel you will join when you subscribe.'}</span>
                  </p>
                </div>
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
                {loading ? t('creating') : t('submit')}
                  <FiArrowRight />
                </span>
                <div className="absolute inset-0 bg-white/20 blur-xl"></div>
              </button>

              <div className="text-center text-xs sm:text-sm text-gray-400">
                {t('hasAccount')}{' '}
                <Link
                  href="/login"
                  className="text-neon-cyan hover:text-neon-blue transition-colors font-semibold"
                >
                  {t('login')}
                </Link>
              </div>
            </form>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

