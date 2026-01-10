'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import { FiTrendingUp, FiDollarSign, FiAlertCircle, FiLayers, FiTarget, FiZap } from 'react-icons/fi';

interface InfoSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay: number;
  accentColor: string;
}

function InfoSection({ icon, title, children, delay, accentColor }: InfoSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Panel>
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${accentColor}`}>
              {icon}
            </div>
            <div className="flex-1">
              <h2 className="font-orbitron text-xl sm:text-2xl font-bold text-white mb-4">
                {title}
              </h2>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                {children}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

export default function InfoPage() {
  const t = useTranslations('info');

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
          <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-neon-cyan mb-4 text-shadow-glow">
            {t('title')}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Info Sections */}
        <div className="space-y-6">
          {/* SBT Section */}
          <InfoSection
            icon={<FiZap className="text-2xl sm:text-3xl text-neon-cyan" />}
            title={t('sbt.title')}
            delay={0.1}
            accentColor="bg-neon-cyan/20"
          >
            <p>{t('sbt.content')}</p>
            <p>{t('sbt.content2')}</p>
          </InfoSection>

          {/* Double Section */}
          <InfoSection
            icon={<FiTarget className="text-2xl sm:text-3xl text-neon-green" />}
            title={t('double.title')}
            delay={0.2}
            accentColor="bg-neon-green/20"
          >
            <p>{t('double.content')}</p>
            <p className="text-neon-green/80 font-medium">{t('double.content2')}</p>
          </InfoSection>

          {/* Cash Out Section */}
          <InfoSection
            icon={<FiDollarSign className="text-2xl sm:text-3xl text-neon-orange" />}
            title={t('cashOut.title')}
            delay={0.3}
            accentColor="bg-neon-orange/20"
          >
            <p>{t('cashOut.content')}</p>
            <p>{t('cashOut.content2')}</p>
          </InfoSection>

          {/* Staking Section */}
          <InfoSection
            icon={<FiTrendingUp className="text-2xl sm:text-3xl text-purple-400" />}
            title={t('staking.title')}
            delay={0.4}
            accentColor="bg-purple-500/20"
          >
            <p>{t('staking.content')}</p>
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 flex items-start gap-2">
                <FiAlertCircle className="text-xl flex-shrink-0 mt-0.5" />
                <span>{t('staking.content2')}</span>
              </p>
            </div>
          </InfoSection>

          {/* Upgrade Section */}
          <InfoSection
            icon={<FiLayers className="text-2xl sm:text-3xl text-pink-400" />}
            title={t('upgrade.title')}
            delay={0.5}
            accentColor="bg-pink-500/20"
          >
            <p>{t('upgrade.content')}</p>
            <p>{t('upgrade.content2')}</p>
            <div className="mt-4 p-4 bg-gradient-to-r from-neon-cyan/10 to-neon-orange/10 border border-neon-cyan/30 rounded-lg">
              <p className="text-white">{t('upgrade.content3')}</p>
            </div>
          </InfoSection>
        </div>
      </div>
    </div>
  );
}

