import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

// Email translations for both English and Greek
const emailTranslations = {
  en: {
    verification: {
      subject: 'Verify your {appName} account',
      greeting: 'Hi',
      thanks: 'Thanks for signing up for {appName}. We\'re excited to have you on board!',
      clickBelow: 'To complete your registration and activate your account, please verify your email address by clicking the button below:',
      verifyButton: 'Verify Email Address',
      copyPaste: 'Or copy and paste this link into your browser:',
      expiresWarning: 'This verification link will expire in <strong>10 minutes</strong>.',
      important: 'Important:',
      ignore: 'If you didn\'t create an account with {appName}, you can safely ignore this email.',
      footer: 'All rights reserved.',
    },
    welcome: {
      subject: 'Welcome to {appName}!',
      title: 'Welcome to {appName}! 🎉',
      greeting: 'Hi',
      verified: 'Your email has been successfully verified and your account is now <strong>active</strong>.',
      accessTo: 'You now have access to:',
      feature1: 'Free Pack',
      feature2: 'Bets Category',
      feature3: 'Subscription Purchases',
      feature4: 'Mobile Friendly',
      goToDashboard: 'Go to Bets',
      proTip: 'Pro Tip:',
      proTipText: 'Check out our subscription plans to unlock exclusive premium tips and advanced analytics!',
      questions: 'If you have any questions or need assistance, feel free to reach out to our support team.',
      bestRegards: 'Best regards,',
    },
    passwordReset: {
      subject: 'Reset your {appName} password',
      title: 'Reset Your Password',
      greeting: 'Hi',
      received: 'We received a request to reset your password for your {appName} account.',
      clickBelow: 'Click the button below to choose a new password:',
      resetButton: 'Reset Password',
      copyPaste: 'Or copy and paste this link into your browser:',
      expiresWarning: 'This password reset link will expire in <strong>10 minutes</strong>.',
      important: 'Important:',
      securityNotice: 'Security Notice:',
      securityText: 'If you didn\'t request this password reset, please ignore this email. Your password will remain unchanged.',
    },
    twoFactor: {
      subject: '{appName} - Your Verification Code',
      title: '🔐 Verification Code',
      greeting: 'Hi',
      yourCode: 'Your verification code for {appName} is:',
      expiresWarning: '<strong>This code will expire in 10 minutes.</strong>',
      securityNotice: 'Security Notice:',
      securityText: 'If you didn\'t request this code, please ignore this email and consider changing your password immediately.',
      enterCode: 'Enter this code in the verification screen to complete your login.',
    },
    subscription: {
      subject: 'Subscription Confirmed - {packName}',
      title: 'Subscription Confirmed! ✅',
      greeting: 'Hi',
      thanks: 'Thank you for subscribing to <strong>{packName}</strong>! Your subscription is now active.',
      details: 'Subscription Details',
      pack: 'Pack:',
      price: 'Monthly Price:',
      startDate: 'Start Date:',
      endDate: 'End Date:',
      nextBilling: 'Next Billing:',
      autoRenew: 'Your subscription will automatically renew on <strong>{date}</strong> for €{price}/month.',
      reminder: 'You\'ll receive a reminder 3 days before renewal.',
      noRefund: '<strong>Important:</strong> All subscriptions are non-refundable and cannot be cancelled. You can upgrade to higher tiers anytime.',
    },
    upgrade: {
      subject: 'Upgrade Confirmed - {packName}',
      title: 'Upgrade Confirmed! 🚀',
      greeting: 'Hi',
      congrats: 'Congratulations! You\'ve successfully upgraded from <strong>{oldPack}</strong> to <strong>{newPack}</strong>!',
      details: 'Upgrade Details',
      from: 'From:',
      to: 'To:',
      amountPaid: 'Amount Paid Today:',
      difference: '(Difference between packs)',
      newMonthlyPrice: 'New Monthly Price:',
      newPeriod: 'New Period:',
      nextBilling: 'Next Billing:',
      periodReset: 'Your subscription period has been reset. Starting from {date}, you\'ll be charged €{price}/month.',
      reminder: 'You\'ll receive a reminder 3 days before renewal.',
      noCancellation: '<strong>No Cancellations:</strong> All subscriptions are non-refundable and cannot be cancelled or downgraded.',
      enjoy: 'Enjoy your upgraded pack!',
    },
    renewal: {
      subject: 'Subscription Expiring Soon - {packName}',
      title: 'Subscription Expiring Soon 🔔',
      greeting: 'Hi',
      reminder: 'This is a friendly reminder that your <strong>{packName}</strong> subscription will expire in <strong>3 days</strong>.',
      renewsOn: 'Your subscription will expire on:',
      amount: 'Amount to renew:',
      autoRenew: '<strong>Important:</strong> Subscriptions do NOT auto-renew. To continue your access, please renew your subscription before it expires.',
      noRefund: 'After expiration, you will lose access to premium content and be removed from the VIP Telegram group.',
      upgrade: 'Renew now or upgrade to a higher tier to keep your premium access!',
    },
    ended: {
      subject: 'Subscription Ended - {packName}',
      title: 'Subscription Ended',
      greeting: 'Hi',
      ended: 'Your <strong>{packName}</strong> subscription has ended as of:',
      expired: 'Your premium access to <strong>{packName}</strong> categories has now expired.',
      thanks: 'Thank you for being part of our community! We hope you enjoyed the premium bets and exclusive content.',
      continueTitle: 'Want to Continue?',
      continueText: 'Renew your subscription or upgrade to a higher tier to regain access to premium content!',
      viewPacks: 'View Packs',
    },
    payment: {
      subject: 'Payment Confirmed - {packName}',
      subjectUpgrade: 'Payment Confirmed - Upgrade to {packName}',
      title: 'Payment Confirmed! ✅',
      greeting: 'Hi',
      confirmed: 'Thank you for purchasing <strong>{packName}</strong>! Your payment has been confirmed.',
      upgradeConfirmed: 'Your upgrade from <strong>{oldPack}</strong> to <strong>{newPack}</strong> has been confirmed!',
      details: '💳 Payment Details',
      pack: 'Pack:',
      amountPaid: 'Amount Paid:',
      startDate: 'Start Date:',
      endDate: 'End Date:',
      accessNow: '🎉 <strong>You now have access to all {packName} features and content!</strong>',
      joinTelegram: '📱 Join Our Telegram Community!',
      telegramText: 'Get real-time updates, tips, and connect with other members.',
      joinTelegramButton: 'Join Telegram',
      goToDashboard: 'Go to Bets',
      thanks: 'Thank you for your purchase!',
    },
    refund: {
      subject: 'Refund Processed - {packName}',
      title: '💳 Refund Processed',
      greeting: 'Hi',
      processed: 'Your refund has been processed successfully.',
      details: 'Refund Details',
      pack: 'Pack:',
      amount: 'Refund Amount:',
      date: 'Refund Date:',
      timeline: 'The refund will appear on your original payment method within <strong>5-10 business days</strong>, depending on your bank.',
      cancelled: 'Your subscription to <strong>{packName}</strong> has been cancelled.',
      questions: 'If you have any questions about this refund, please contact our support team.',
    },
  },
  el: {
    verification: {
      subject: 'Επιβεβαίωσε τον λογαριασμό σου στο {appName}',
      greeting: 'Γεια σου',
      thanks: 'Ευχαριστούμε που εγγράφηκες στο {appName}. Είμαστε ενθουσιασμένοι που είσαι μαζί μας!',
      clickBelow: 'Για να ολοκληρώσεις την εγγραφή σου και να ενεργοποιήσεις τον λογαριασμό σου, επιβεβαίωσε τη διεύθυνση email σου κάνοντας κλικ στο παρακάτω κουμπί:',
      verifyButton: 'Επιβεβαίωση Email',
      copyPaste: 'Ή αντέγραψε και επικόλλησε αυτόν τον σύνδεσμο στον browser σου:',
      expiresWarning: 'Αυτός ο σύνδεσμος επιβεβαίωσης θα λήξει σε <strong>10 λεπτά</strong>.',
      important: 'Σημαντικό:',
      ignore: 'Αν δεν δημιούργησες λογαριασμό στο {appName}, μπορείς να αγνοήσεις αυτό το email.',
      footer: 'Με επιφύλαξη κάθε δικαιώματος.',
    },
    welcome: {
      subject: 'Καλώς ήρθες στο {appName}!',
      title: 'Καλώς ήρθες στο {appName}! 🎉',
      greeting: 'Γεια σου',
      verified: 'Το email σου επιβεβαιώθηκε επιτυχώς και ο λογαριασμός σου είναι πλέον <strong>ενεργός</strong>.',
      accessTo: 'Τώρα έχεις πρόσβαση σε:',
      feature1: 'Δωρεάν Πακέτο',
      feature2: 'Κατηγορία Στοιχημάτων',
      feature3: 'Αγορές Συνδρομών',
      feature4: 'Φιλικό για Κινητά',
      goToDashboard: 'Μετάβαση στα Προγνωστικά',
      proTip: 'Συμβουλή:',
      proTipText: 'Δες τα πακέτα συνδρομής μας για να ξεκλειδώσεις αποκλειστικά premium tips και προηγμένα analytics!',
      questions: 'Αν έχεις ερωτήσεις ή χρειάζεσαι βοήθεια, επικοινώνησε με την ομάδα υποστήριξής μας.',
      bestRegards: 'Με εκτίμηση,',
    },
    passwordReset: {
      subject: 'Επαναφορά κωδικού {appName}',
      title: 'Επαναφορά Κωδικού',
      greeting: 'Γεια σου',
      received: 'Λάβαμε αίτημα επαναφοράς κωδικού για τον λογαριασμό σου στο {appName}.',
      clickBelow: 'Κάνε κλικ στο παρακάτω κουμπί για να επιλέξεις νέο κωδικό:',
      resetButton: 'Επαναφορά Κωδικού',
      copyPaste: 'Ή αντέγραψε και επικόλλησε αυτόν τον σύνδεσμο στον browser σου:',
      expiresWarning: 'Αυτός ο σύνδεσμος επαναφοράς θα λήξει σε <strong>10 λεπτά</strong>.',
      important: 'Σημαντικό:',
      securityNotice: 'Ειδοποίηση Ασφαλείας:',
      securityText: 'Αν δεν ζήτησες επαναφορά κωδικού, αγνόησε αυτό το email. Ο κωδικός σου θα παραμείνει αμετάβλητος.',
    },
    twoFactor: {
      subject: '{appName} - Ο Κωδικός Επιβεβαίωσής σου',
      title: '🔐 Κωδικός Επιβεβαίωσης',
      greeting: 'Γεια σου',
      yourCode: 'Ο κωδικός επιβεβαίωσής σου για το {appName} είναι:',
      expiresWarning: '<strong>Αυτός ο κωδικός θα λήξει σε 10 λεπτά.</strong>',
      securityNotice: 'Ειδοποίηση Ασφαλείας:',
      securityText: 'Αν δεν ζήτησες αυτόν τον κωδικό, αγνόησε αυτό το email και σκέψου να αλλάξεις τον κωδικό σου άμεσα.',
      enterCode: 'Εισάγαγε αυτόν τον κωδικό στην οθόνη επιβεβαίωσης για να ολοκληρώσεις τη σύνδεσή σου.',
    },
    subscription: {
      subject: 'Επιβεβαίωση Συνδρομής - {packName}',
      title: 'Η Συνδρομή Επιβεβαιώθηκε! ✅',
      greeting: 'Γεια σου',
      thanks: 'Ευχαριστούμε που εγγράφηκες στο <strong>{packName}</strong>! Η συνδρομή σου είναι πλέον ενεργή.',
      details: 'Λεπτομέρειες Συνδρομής',
      pack: 'Πακέτο:',
      price: 'Μηνιαία Τιμή:',
      startDate: 'Ημ/νία Έναρξης:',
      endDate: 'Ημ/νία Λήξης:',
      nextBilling: 'Επόμενη Χρέωση:',
      autoRenew: 'Η συνδρομή σου θα ανανεωθεί αυτόματα στις <strong>{date}</strong> για €{price}/μήνα.',
      reminder: 'Θα λάβεις υπενθύμιση 3 ημέρες πριν την ανανέωση.',
      noRefund: '<strong>Σημαντικό:</strong> Όλες οι συνδρομές δεν επιστρέφονται και δεν μπορούν να ακυρωθούν. Μπορείς να αναβαθμίσεις σε ανώτερα επίπεδα ανά πάσα στιγμή.',
    },
    upgrade: {
      subject: 'Επιβεβαίωση Αναβάθμισης - {packName}',
      title: 'Η Αναβάθμιση Επιβεβαιώθηκε! 🚀',
      greeting: 'Γεια σου',
      congrats: 'Συγχαρητήρια! Αναβάθμισες επιτυχώς από <strong>{oldPack}</strong> σε <strong>{newPack}</strong>!',
      details: 'Λεπτομέρειες Αναβάθμισης',
      from: 'Από:',
      to: 'Σε:',
      amountPaid: 'Ποσό που Πληρώθηκε Σήμερα:',
      difference: '(Διαφορά μεταξύ πακέτων)',
      newMonthlyPrice: 'Νέα Μηνιαία Τιμή:',
      newPeriod: 'Νέα Περίοδος:',
      nextBilling: 'Επόμενη Χρέωση:',
      periodReset: 'Η περίοδος συνδρομής σου έχει επαναφερθεί. Από τις {date}, θα χρεώνεσαι €{price}/μήνα.',
      reminder: 'Θα λάβεις υπενθύμιση 3 ημέρες πριν την ανανέωση.',
      noCancellation: '<strong>Χωρίς Ακυρώσεις:</strong> Όλες οι συνδρομές δεν επιστρέφονται και δεν μπορούν να ακυρωθούν ή να υποβαθμιστούν.',
      enjoy: 'Απόλαυσε το αναβαθμισμένο πακέτο σου!',
    },
    renewal: {
      subject: 'Η Συνδρομή σου Λήγει Σύντομα - {packName}',
      title: 'Η Συνδρομή σου Λήγει Σύντομα 🔔',
      greeting: 'Γεια σου',
      reminder: 'Αυτή είναι μια φιλική υπενθύμιση ότι η συνδρομή σου <strong>{packName}</strong> θα λήξει σε <strong>3 ημέρες</strong>.',
      renewsOn: 'Η συνδρομή σου θα λήξει στις:',
      amount: 'Ποσό για ανανέωση:',
      autoRenew: '<strong>Σημαντικό:</strong> Οι συνδρομές ΔΕΝ ανανεώνονται αυτόματα. Για να συνεχίσεις την πρόσβασή σου, παρακαλούμε ανανέωσε τη συνδρομή σου πριν λήξει.',
      noRefund: 'Μετά τη λήξη, θα χάσεις την πρόσβαση στο premium περιεχόμενο και θα αφαιρεθείς από την ομάδα VIP Telegram.',
      upgrade: 'Ανανέωσε τώρα ή αναβάθμισε σε ανώτερο επίπεδο για να διατηρήσεις την premium πρόσβασή σου!',
    },
    ended: {
      subject: 'Η Συνδρομή Έληξε - {packName}',
      title: 'Η Συνδρομή Έληξε',
      greeting: 'Γεια σου',
      ended: 'Η συνδρομή σου <strong>{packName}</strong> έληξε στις:',
      expired: 'Η premium πρόσβασή σου στις κατηγορίες <strong>{packName}</strong> έχει πλέον λήξει.',
      thanks: 'Ευχαριστούμε που ήσουν μέρος της κοινότητάς μας! Ελπίζουμε να απόλαυσες τα premium στοιχήματα και το αποκλειστικό περιεχόμενο.',
      continueTitle: 'Θέλεις να Συνεχίσεις;',
      continueText: 'Ανανέωσε τη συνδρομή σου ή αναβάθμισε σε ανώτερο επίπεδο για να αποκτήσεις ξανά πρόσβαση στο premium περιεχόμενο!',
      viewPacks: 'Δες τα Πακέτα',
    },
    payment: {
      subject: 'Επιβεβαίωση Πληρωμής - {packName}',
      subjectUpgrade: 'Επιβεβαίωση Πληρωμής - Αναβάθμιση σε {packName}',
      title: 'Η Πληρωμή Επιβεβαιώθηκε! ✅',
      greeting: 'Γεια σου',
      confirmed: 'Ευχαριστούμε για την αγορά του <strong>{packName}</strong>! Η πληρωμή σου επιβεβαιώθηκε.',
      upgradeConfirmed: 'Η αναβάθμισή σου από <strong>{oldPack}</strong> σε <strong>{newPack}</strong> επιβεβαιώθηκε!',
      details: '💳 Λεπτομέρειες Πληρωμής',
      pack: 'Πακέτο:',
      amountPaid: 'Ποσό που Πληρώθηκε:',
      startDate: 'Ημ/νία Έναρξης:',
      endDate: 'Ημ/νία Λήξης:',
      accessNow: '🎉 <strong>Τώρα έχεις πρόσβαση σε όλες τις δυνατότητες και το περιεχόμενο του {packName}!</strong>',
      joinTelegram: '📱 Γίνε Μέλος της Κοινότητάς μας στο Telegram!',
      telegramText: 'Λάβε ενημερώσεις σε πραγματικό χρόνο, tips και συνδέσου με άλλα μέλη.',
      joinTelegramButton: 'Σύνδεση στο Telegram',
      goToDashboard: 'Μετάβαση στα Προγνωστικά',
      thanks: 'Ευχαριστούμε για την αγορά σου!',
    },
    refund: {
      subject: 'Επεξεργασία Επιστροφής - {packName}',
      title: '💳 Η Επιστροφή Ολοκληρώθηκε',
      greeting: 'Γεια σου',
      processed: 'Η επιστροφή σου ολοκληρώθηκε επιτυχώς.',
      details: 'Λεπτομέρειες Επιστροφής',
      pack: 'Πακέτο:',
      amount: 'Ποσό Επιστροφής:',
      date: 'Ημ/νία Επιστροφής:',
      timeline: 'Η επιστροφή θα εμφανιστεί στον αρχικό τρόπο πληρωμής σου εντός <strong>5-10 εργάσιμων ημερών</strong>, ανάλογα με την τράπεζά σου.',
      cancelled: 'Η συνδρομή σου στο <strong>{packName}</strong> έχει ακυρωθεί.',
      questions: 'Αν έχεις ερωτήσεις σχετικά με αυτή την επιστροφή, επικοινώνησε με την ομάδα υποστήριξής μας.',
    },
  },
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
    this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Get the email header HTML
   */
  private getEmailHeader(appName: string, gradientFrom: string = '#667eea', gradientTo: string = '#764ba2'): string {
    return `
  <div style="background: linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${appName}</h1>
  </div>
    `.trim();
  }

  /**
   * Initialize email transporter with configuration
   */
  private initializeTransporter() {
    const emailConfig = {
      host: this.configService.get('MAIL_HOST'),
      port: parseInt(this.configService.get('MAIL_PORT') || '587'),
      secure: this.configService.get('MAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    };

    this.transporter = nodemailer.createTransport(emailConfig);

    // Verify connection configuration (non-blocking)
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.warn(
          `Email service verification failed: ${error.message}. Emails will be attempted anyway.`,
        );
      } else {
        this.logger.log('✓ Email service is ready to send messages');
      }
    });
  }

  /**
   * Generic method to send any email
   */
  async sendEmail(to: string, subject: string, html: string, text?: string) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    
    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send email verification link to user
   */
  async sendVerificationEmail(email: string, token: string, username?: string, language: string = 'en') {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const t = emailTranslations[language as keyof typeof emailTranslations] || emailTranslations.en;

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject: t.verification.subject.replace('{appName}', appName),
      html: this.getVerificationEmailTemplate(verificationUrl, appName, username, language),
      text: language === 'el' ? `
Καλώς ήρθες στο ${appName}!

Επιβεβαίωσε τη διεύθυνση email σου κάνοντας κλικ στον παρακάτω σύνδεσμο:
${verificationUrl}

Αυτός ο σύνδεσμος θα λήξει σε 10 λεπτά.

Αν δεν δημιούργησες λογαριασμό, αγνόησε αυτό το email.

Με εκτίμηση,
Η Ομάδα ${appName}
      `.trim() : `
Welcome to ${appName}!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 10 minutes.

If you didn't create an account, please ignore this email.

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send password reset link to user
   */
  async sendPasswordResetEmail(email: string, token: string, username?: string, language: string = 'en') {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const t = emailTranslations[language as keyof typeof emailTranslations] || emailTranslations.en;

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject: t.passwordReset.subject.replace('{appName}', appName),
      html: this.getPasswordResetEmailTemplate(resetUrl, appName, username, language),
      text: language === 'el' ? `
${username ? `Γεια σου ${username},\n\n` : ''}Ζήτησες επαναφορά κωδικού για τον λογαριασμό σου στο ${appName}.

Κάνε κλικ στον παρακάτω σύνδεσμο για να επαναφέρεις τον κωδικό σου:
${resetUrl}

Αυτός ο σύνδεσμος θα λήξει σε 10 λεπτά.

Αν δεν ζήτησες επαναφορά, αγνόησε αυτό το email και ο κωδικός σου θα παραμείνει αμετάβλητος.

Με εκτίμηση,
Η Ομάδα ${appName}
      `.trim() : `
${username ? `Hi ${username},\n\n` : ''}You requested to reset your password for ${appName}.

Click the link below to reset your password:
${resetUrl}

This link will expire in 10 minutes.

If you didn't request this, please ignore this email and your password will remain unchanged.

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, username?: string, language: string = 'en') {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const t = emailTranslations[language as keyof typeof emailTranslations] || emailTranslations.en;

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject: t.welcome.subject.replace('{appName}', appName),
      html: this.getWelcomeEmailTemplate(username, appName, frontendUrl, language),
      text: language === 'el' ? `
Καλώς ήρθες στο ${appName}${username ? `, ${username}` : ''}!

Το email σου επιβεβαιώθηκε και ο λογαριασμός σου είναι πλέον ενεργός.

Τώρα μπορείς να συνδεθείς και να εξερευνήσεις τα premium tips και το αποκλειστικό περιεχόμενο.

Επισκέψου μας: ${frontendUrl}

Με εκτίμηση,
Η Ομάδα ${appName}
      `.trim() : `
Welcome to ${appName}${username ? `, ${username}` : ''}!

Your email has been verified and your account is now active.

You can now log in and start exploring our premium tips and exclusive content.

Visit us at: ${frontendUrl}

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      // Don't throw error for welcome emails - it's not critical
      return { success: false, error: error.message };
    }
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(
    email: string,
    username: string,
    packName: string,
    price: number,
    startDate: Date,
    endDate: Date,
  ) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    
    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject: `Subscription Confirmed - ${packName}`,
      html: this.getSubscriptionConfirmationTemplate(username, packName, price, startDate, endDate, appName),
      text: `
Hi ${username},

Your subscription to ${packName} has been confirmed!

Subscription Details:
- Pack: ${packName}
- Price: €${price}/month
- Start Date: ${startDate.toLocaleDateString()}
- End Date: ${endDate.toLocaleDateString()}
- Next Billing: ${endDate.toLocaleDateString()}

Your subscription will automatically renew on ${endDate.toLocaleDateString()} for €${price}.

You'll receive a reminder 3 days before your renewal date.

Thank you for subscribing!

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Subscription confirmation sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send subscription confirmation to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send upgrade confirmation email
   * @param language - User's preferred language for the email
   */
  async sendUpgradeConfirmation(
    email: string,
    username: string,
    oldPackName: string,
    newPackName: string,
    pricePaid: number,
    newMonthlyPrice: number,
    startDate: Date,
    endDate: Date,
    language: 'en' | 'el' = 'en',
  ) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const t = emailTranslations[language as keyof typeof emailTranslations].upgrade;
    const locale = language === 'el' ? 'el-GR' : 'en-GB';
    const subject = t.subject.replace('{newPack}', newPackName);
    
    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject,
      html: this.getUpgradeConfirmationTemplate(
        username, oldPackName, newPackName, pricePaid, newMonthlyPrice, startDate, endDate, appName, language
      ),
      text: language === 'el' ? `
Γεια σου ${username},

Η αναβάθμισή σου από ${oldPackName} σε ${newPackName} επιβεβαιώθηκε!

Λεπτομέρειες Αναβάθμισης:
- Από: ${oldPackName}
- Σε: ${newPackName}
- Ποσό που πληρώθηκε σήμερα: €${pricePaid} (διαφορά)
- Νέα Μηνιαία Τιμή: €${newMonthlyPrice}
- Νέα Περίοδος Συνδρομής: ${startDate.toLocaleDateString(locale)} - ${endDate.toLocaleDateString(locale)}
- Επόμενη Χρέωση: ${endDate.toLocaleDateString(locale)} για €${newMonthlyPrice}

Σημαντικό: Η περίοδος συνδρομής σου έχει επαναφερθεί. Οι συνδρομές ΔΕΝ ανανεώνονται αυτόματα - θα λάβεις υπενθύμιση 3 ημέρες πριν τη λήξη.

Απόλαυσε το αναβαθμισμένο πακέτο σου!

Με εκτίμηση,
Η ομάδα ${appName}
      `.trim() : `
Hi ${username},

Your upgrade from ${oldPackName} to ${newPackName} has been confirmed!

Upgrade Details:
- From: ${oldPackName}
- To: ${newPackName}
- Amount Paid Today: €${pricePaid} (difference)
- New Monthly Price: €${newMonthlyPrice}
- New Subscription Period: ${startDate.toLocaleDateString(locale)} - ${endDate.toLocaleDateString(locale)}
- Next Billing: ${endDate.toLocaleDateString(locale)} for €${newMonthlyPrice}

Important: Your subscription period has been reset. Subscriptions do NOT auto-renew - you'll receive a reminder 3 days before expiry.

Enjoy your upgraded pack!

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Upgrade confirmation sent to ${email} (${language}): ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send upgrade confirmation to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send renewal reminder email (3 days before subscription expires)
   * @param language - User's preferred language for the email
   */
  async sendRenewalReminder(
    email: string,
    username: string,
    packName: string,
    price: number,
    renewalDate: Date,
    language: 'en' | 'el' = 'en',
  ) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const t = emailTranslations[language as keyof typeof emailTranslations].renewal;
    const subject = t.subject.replace('{packName}', packName);
    
    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject,
      html: this.getRenewalReminderTemplate(username, packName, price, renewalDate, appName, language),
      text: language === 'el' ? `
Γεια σου ${username},

Αυτή είναι μια φιλική υπενθύμιση ότι η συνδρομή σου ${packName} θα λήξει σε 3 ημέρες.

Λεπτομέρειες:
- Πακέτο: ${packName}
- Ποσό για ανανέωση: €${price}
- Ημερομηνία λήξης: ${renewalDate.toLocaleDateString('el-GR')}

Σημαντικό: Οι συνδρομές ΔΕΝ ανανεώνονται αυτόματα. Για να συνεχίσεις την πρόσβασή σου, παρακαλούμε ανανέωσε τη συνδρομή σου πριν λήξει.

Μετά τη λήξη, θα χάσεις την πρόσβαση στο premium περιεχόμενο και θα αφαιρεθείς από την ομάδα VIP Telegram.

Ανανέωσε τώρα ή αναβάθμισε σε ανώτερο επίπεδο για να διατηρήσεις την premium πρόσβασή σου!

Με εκτίμηση,
Η ομάδα ${appName}
      `.trim() : `
Hi ${username},

This is a friendly reminder that your ${packName} subscription will expire in 3 days.

Details:
- Pack: ${packName}
- Amount to renew: €${price}
- Expiry Date: ${renewalDate.toLocaleDateString()}

Important: Subscriptions do NOT auto-renew. To continue your access, please renew your subscription before it expires.

After expiration, you will lose access to premium content and be removed from the VIP Telegram group.

Renew now or upgrade to a higher tier to keep your premium access!

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Renewal reminder sent to ${email} (${language}): ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send renewal reminder to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send subscription ended notification
   * @param language - User's preferred language for the email
   */
  async sendSubscriptionEnded(
    email: string,
    username: string,
    packName: string,
    endDate: Date,
    language: 'en' | 'el' = 'en',
  ) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const t = emailTranslations[language as keyof typeof emailTranslations].ended;
    const subject = t.subject.replace('{packName}', packName);
    
    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject,
      html: this.getSubscriptionEndedTemplate(username, packName, endDate, appName, frontendUrl, language),
      text: language === 'el' ? `
Γεια σου ${username},

Η συνδρομή σου ${packName} έληξε στις ${endDate.toLocaleString('el-GR', { timeZone: 'Europe/Nicosia' })}.

Η premium πρόσβασή σου στις κατηγορίες ${packName} έχει πλέον λήξει.

Ευχαριστούμε που ήσουν μέρος της κοινότητάς μας! Ελπίζουμε να απόλαυσες τα premium στοιχήματα και το αποκλειστικό περιεχόμενο.

Θέλεις να Συνεχίσεις;
Ανανέωσε τη συνδρομή σου ή αναβάθμισε σε ανώτερο επίπεδο για να αποκτήσεις ξανά πρόσβαση στο premium περιεχόμενο!

Δες τα Πακέτα: ${frontendUrl}/packs

Με εκτίμηση,
Η ομάδα ${appName}
      `.trim() : `
Hi ${username},

Your ${packName} subscription has ended as of ${endDate.toLocaleString('en-GB', { timeZone: 'Europe/Nicosia' })}.

Your premium access to ${packName} categories has now expired.

Thank you for being part of our community! We hope you enjoyed the premium bets and exclusive content.

Want to Continue?
Renew your subscription or upgrade to a higher tier to regain access to premium content!

View Packs: ${frontendUrl}/packs

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Subscription ended notification sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send subscription ended notification to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send payment confirmation email when user purchases a pack
   * @param userId - The user's ID for generating the bot deep link
   * @param language - User's preferred language (determines which Telegram VIP link to show)
   */
  async sendPaymentConfirmation(
    email: string,
    username: string,
    packName: string,
    price: number,
    currency: string,
    startDate: Date,
    endDate: Date,
    isUpgrade: boolean = false,
    oldPackName?: string,
    language: 'en' | 'el' = 'en',
    userId?: string,
  ) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const t = emailTranslations[language as keyof typeof emailTranslations]?.payment || emailTranslations.en.payment;
    
    // Generate bot deep link for Telegram account linking
    // This link starts a conversation with the bot, which then validates subscription
    // and sends one-time VIP invite links (not static links that could be shared)
    const botUsername = this.configService.get('TELEGRAM_BOT_USERNAME') || '';
    const telegramBotLink = userId && botUsername ? `https://t.me/${botUsername}?start=link_${userId}` : '';
    
    // Only use bot link - no static fallback to prevent link sharing abuse
    // If bot is not configured, don't show Telegram section in email
    const telegramLink = telegramBotLink;
    // VIP links are sent by the bot after account linking - not included in email
    const telegramCommunityLink = '';
    
    const subject = isUpgrade 
      ? t.subjectUpgrade.replace('{packName}', packName)
      : t.subject.replace('{packName}', packName);
    
    const isGreek = language === 'el';
    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject,
      html: this.getPaymentConfirmationTemplate(
        username, packName, price, currency, startDate, endDate, 
        appName, frontendUrl, telegramLink, telegramCommunityLink, isUpgrade, oldPackName, language
      ),
      text: isGreek ? `
Γεια σου ${username},

${isUpgrade ? `Η αναβάθμισή σου από ${oldPackName} σε ${packName} επιβεβαιώθηκε!` : `Η πληρωμή σου για το ${packName} επιβεβαιώθηκε!`}

Λεπτομέρειες Πληρωμής:
- Πακέτο: ${packName}
- Ποσό: ${currency}${price.toFixed(2)}
- Περίοδος Συνδρομής: ${startDate.toLocaleDateString('el-GR')} - ${endDate.toLocaleDateString('el-GR')}

Τώρα έχεις πρόσβαση σε όλες τις δυνατότητες και το περιεχόμενο του ${packName}.

${telegramLink ? `Γίνε μέλος του VIP καναλιού μας στο Telegram: ${telegramLink}` : ''}
${telegramCommunityLink ? `Γίνε μέλος της VIP Κοινότητάς μας: ${telegramCommunityLink}` : ''}

Ευχαριστούμε για την αγορά σου!

Με εκτίμηση,
Η Ομάδα ${appName}
      `.trim() : `
Hi ${username},

${isUpgrade ? `Your upgrade from ${oldPackName} to ${packName} has been confirmed!` : `Your payment for ${packName} has been confirmed!`}

Payment Details:
- Pack: ${packName}
- Amount: ${currency}${price.toFixed(2)}
- Subscription Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}

You now have access to all ${packName} features and content.

${telegramLink ? `Join our VIP Telegram channel for bet tips: ${telegramLink}` : ''}
${telegramCommunityLink ? `Join our VIP Community chat to connect with other members: ${telegramCommunityLink}` : ''}

Thank you for your purchase!

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Payment confirmation sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send payment confirmation to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send 2FA verification code via email
   */
  async send2FACode(email: string, code: string, username?: string, language: string = 'en') {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const t = emailTranslations[language as keyof typeof emailTranslations] || emailTranslations.en;

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject: t.twoFactor.subject.replace('{appName}', appName),
      html: this.get2FAEmailTemplate(code, appName, username, language),
      text: language === 'el' ? `
${username ? `Γεια σου ${username},\n\n` : ''}Ο κωδικός επιβεβαίωσής σου για το ${appName} είναι: ${code}

Αυτός ο κωδικός θα λήξει σε 10 λεπτά.

Αν δεν ζήτησες αυτόν τον κωδικό, αγνόησε αυτό το email και σκέψου να αλλάξεις τον κωδικό σου.

Με εκτίμηση,
Η Ομάδα ${appName}
      `.trim() : `
${username ? `Hi ${username},\n\n` : ''}Your verification code for ${appName} is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email and consider changing your password.

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`2FA code sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send 2FA code to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send refund confirmation email to user
   */
  async sendRefundConfirmation(
    email: string,
    username: string,
    packName: string,
    refundAmount: number,
    currency: string,
    refundDate: Date,
    language: 'en' | 'el' = 'en',
  ) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const t = emailTranslations[language as keyof typeof emailTranslations]?.refund || emailTranslations.en.refund;
    const locale = language === 'el' ? 'el-GR' : 'en-GB';
    const greeting = language === 'el' ? 'Γεια σου' : 'Hi';
    const bestRegards = language === 'el' ? 'Με εκτίμηση,<br><strong>Η ομάδα' : 'Best regards,<br><strong>The';
    const teamSuffix = language === 'el' ? '</strong>' : ' Team</strong>';
    
    const mailOptions = {
      from: `"${appName}" <${this.configService.get('MAIL_FROM')}>`,
      to: email,
      subject: t.subject.replace('{packName}', packName),
      html: this.getRefundConfirmationTemplate(username, packName, refundAmount, currency, refundDate, appName, language),
      text: language === 'el' ? `
${greeting} ${username},

Η επιστροφή σου ολοκληρώθηκε επιτυχώς.

Λεπτομέρειες Επιστροφής:
- Πακέτο: ${packName}
- Ποσό: ${currency}${refundAmount.toFixed(2)}
- Ημερομηνία: ${refundDate.toLocaleDateString(locale)}

Η επιστροφή θα εμφανιστεί στον αρχικό τρόπο πληρωμής σου εντός 5-10 εργάσιμων ημερών, ανάλογα με την τράπεζά σου.

Η συνδρομή σου στο ${packName} έχει ακυρωθεί.

Αν έχεις ερωτήσεις, επικοινώνησε με την ομάδα υποστήριξής μας.

Με εκτίμηση,
Η Ομάδα ${appName}
      `.trim() : `
Hi ${username},

Your refund has been processed successfully.

Refund Details:
- Pack: ${packName}
- Amount: ${currency}${refundAmount.toFixed(2)}
- Date: ${refundDate.toLocaleDateString(locale)}

The refund will appear on your original payment method within 5-10 business days, depending on your bank.

Your subscription to ${packName} has been cancelled.

If you have any questions, please contact our support team.

Best regards,
The ${appName} Team
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Refund confirmation sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send refund confirmation to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send admin notification about payment issue
   */
  async sendAdminPaymentAlert(
    alertType: 'charge_failed' | 'dispute_created' | 'orphaned_charge' | 'refund_processed',
    userEmail: string,
    userId: string,
    amount: number,
    currency: string,
    stripePaymentIntentId: string,
    additionalInfo?: string,
  ) {
    const appName = this.configService.get('APP_NAME') || 'Libero Bets';
    const adminEmail = this.configService.get('ADMIN_EMAIL') || this.configService.get('MAIL_FROM');
    
    const alertMessages = {
      charge_failed: 'A charge has failed but money may have been deducted',
      dispute_created: 'A customer has disputed a charge',
      orphaned_charge: 'A charge was made but no subscription was activated',
      refund_processed: 'A refund has been processed',
    };

    const mailOptions = {
      from: `"${appName} Alert" <${this.configService.get('MAIL_FROM')}>`,
      to: adminEmail,
      subject: `⚠️ Payment Alert: ${alertMessages[alertType]}`,
      html: this.getAdminPaymentAlertTemplate(alertType, userEmail, userId, amount, currency, stripePaymentIntentId, additionalInfo, appName),
      text: `
PAYMENT ALERT - ${alertType.toUpperCase().replace('_', ' ')}

${alertMessages[alertType]}

User Details:
- Email: ${userEmail}
- User ID: ${userId}

Payment Details:
- Amount: ${currency}${amount.toFixed(2)}
- Stripe Payment Intent: ${stripePaymentIntentId}

${additionalInfo ? `Additional Info: ${additionalInfo}` : ''}

Action Required:
- Check Stripe dashboard for details
- Contact user if necessary
- Process manual refund if needed

This is an automated alert from ${appName}.
      `.trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Admin payment alert sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send admin payment alert:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * HTML template for refund confirmation email
   */
  private getRefundConfirmationTemplate(
    username: string,
    packName: string,
    refundAmount: number,
    currency: string,
    refundDate: Date,
    appName: string,
    language: 'en' | 'el' = 'en',
  ): string {
    const t = emailTranslations[language as keyof typeof emailTranslations]?.refund || emailTranslations.en.refund;
    const locale = language === 'el' ? 'el-GR' : 'en-GB';
    const greeting = language === 'el' ? 'Γεια σου' : 'Hi';
    const bestRegards = language === 'el' ? 'Με εκτίμηση,<br><strong>Η ομάδα' : 'Best regards,<br><strong>The';
    const teamSuffix = language === 'el' ? '</strong>' : ' Team</strong>';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName)}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title}</h2>
    
    <p>${greeting} ${username},</p>
    
    <p>${t.processed}</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #495057;">${t.details}</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">${t.pack}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${packName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">${t.amount}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #28a745;">${currency}${refundAmount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">${t.date}</td>
          <td style="padding: 8px 0; text-align: right;">${refundDate.toLocaleDateString(locale)}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #155724; font-size: 14px;">
        ✅ ${t.timeline}
      </p>
    </div>
    
    <p>${t.cancelled.replace('{packName}', `<strong>${packName}</strong>`)}</p>
    
    <p style="color: #666;">${t.questions}</p>
    
    <p style="margin-top: 30px;">${bestRegards} ${appName}${teamSuffix}</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for admin payment alert email
   */
  private getAdminPaymentAlertTemplate(
    alertType: 'charge_failed' | 'dispute_created' | 'orphaned_charge' | 'refund_processed',
    userEmail: string,
    userId: string,
    amount: number,
    currency: string,
    stripePaymentIntentId: string,
    additionalInfo: string | undefined,
    appName: string,
  ): string {
    const alertColors = {
      charge_failed: '#dc3545',
      dispute_created: '#fd7e14',
      orphaned_charge: '#ffc107',
      refund_processed: '#17a2b8',
    };

    const alertIcons = {
      charge_failed: '❌',
      dispute_created: '⚠️',
      orphaned_charge: '🔍',
      refund_processed: '💸',
    };

    const alertTitles = {
      charge_failed: 'Charge Failed',
      dispute_created: 'Dispute Created',
      orphaned_charge: 'Orphaned Charge Detected',
      refund_processed: 'Refund Processed',
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Alert</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${alertColors[alertType]}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${alertIcons[alertType]} ${alertTitles[alertType]}</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Payment Issue Detected</h2>
    
    <p>An issue has been detected that requires your attention.</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #495057;">User Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Email:</td>
          <td style="padding: 8px 0; text-align: right;">${userEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">User ID:</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${userId}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #495057;">Payment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Amount:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${currency}${amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Stripe Payment Intent:</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 11px;">${stripePaymentIntentId}</td>
        </tr>
      </table>
    </div>
    
    ${additionalInfo ? `
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>Additional Info:</strong> ${additionalInfo}
      </p>
    </div>
    ` : ''}
    
    <div style="background: #cce5ff; border-left: 4px solid #004085; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #004085; font-size: 14px;">
        <strong>Action Required:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Check Stripe dashboard for details</li>
          <li>Contact user if necessary</li>
          <li>Process manual refund if needed</li>
        </ul>
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://dashboard.stripe.com/payments/${stripePaymentIntentId}" 
         style="background: #635bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        View in Stripe Dashboard
      </a>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>This is an automated alert from ${appName}.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for verification email
   */
  private getVerificationEmailTemplate(verificationUrl: string, appName: string, username?: string, language: string = 'en'): string {
    const t = emailTranslations[language as keyof typeof emailTranslations]?.verification || emailTranslations.en.verification;
    const isGreek = language === 'el';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isGreek ? 'Επιβεβαίωση email' : 'Verify your email'}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName)}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${isGreek ? 'Επιβεβαίωσε τη Διεύθυνση Email σου' : 'Verify Your Email Address'}</h2>
    
    <p>${t.greeting}${username ? ` ${username}` : ''}! 👋</p>
    
    <p>${t.thanks.replace('{appName}', appName)}</p>
    
    <p>${t.clickBelow}</p>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${verificationUrl}" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 14px 40px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${t.verifyButton}
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">${t.copyPaste}</p>
    <p style="background: #f5f5f5; padding: 12px; border-radius: 5px; word-break: break-all; font-size: 13px; color: #667eea;">
      ${verificationUrl}
    </p>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        ⚠️ <strong>${t.important}</strong> ${t.expiresWarning}
      </p>
    </div>
    
    <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      ${t.ignore.replace('{appName}', appName)}
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. ${t.footer}</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for password reset email
   */
  private getPasswordResetEmailTemplate(resetUrl: string, appName: string, username?: string, language: string = 'en'): string {
    const t = emailTranslations[language as keyof typeof emailTranslations]?.passwordReset || emailTranslations.en.passwordReset;
    const isGreek = language === 'el';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isGreek ? 'Επαναφορά κωδικού' : 'Reset your password'}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName)}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title}</h2>
    
    ${username ? `<p>${t.greeting} <strong>${username}</strong>,</p>` : ''}
    
    <p>${t.received.replace('{appName}', appName)}</p>
    
    <p>${t.clickBelow}</p>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${resetUrl}" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 14px 40px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${t.resetButton}
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">${t.copyPaste}</p>
    <p style="background: #f5f5f5; padding: 12px; border-radius: 5px; word-break: break-all; font-size: 13px; color: #667eea;">
      ${resetUrl}
    </p>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        ⚠️ <strong>${t.important}</strong> ${t.expiresWarning}
      </p>
    </div>
    
    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #721c24; font-size: 14px;">
        🔒 <strong>${t.securityNotice}</strong> ${t.securityText}
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. ${isGreek ? 'Με επιφύλαξη κάθε δικαιώματος.' : 'All rights reserved.'}</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for welcome email
   */
  private getWelcomeEmailTemplate(username: string | undefined, appName: string, frontendUrl: string, language: string = 'en'): string {
    const t = emailTranslations[language as keyof typeof emailTranslations]?.welcome || emailTranslations.en.welcome;
    const isGreek = language === 'el';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title.replace('{appName}', appName)}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName)}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title.replace('{appName}', appName)}</h2>
    
    <p>${t.greeting}${username ? ` ${username}` : ''}!</p>
    
    <p>${t.verified}</p>
    
    <p>${t.accessTo}</p>
    
    <ul style="line-height: 2;">
      <li>🎯 ${t.feature1}</li>
      <li>📊 ${t.feature2}</li>
      <li>💰 ${t.feature3}</li>
      <li>📱 ${t.feature4}</li>
    </ul>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${frontendUrl}/bets" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 14px 40px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${t.goToDashboard}
      </a>
    </div>
    
    <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #0c5460; font-size: 14px;">
        💡 <strong>${t.proTip}</strong> ${t.proTipText}
      </p>
    </div>
    
    <p>${t.questions}</p>
    
    <p style="margin-top: 30px;">${t.bestRegards}<br><strong>${isGreek ? 'Η Ομάδα' : 'The'} ${appName} ${isGreek ? '' : 'Team'}</strong></p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. ${isGreek ? 'Με επιφύλαξη κάθε δικαιώματος.' : 'All rights reserved.'}</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for subscription confirmation
   */
  private getSubscriptionConfirmationTemplate(
    username: string,
    packName: string,
    price: number,
    startDate: Date,
    endDate: Date,
    appName: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Confirmed</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName, '#00e5ff', '#0088ff')}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Subscription Confirmed! ✅</h2>
    
    <p>Hi <strong>${username}</strong>!</p>
    
    <p>Thank you for subscribing to <strong>${packName}</strong>! Your subscription is now active.</p>
    
    <div style="background: #f8f9fa; border: 2px solid #00e5ff; padding: 25px; margin: 25px 0; border-radius: 8px;">
      <h3 style="color: #0088ff; margin-top: 0;">Subscription Details</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Pack:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${packName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Monthly Price:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #00e5ff; font-size: 18px; font-weight: bold;">€${price}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Start Date:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${startDate.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>End Date:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${endDate.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Next Billing:</strong></td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${endDate.toLocaleDateString()}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 13px;">
        📅 Your subscription will automatically renew on <strong>${endDate.toLocaleDateString()}</strong> for €${price}/month.<br>
        📧 You'll receive a reminder 3 days before renewal.
      </p>
    </div>
    
    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #721c24; font-size: 13px;">
        ⚠️ <strong>Important:</strong> All subscriptions are non-refundable and cannot be cancelled. You can upgrade to higher tiers anytime.
      </p>
    </div>
    
    <p style="margin-top: 30px;">Best regards,<br><strong>The ${appName} Team</strong></p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for upgrade confirmation
   */
  private getUpgradeConfirmationTemplate(
    username: string,
    oldPackName: string,
    newPackName: string,
    pricePaid: number,
    newMonthlyPrice: number,
    startDate: Date,
    endDate: Date,
    appName: string,
    language: 'en' | 'el' = 'en',
  ): string {
    const t = emailTranslations[language as keyof typeof emailTranslations].upgrade;
    const locale = language === 'el' ? 'el-GR' : 'en-GB';
    const greeting = language === 'el' ? 'Γεια σου' : 'Hi';
    const bestRegards = language === 'el' ? 'Με εκτίμηση,<br><strong>Η ομάδα' : 'Best regards,<br><strong>The';
    const teamSuffix = language === 'el' ? '</strong>' : ' Team</strong>';
    const importantNote = language === 'el' 
      ? `📅 <strong>Σημαντικό:</strong> Η περίοδος συνδρομής σου έχει επαναφερθεί. Οι συνδρομές ΔΕΝ ανανεώνονται αυτόματα.<br>📧 Θα λάβεις υπενθύμιση 3 ημέρες πριν τη λήξη.`
      : `📅 <strong>Important:</strong> Your subscription period has been reset. Subscriptions do NOT auto-renew.<br>📧 You'll receive a reminder 3 days before expiry.`;
    const noCancellation = language === 'el'
      ? `⚠️ <strong>Χωρίς Ακυρώσεις:</strong> Όλες οι συνδρομές δεν επιστρέφονται και δεν μπορούν να ακυρωθούν ή να υποβαθμιστούν.`
      : `⚠️ <strong>No Cancellations:</strong> All subscriptions are non-refundable and cannot be cancelled or downgraded.`;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName, '#ff9500', '#ff5e00')}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title}</h2>
    
    <p>${greeting} <strong>${username}</strong>!</p>
    
    <p>${t.congrats.replace('{oldPack}', oldPackName).replace('{newPack}', newPackName)}</p>
    
    <div style="background: #f8f9fa; border: 2px solid #ff9500; padding: 25px; margin: 25px 0; border-radius: 8px;">
      <h3 style="color: #ff5e00; margin-top: 0;">${t.details}</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.from}</strong></td>
          <td style="padding: 8px 0; text-align: right;">${oldPackName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.to}</strong></td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${newPackName}</td>
        </tr>
        <tr style="border-top: 1px solid #ddd;">
          <td style="padding: 8px 0; color: #666; padding-top: 15px;"><strong>${t.amountPaid}</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #ff9500; font-size: 18px; font-weight: bold; padding-top: 15px;">€${pricePaid}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #999; font-size: 12px;" colspan="2">${t.difference}</td>
        </tr>
        <tr style="border-top: 1px solid #ddd;">
          <td style="padding: 8px 0; color: #666; padding-top: 15px;"><strong>${t.newMonthlyPrice}</strong></td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; padding-top: 15px;">€${newMonthlyPrice}/${language === 'el' ? 'μήνα' : 'month'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.newPeriod}</strong></td>
          <td style="padding: 8px 0; text-align: right;">${startDate.toLocaleDateString(locale)} - ${endDate.toLocaleDateString(locale)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.nextBilling}</strong></td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${endDate.toLocaleDateString(locale)}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #0c5460; font-size: 13px;">
        ${importantNote}
      </p>
    </div>
    
    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #721c24; font-size: 13px;">
        ${noCancellation}
      </p>
    </div>
    
    <p style="margin-top: 30px;">${t.enjoy}<br>${bestRegards} ${appName}${teamSuffix}</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for renewal reminder
   */
  private getRenewalReminderTemplate(
    username: string,
    packName: string,
    price: number,
    renewalDate: Date,
    appName: string,
    language: 'en' | 'el' = 'en',
  ): string {
    const t = emailTranslations[language as keyof typeof emailTranslations].renewal;
    const locale = language === 'el' ? 'el-GR' : 'en-GB';
    const dateStr = renewalDate.toLocaleDateString(locale, { timeZone: 'Europe/Nicosia' });
    const greeting = language === 'el' ? 'Γεια σου' : 'Hi';
    const bestRegards = language === 'el' ? 'Με εκτίμηση,<br><strong>Η ομάδα' : 'Best regards,<br><strong>The';
    const teamSuffix = language === 'el' ? '</strong>' : ' Team</strong>';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName)}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title}</h2>
    
    <p>${greeting} <strong>${username}</strong>!</p>
    
    <p>${t.reminder.replace('{packName}', `<strong>${packName}</strong>`)}</p>
    
    <div style="background: #f8f9fa; border: 2px solid #667eea; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center;">
      <p style="color: #666; margin: 0 0 10px 0;">${t.renewsOn}</p>
      <p style="font-size: 24px; font-weight: bold; color: #667eea; margin: 10px 0;">${dateStr}</p>
      <p style="color: #666; margin: 10px 0 0 0;">${t.amount} <strong style="font-size: 20px; color: #764ba2;">€${price}</strong></p>
    </div>
    
    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #721c24; font-size: 13px;">
        ⚠️ ${t.autoRenew}
      </p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 13px;">
        📦 ${t.noRefund}
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${this.frontendUrl}/packs" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                text-decoration: none; 
                padding: 15px 40px; 
                border-radius: 25px; 
                font-weight: bold; 
                display: inline-block; 
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        🚀 ${t.upgrade.replace(/!$/, '')}
      </a>
    </div>
    
    <p style="margin-top: 30px;">${bestRegards} ${appName}${teamSuffix}</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for subscription ended
   */
  private getSubscriptionEndedTemplate(
    username: string,
    packName: string,
    endDate: Date,
    appName: string,
    frontendUrl: string,
    language: 'en' | 'el' = 'en',
  ): string {
    const t = emailTranslations[language as keyof typeof emailTranslations].ended;
    const locale = language === 'el' ? 'el-GR' : 'en-GB';
    const dateStr = endDate.toLocaleString(locale, { timeZone: 'Europe/Nicosia', dateStyle: 'full', timeStyle: 'long' });
    const greeting = language === 'el' ? 'Γεια σου' : 'Hi';
    const bestRegards = language === 'el' ? 'Με εκτίμηση,<br><strong>Η ομάδα' : 'Best regards,<br><strong>The';
    const teamSuffix = language === 'el' ? '</strong>' : ' Team</strong>';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName, '#dc3545', '#c82333')}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title}</h2>
    
    <p>${greeting} <strong>${username}</strong>,</p>
    
    <p>${t.ended.replace('{packName}', `<strong>${packName}</strong>`)}</p>
    
    <div style="background: #f8f9fa; border: 2px solid #dc3545; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center;">
      <p style="font-size: 20px; font-weight: bold; color: #dc3545; margin: 0;">${dateStr}</p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 13px;">
        📦 ${t.expired.replace('{packName}', `<strong>${packName}</strong>`)}
      </p>
    </div>
    
    <p>${t.thanks}</p>
    
    <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 20px; margin: 25px 0; border-radius: 4px; text-align: center;">
      <h3 style="color: #0c5460; margin-top: 0;">${t.continueTitle}</h3>
      <p style="color: #0c5460; margin: 10px 0;">
        ${t.continueText}
      </p>
      <a href="${frontendUrl}/packs" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;
                margin-top: 15px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${t.viewPacks}
      </a>
    </div>
    
    <p style="margin-top: 30px;">${bestRegards} ${appName}${teamSuffix}</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for payment confirmation email
   */
  private getPaymentConfirmationTemplate(
    username: string,
    packName: string,
    price: number,
    currency: string,
    startDate: Date,
    endDate: Date,
    appName: string,
    frontendUrl: string,
    telegramLink: string,
    telegramCommunityLink: string,
    isUpgrade: boolean = false,
    oldPackName?: string,
    language: string = 'en',
  ): string {
    const t = emailTranslations[language as keyof typeof emailTranslations]?.payment || emailTranslations.en.payment;
    const isGreek = language === 'el';
    const dateLocale = isGreek ? 'el-GR' : 'en-US';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName, '#28a745', '#20c997')}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title}</h2>
    
    <p>${t.greeting} <strong>${username}</strong>!</p>
    
    <p>${isUpgrade 
      ? t.upgradeConfirmed.replace('{oldPack}', oldPackName || '').replace('{newPack}', packName)
      : t.confirmed.replace('{packName}', packName)}</p>
    
    <div style="background: #d4edda; border: 2px solid #28a745; padding: 25px; margin: 25px 0; border-radius: 8px;">
      <h3 style="color: #155724; margin-top: 0;">${t.details}</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.pack}</strong></td>
          <td style="padding: 8px 0; text-align: right;">${packName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.amountPaid}</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #28a745; font-size: 18px; font-weight: bold;">${currency}${price.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.startDate}</strong></td>
          <td style="padding: 8px 0; text-align: right;">${startDate.toLocaleDateString(dateLocale)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>${t.endDate}</strong></td>
          <td style="padding: 8px 0; text-align: right;">${endDate.toLocaleDateString(dateLocale)}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #0c5460; font-size: 14px;">
        ${t.accessNow.replace('{packName}', packName)}
      </p>
    </div>
    
    ${telegramLink ? `
    <div style="background: #e3f2fd; border: 2px solid #0088cc; padding: 20px; margin: 25px 0; border-radius: 8px; text-align: center;">
      <h3 style="color: #0088cc; margin-top: 0;">📱 ${isGreek ? 'Σύνδεση με το Telegram' : 'Connect to Telegram'}</h3>
      <div style="margin: 15px 0;">
        <p style="color: #333; margin: 5px 0; font-weight: bold;">🤖 ${isGreek ? 'Βήμα 1: Σύνδεσε τον λογαριασμό σου' : 'Step 1: Link Your Account'}</p>
        <p style="color: #666; margin: 5px 0; font-size: 13px;">${isGreek ? 'Κάνε κλικ στο παρακάτω κουμπί για να ξεκινήσεις συνομιλία με το bot μας. Θα λάβεις τους συνδέσμους πρόσβασης VIP αμέσως!' : 'Click the button below to start a chat with our bot. You\'ll receive your VIP access links immediately!'}</p>
        <a href="${telegramLink}" 
           style="background: linear-gradient(135deg, #0088cc 0%, #00a8e8 100%); 
                  color: white; 
                  padding: 12px 30px; 
                  text-decoration: none; 
                  border-radius: 5px; 
                  font-weight: bold;
                  display: inline-block;
                  margin-top: 10px;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          ${isGreek ? '🚀 Σύνδεση & Λήψη Πρόσβασης VIP' : '🚀 Connect & Get VIP Access'}
        </a>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
        <p style="color: #666; margin: 0; font-size: 12px;">💡 ${isGreek ? 'Μετά τη σύνδεση θα λάβεις μοναδικούς συνδέσμους πρόσβασης για το VIP κανάλι και την κοινότητα.' : 'After connecting, you\'ll receive unique access links for the VIP channel and community chat.'}</p>
      </div>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${frontendUrl}/bets" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 14px 40px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${t.goToDashboard}
      </a>
    </div>
    
    <p style="margin-top: 30px;">${t.thanks}<br><strong>${isGreek ? 'Η Ομάδα' : 'The'} ${appName} ${isGreek ? '' : 'Team'}</strong></p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. ${isGreek ? 'Με επιφύλαξη κάθε δικαιώματος.' : 'All rights reserved.'}</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for 2FA email
   */
  private get2FAEmailTemplate(code: string, appName: string, username?: string, language: string = 'en'): string {
    const t = emailTranslations[language as keyof typeof emailTranslations]?.twoFactor || emailTranslations.en.twoFactor;
    const isGreek = language === 'el';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isGreek ? 'Κωδικός Επιβεβαίωσης' : 'Verification Code'}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${this.getEmailHeader(appName)}
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${t.title}</h2>
    
    ${username ? `<p>${t.greeting} <strong>${username}</strong>,</p>` : ''}
    
    <p>${t.yourCode.replace('{appName}', appName)}</p>
    
    <div style="background: #f8f9fa; border: 2px solid #667eea; padding: 30px; margin: 25px 0; border-radius: 8px; text-align: center;">
      <p style="font-size: 36px; font-weight: bold; color: #667eea; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        ⏰ ${t.expiresWarning}
      </p>
    </div>
    
    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #721c24; font-size: 14px;">
        🔒 <strong>${t.securityNotice}</strong> ${t.securityText}
      </p>
    </div>
    
    <p style="color: #666; font-size: 13px;">
      ${t.enterCode}
    </p>
    
    <p style="margin-top: 30px;">${isGreek ? 'Με εκτίμηση,' : 'Best regards,'}<br><strong>${isGreek ? 'Η Ομάδα' : 'The'} ${appName} ${isGreek ? '' : 'Team'}</strong></p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ${appName}. ${isGreek ? 'Με επιφύλαξη κάθε δικαιώματος.' : 'All rights reserved.'}</p>
  </div>
</body>
</html>
    `.trim();
  }
}

