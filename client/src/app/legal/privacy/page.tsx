'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import { motion } from 'framer-motion';
import { useLanguageStore } from '@/stores/languageStore';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@libero.com';

export default function PrivacyPolicyPage() {
  const { locale } = useLanguageStore();

  const content = {
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last Updated: December 31, 2025',
      terms: 'Terms of Service',
      cookies: 'Cookie Policy',
      home: 'Back to Home',
      sections: [
        { title: '1. Introduction', content: `We are committed to protecting your personal data in accordance with GDPR (EU) 2016/679. Contact us at: ${CONTACT_EMAIL}` },
        { title: '2. Data We Collect', content: 'Account info (name, email, username, password, date of birth), transaction info, usage data, and technical data (IP, browser).' },
        { title: '3. Legal Basis', content: 'Contract performance, legitimate interests, legal obligations, and consent where applicable.' },
        { title: '4. Your GDPR Rights', content: 'Access, rectification, erasure (right to be forgotten), restriction, data portability, objection, and withdrawal of consent. Contact us or use account settings.' },
        { title: '5. Data Retention', content: 'Active accounts: duration + 2 years. Financial records: 7 years. Security logs: 12 months. Unverified accounts: deleted after 10 minutes.' },
        { title: '6. Data Security', content: 'AES-256 encryption, TLS 1.3, bcrypt password hashing, regular audits. Breach notification within 72 hours.' },
        { title: '7. International Transfers', content: 'Data processed within EEA. Transfers outside use SCCs or adequacy decisions.' },
        { title: '8. Right to be Forgotten', content: `Request via account settings or email ${CONTACT_EMAIL}. Processed within 30 days. Data anonymized where deletion not possible.` },
        { title: '9. Third Parties', content: 'Stripe for payments, email services. All GDPR-compliant with Data Processing Agreements.' },
        { title: '10. Cookies', content: 'Essential cookies only: authentication, security, language preferences. See Cookie Policy.' },
        { title: '11. Age Requirement', content: 'Services for 18+ only. We do not collect data from minors.' },
        { title: '12. Contact', content: `Email: ${CONTACT_EMAIL}. Complaints can be filed with your local Data Protection Authority.` }
      ]
    },
    el: {
      title: 'Πολιτική Απορρήτου',
      lastUpdated: 'Τελευταία Ενημέρωση: 31 Δεκεμβρίου 2025',
      terms: 'Όροι Χρήσης',
      cookies: 'Πολιτική Cookies',
      home: 'Αρχική',
      sections: [
        { title: '1. Εισαγωγή', content: `Δεσμευόμαστε να προστατεύουμε τα δεδομένα σας σύμφωνα με τον GDPR (ΕΕ) 2016/679. Επικοινωνία: ${CONTACT_EMAIL}` },
        { title: '2. Δεδομένα που Συλλέγουμε', content: 'Στοιχεία λογαριασμού (όνομα, email, username, κωδικός, ημ. γέννησης), συναλλαγές, χρήση, τεχνικά δεδομένα (IP, browser).' },
        { title: '3. Νομική Βάση', content: 'Εκτέλεση σύμβασης, έννομα συμφέροντα, νομικές υποχρεώσεις, συγκατάθεση.' },
        { title: '4. Δικαιώματα GDPR', content: 'Πρόσβαση, διόρθωση, διαγραφή (δικαίωμα στη λήθη), περιορισμός, φορητότητα, εναντίωση, ανάκληση συγκατάθεσης. Επικοινωνήστε ή χρησιμοποιήστε τις ρυθμίσεις.' },
        { title: '5. Διατήρηση Δεδομένων', content: 'Ενεργοί λογαριασμοί: διάρκεια + 2 χρόνια. Οικονομικά: 7 χρόνια. Logs: 12 μήνες. Μη επαληθευμένοι: διαγραφή σε 10 λεπτά.' },
        { title: '6. Ασφάλεια', content: 'AES-256 κρυπτογράφηση, TLS 1.3, bcrypt. Ειδοποίηση παραβίασης εντός 72 ωρών.' },
        { title: '7. Διεθνείς Μεταφορές', content: 'Επεξεργασία εντός ΕΟΧ. Μεταφορές εκτός με SCCs ή αποφάσεις επάρκειας.' },
        { title: '8. Δικαίωμα στη Λήθη', content: `Αίτημα μέσω ρυθμίσεων ή email ${CONTACT_EMAIL}. Επεξεργασία σε 30 ημέρες. Ανωνυμοποίηση όπου απαιτείται.` },
        { title: '9. Τρίτοι', content: 'Stripe για πληρωμές, υπηρεσίες email. Όλοι συμμορφώνονται με GDPR.' },
        { title: '10. Cookies', content: 'Μόνο απαραίτητα: ταυτοποίηση, ασφάλεια, γλώσσα. Δείτε Πολιτική Cookies.' },
        { title: '11. Ηλικία', content: 'Υπηρεσίες μόνο για 18+. Δεν συλλέγουμε δεδομένα ανηλίκων.' },
        { title: '12. Επικοινωνία', content: `Email: ${CONTACT_EMAIL}. Καταγγελίες στην Αρχή Προστασίας Δεδομένων.` }
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
                <Link href="/legal/terms" className="text-neon-cyan hover:text-neon-blue transition-colors">{c.terms}</Link>
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
