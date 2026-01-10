'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { FiInstagram, FiMail } from 'react-icons/fi';
import { FaTelegram, FaTiktok } from 'react-icons/fa';

const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || '/branding/logo.png';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Libero Tips';
const INSTAGRAM_LINK_EN = process.env.NEXT_PUBLIC_INSTAGRAM_LINK || '';
const INSTAGRAM_LINK_EL = process.env.NEXT_PUBLIC_INSTAGRAM_LINK_EL || '';
const TIKTOK_LINK = process.env.NEXT_PUBLIC_TIKTOK_LINK || '';
const TELEGRAM_LINK_PUBLIC_EN = process.env.NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC || '';
const TELEGRAM_LINK_PUBLIC_EL = process.env.NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC_EL || '';
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';

export default function Footer() {
  const t = useTranslations('footer');
  const [currentYear, setCurrentYear] = useState(2025);
  const [telegramLink, setTelegramLink] = useState(TELEGRAM_LINK_PUBLIC_EN);
  const [instagramLink, setInstagramLink] = useState(INSTAGRAM_LINK_EN);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());

    // Check for user's language preference from cookie
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (match && match[1] === 'el') {
      if (TELEGRAM_LINK_PUBLIC_EL) {
        setTelegramLink(TELEGRAM_LINK_PUBLIC_EL);
      }
      if (INSTAGRAM_LINK_EL) {
        setInstagramLink(INSTAGRAM_LINK_EL);
      }
    }
  }, []);

  return (
    <footer className="w-full border-t border-neon-blue/20 bg-cyber-dark/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-6">
          {/* Logo and Site Name */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 relative">
              <Image
                src={LOGO_URL}
                alt={SITE_NAME}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="font-orbitron font-bold text-xl sm:text-2xl text-neon-cyan text-shadow-glow">
              {SITE_NAME}
            </span>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {instagramLink && (
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-lg hover:shadow-pink-500/30"
                aria-label="Instagram"
              >
                <FiInstagram size={20} />
              </a>
            )}

            {TIKTOK_LINK && (
              <a
                href={TIKTOK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-lg hover:shadow-gray-500/30 border border-gray-600"
                aria-label="TikTok"
              >
                <FaTiktok size={20} />
              </a>
            )}

            {telegramLink && (
              <a
                href={telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-lg hover:shadow-blue-500/30"
                aria-label="Telegram"
              >
                <FaTelegram size={20} />
              </a>
            )}

            {CONTACT_EMAIL && (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-neon-blue to-neon-cyan flex items-center justify-center text-cyber-dark hover:scale-110 transition-transform shadow-lg hover:shadow-neon-cyan/30"
                aria-label="Contact Email"
              >
                <FiMail size={20} />
              </a>
            )}
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
            <Link
              href="/legal/terms"
              className="text-gray-400 hover:text-neon-cyan transition-colors"
            >
              {t('termsOfService')}
            </Link>
            <span className="text-gray-600">•</span>
            <Link
              href="/legal/privacy"
              className="text-gray-400 hover:text-neon-cyan transition-colors"
            >
              {t('privacyPolicy')}
            </Link>
            <span className="text-gray-600">•</span>
            <Link
              href="/legal/cookies"
              className="text-gray-400 hover:text-neon-cyan transition-colors"
            >
              {t('cookiePolicy')}
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-gray-500 text-xs sm:text-sm text-center">
            © {currentYear} {SITE_NAME}. {t('allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  );
}
