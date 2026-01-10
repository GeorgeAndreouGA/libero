'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import { motion } from 'framer-motion';
import { useLanguageStore } from '@/stores/languageStore';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@libero.com';

export default function TermsOfServicePage() {
  const { locale } = useLanguageStore();

  const content = {
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last Updated: December 31, 2025',
      privacy: 'Privacy Policy',
      cookies: 'Cookie Policy',
      home: 'Back to Home',
      sections: [
        { title: '1. Acceptance', content: 'By using our service, you agree to these terms. This service provides betting tips for informational purposes only. Gambling involves financial risk.' },
        { title: '2. Eligibility', content: 'You must be 18+ , have legal capacity to contract, and not be prohibited from gambling.' },
        { title: '3. Account', content: 'One account per person. You must provide accurate information, maintain security of credentials, and verify email within 10 minutes.' },
        { title: '4. Subscriptions', content: 'Paid subscriptions grant access to premium content. Prices shown at purchase. Subscriptions auto-renew unless cancelled before renewal.' },
        { title: '5. Payments', content: 'Processed securely via Stripe. Refunds per our refund policy. Failed payments may suspend access.' },
        { title: '6. Content Usage', content: 'Personal use only. No redistribution, reselling, or publishing of betting tips. We retain all intellectual property rights.' },
        { title: '7. Disclaimer', content: 'Tips are informational only, not financial advice. Past performance does not guarantee future results. We are not responsible for gambling losses.' },
        { title: '8. Liability', content: 'We are not liable for: gambling losses, third-party actions, service interruptions, or indirect damages. Maximum liability limited to fees paid.' },
        { title: '9. Termination', content: 'We may terminate accounts for violations. You may close your account anytime via settings or by contacting us.' },
        { title: '10. Governing Law', content: 'These terms are governed by EU law. Disputes resolved in EU courts or via alternative dispute resolution.' },
        { title: '11. Changes', content: 'We may update these terms. Continued use after changes constitutes acceptance.' },
        { title: '12. Contact', content: `Email: ${CONTACT_EMAIL}` }
      ]
    },
    el: {
      title: 'Όροι Χρήσης',
      lastUpdated: 'Τελευταία Ενημέρωση: 31 Δεκεμβρίου 2025',
      privacy: 'Πολιτική Απορρήτου',
      cookies: 'Πολιτική Cookies',
      home: 'Αρχική',
      sections: [
        { title: '1. Αποδοχή', content: 'Χρησιμοποιώντας την υπηρεσία, αποδέχεστε αυτούς τους όρους. Τα tips είναι μόνο για ενημέρωση. Ο τζόγος ενέχει κίνδυνο.' },
        { title: '2. Επιλεξιμότητα', content: 'Πρέπει να είστε 18+ (ή νόμιμη ηλικία τζόγου), να έχετε νομική ικανότητα και να μην απαγορεύεται ο τζόγος.' },
        { title: '3. Λογαριασμός', content: 'Ένας λογαριασμός ανά άτομο. Ακριβείς πληροφορίες, ασφάλεια διαπιστευτηρίων, επαλήθευση email σε 10 λεπτά.' },
        { title: '4. Συνδρομές', content: 'Οι συνδρομές δίνουν πρόσβαση σε premium περιεχόμενο. Τιμές κατά την αγορά. Αυτόματη ανανέωση εκτός αν ακυρωθεί.' },
        { title: '5. Πληρωμές', content: 'Ασφαλής επεξεργασία μέσω Stripe. Επιστροφές σύμφωνα με την πολιτική μας. Αποτυχία πληρωμής μπορεί να αναστείλει πρόσβαση.' },
        { title: '6. Χρήση Περιεχομένου', content: 'Μόνο προσωπική χρήση. Απαγορεύεται η αναδιανομή, μεταπώληση ή δημοσίευση των tips. Διατηρούμε τα πνευματικά δικαιώματα.' },
        { title: '7. Αποποίηση', content: 'Τα tips είναι πληροφοριακά, όχι οικονομικές συμβουλές. Παρελθούσες επιδόσεις δεν εγγυώνται μελλοντικά αποτελέσματα. Δεν ευθυνόμαστε για απώλειες.' },
        { title: '8. Ευθύνη', content: 'Δεν ευθυνόμαστε για: απώλειες τζόγου, ενέργειες τρίτων, διακοπές υπηρεσίας. Μέγιστη ευθύνη: τα καταβληθέντα τέλη.' },
        { title: '9. Τερματισμός', content: 'Μπορούμε να τερματίσουμε λογαριασμούς για παραβιάσεις. Μπορείτε να κλείσετε τον λογαριασμό σας οποτεδήποτε.' },
        { title: '10. Εφαρμοστέο Δίκαιο', content: 'Διέπονται από το δίκαιο της ΕΕ. Διαφορές σε δικαστήρια ΕΕ ή εναλλακτική επίλυση.' },
        { title: '11. Αλλαγές', content: 'Μπορούμε να ενημερώσουμε τους όρους. Η συνέχιση χρήσης συνιστά αποδοχή.' },
        { title: '12. Επικοινωνία', content: `Email: ${CONTACT_EMAIL}` }
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
                <Link href="/legal/cookies" className="text-neon-cyan hover:text-neon-blue transition-colors">{c.cookies}</Link>
                <Link href="/" className="text-gray-400 hover:text-gray-300 transition-colors">{c.home}</Link>
              </div>
            </div>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}
