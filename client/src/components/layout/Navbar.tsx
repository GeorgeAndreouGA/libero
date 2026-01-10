'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FiMenu, FiX, FiUser, FiLogOut } from 'react-icons/fi';
import Button from '../ui/Button';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useShouldReduceMotion } from '@/hooks/useMediaQuery';

const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || '/branding/logo.png';

export default function Navbar() {
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const userRole = user?.role || 'user';
  const router = useRouter();
  const shouldReduceMotion = useShouldReduceMotion();

  // Links for regular users - Bets is always shown (right of Packs)
  // Home is only shown for unauthenticated users
  // Statistics and Info are shown to everyone (no auth required)
  const userLinks = [
    ...(!isAuthenticated ? [{ href: '/', label: t('home') }] : []),
    { href: '/packs', label: t('packs') },
    { href: '/bets', label: t('bets'), requiresAuth: true },
    { href: '/statistics', label: t('statistics') },
    { href: '/info', label: t('info') },
  ];

  const adminLinks = [
    { href: '/admin', label: t('dashboard') },
    { href: '/admin/users', label: t('users') },
    { href: '/admin/packs', label: t('packsCategories') },
    { href: '/admin/bets', label: t('bets') },
    { href: '/statistics', label: t('statistics') },
    { href: '/info', label: t('info') },
  ];

  const links = userRole === 'admin' ? adminLinks : userLinks;

  const handleNavClick = (e: React.MouseEvent, link: any) => {
    if (link.requiresAuth && !isAuthenticated) {
      e.preventDefault();
      router.push('/login');
    }
  };

  // Simplified navbar for mobile - no initial animation
  const navContent = (
    <div className="container mx-auto px-4 py-4">
      <div className="flex items-center justify-between">
        {/* Logo - Navigate based on user role */}
        <Link href={isAuthenticated ? (userRole === 'admin' ? '/admin' : '/bets') : '/'} className="flex items-center gap-2 sm:gap-3 group">
          <div className="w-16 h-16 sm:w-20 sm:h-20 relative sm:group-hover:scale-110 transition-transform">
            <Image
              src={LOGO_URL}
              alt="Libero Tips"
              fill
              className="object-contain"
              unoptimized
              priority
            />
          </div>
          <span className="font-orbitron font-bold text-lg sm:text-xl text-neon-cyan text-shadow-glow-light sm:text-shadow-glow">
            LIBERO TIPS
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link)}
              className="hud-text hover:text-neon-blue transition-colors text-xs xl:text-sm"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-3 xl:gap-4">
          {!isAuthenticated && <LanguageSwitcher />}
          {isAuthenticated ? (
            <>
              <Link href="/profile">
                <Button variant="ghost" size="sm" icon={<FiUser />}>
                  {t('profile')}
                </Button>
              </Link>
              <Button variant="ghost" size="sm" icon={<FiLogOut />} onClick={logout}>
                {t('logout')}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t('login')}
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">
                  {t('joinNow')}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: Language (unauthenticated only) + Menu Button */}
        <div className="flex lg:hidden items-center gap-2">
          {!isAuthenticated && <LanguageSwitcher />}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-neon-cyan text-2xl p-2"
          >
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu - simple show/hide on mobile, animated on desktop */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-4 pt-4 border-t border-white/10">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hud-text active:text-neon-blue transition-colors py-2"
                onClick={(e) => {
                  handleNavClick(e, link);
                  setMobileMenuOpen(false);
                }}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/10 space-y-3">
              {isAuthenticated ? (
                <>
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" fullWidth icon={<FiUser />}>
                      {t('profile')}
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" fullWidth icon={<FiLogOut />} onClick={() => { logout(); setMobileMenuOpen(false); }}>
                    {t('logout')}
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" fullWidth>
                      {t('login')}
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" size="sm" fullWidth>
                      {t('joinNow')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // On mobile, skip framer-motion for better performance
  if (shouldReduceMotion) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel-mobile border-b border-neon-blue/20">
        {navContent}
      </nav>
    );
  }

  // Desktop: use framer-motion animation
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-neon-blue/20"
    >
      {navContent}
    </motion.nav>
  );
}
