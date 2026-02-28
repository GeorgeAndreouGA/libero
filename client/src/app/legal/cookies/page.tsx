'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import { motion } from 'framer-motion';
import { useLanguageStore } from '@/stores/languageStore';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@libero.com';

export default function CookiePolicyPage() {
  const { locale } = useLanguageStore();

  const content = {
    en: {
      title: 'Cookie Policy',
      lastUpdated: 'Last Updated: December 31, 2025',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      home: 'Back to Home',
      sections: [
        { title: '1. What Are Cookies', content: 'Cookies are small text files stored on your device when you visit websites. They can be session (deleted when browser closes) or persistent (remain for a set period).' },
        { title: '2. How We Use Cookies', content: 'We use cookies to: authenticate users, secure sessions (CSRF protection), remember language preferences. We do NOT use cookies for advertising or third-party tracking.' },
        { title: '3. Cookies We Use', content: 'access_token (authentication, session), refresh_token (auth refresh, 7 days), csrf_token (security, session), NEXT_LOCALE (language preference, 1 year).' },
        { title: '4. Essential Cookies', content: 'These cookies are strictly necessary for the website to function. They cannot be disabled as they are required for security and basic functionality.' },
        { title: '5. Managing Cookies', content: 'You can manage cookies through your browser settings. Note that disabling essential cookies will prevent you from using our service.' },
        { title: '6. Third-Party Cookies', content: 'Stripe (payment processing) may set cookies subject to their own privacy policy. We do not control third-party cookies.' },
        { title: '7. Updates', content: 'We may update this policy to reflect changes in cookies we use or legal requirements.' },
        { title: '8. Contact', content: `Questions about cookies? Email: ${CONTACT_EMAIL}` }
      ]
    },
    el: {
      title: 'Πολιτική Cookies',
      lastUpdated: 'Τελευταία Ενημέρωση: 31 Δεκεμβρίου 2025',
      privacy: 'Πολιτική Απορρήτου',
      terms: 'Όροι Χρήσης',
      home: 'Αρχική',
      sections: [
        { title: '1. Τι Είναι τα Cookies', content: 'Τα cookies είναι μικρά αρχεία κειμένου που αποθηκεύονται στη συσκευή σας. Μπορεί να είναι συνεδρίας (διαγράφονται με το κλείσιμο) ή επίμονα (παραμένουν για συγκεκριμένο χρόνο).' },
        { title: '2. Πώς Χρησιμοποιούμε Cookies', content: 'Χρησιμοποιούμε cookies για: ταυτοποίηση χρηστών, ασφάλεια (CSRF), προτιμήσεις γλώσσας. ΔΕΝ χρησιμοποιούμε cookies για διαφήμιση ή tracking τρίτων.' },
        { title: '3. Cookies που Χρησιμοποιούμε', content: 'access_token (ταυτοποίηση, συνεδρία), refresh_token (ανανέωση, 7 ημέρες), csrf_token (ασφάλεια, συνεδρία), NEXT_LOCALE (γλώσσα, 1 έτος).' },
        { title: '4. Απαραίτητα Cookies', content: 'Αυτά τα cookies είναι απολύτως απαραίτητα για τη λειτουργία του ιστότοπου. Δεν μπορούν να απενεργοποιηθούν.' },
        { title: '5. Διαχείριση Cookies', content: 'Μπορείτε να διαχειριστείτε τα cookies μέσω του browser σας. Η απενεργοποίηση απαραίτητων cookies θα αποτρέψει τη χρήση της υπηρεσίας.' },
        { title: '6. Cookies Τρίτων', content: 'Η Stripe (πληρωμές) μπορεί να ορίσει cookies σύμφωνα με τη δική της πολιτική. Δεν ελέγχουμε cookies τρίτων.' },
        { title: '7. Ενημερώσεις', content: 'Μπορούμε να ενημερώσουμε αυτήν την πολιτική για αλλαγές στα cookies ή νομικές απαιτήσεις.' },
        { title: '8. Επικοινωνία', content: `Ερωτήσεις για cookies; Email: ${CONTACT_EMAIL}` }
      ]
    }
  };

  const c = content[locale] || content.en;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
          <Panel>
            <div className="p-6 sm:p-8">
              <h1 className="font-orbitron text-3xl sm:text-4xl font-bold text-neon-cyan mb-2">{c.title}</h1>
              <p className="text-gray-400 mb-8">{c.lastUpdated}</p>
              <div className="space-y-6">
                {c.sections.map((s, i) => (
                  <div key={i} className="border-b border-neon-blue/20 pb-4 last:border-0">
                    <h2 className="font-orbitron text-lg font-semibold text-neon-blue mb-2">{s.title}</h2>
                    <p className="text-gray-300 leading-relaxed">{s.content}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-neon-blue/20 flex flex-wrap gap-4 text-sm">
                <Link href="/legal/privacy" className="text-neon-cyan hover:text-neon-blue transition-colors">{c.privacy}</Link>
                <Link href="/legal/terms" className="text-neon-cyan hover:text-neon-blue transition-colors">{c.terms}</Link>
                <Link href="/" className="text-gray-400 hover:text-gray-300 transition-colors">{c.home}</Link>
              </div>
            </div>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}
