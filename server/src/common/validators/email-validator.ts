/**
 * Email Validation Utility
 * Validates email addresses and blocks temporary/disposable email providers
 */

// List of legitimate email providers (whitelist approach)
const LEGITIMATE_EMAIL_PROVIDERS = [
  // Major providers
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.de',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'yandex.ru',
  
  // Business/Corporate
  'microsoft.com',
  'apple.com',
  'amazon.com',
  'ibm.com',
  'oracle.com',
  'salesforce.com',
  
  // European providers
  'web.de',
  'freenet.de',
  't-online.de',
  'orange.fr',
  'laposte.net',
  'free.fr',
  'wanadoo.fr',
  'libero.it',
  'virgilio.it',
  'tiscali.it',
  
  // Greek providers
  'yahoo.gr',
  'hotmail.gr',
  'windowslive.gr',
  'otenet.gr',
  'forthnet.gr',
  'cosmotemail.gr',
  'vodafone.gr',
  'hol.gr',
  'in.gr',
  'pathfinder.gr',
  'mail.gr',
  
  // Other legitimate providers
  'fastmail.com',
  'tutanota.com',
  'mailfence.com',
  'posteo.de',
  'runbox.com',
];

// Common temporary/disposable email domains (blacklist)
const DISPOSABLE_EMAIL_DOMAINS = [
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'throwaway.email',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
  'yopmail.com',
  'maildrop.cc',
  'getnada.com',
  'mohmal.com',
  'sharklasers.com',
  'guerrillamail.info',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'spam4.me',
  'mailnesia.com',
  'emailondeck.com',
  'mintemail.com',
  'mytemp.email',
  'temp-mail.io',
  'tempmail.net',
  'dispostable.com',
  'throwawaymail.com',
  'mailcatch.com',
  'emailfake.com',
];

/**
 * Check if email domain is from a legitimate provider
 */
export function isLegitimateEmailProvider(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  
  if (!domain) {
    return false;
  }

  // Check if it's a whitelisted legitimate provider
  if (LEGITIMATE_EMAIL_PROVIDERS.includes(domain)) {
    return true;
  }

  // Check if it's a known disposable email
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return false;
  }

  // For custom domains (company emails), we'll allow them
  // but they should have proper MX records (can be validated separately)
  // For now, we'll be strict and only allow whitelisted domains
  // You can adjust this logic based on your requirements
  
  return false; // Strict: only allow whitelisted domains
}

/**
 * Check if email is from a disposable/temporary email provider
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  
  if (!domain) {
    return false;
  }

  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

/**
 * Validate email format and legitimacy
 */
export function validateEmail(email: string): {
  valid: boolean;
  message?: string;
} {
  // Basic format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      message: 'Invalid email format',
    };
  }

  // Check for disposable email
  if (isDisposableEmail(email)) {
    return {
      valid: false,
      message: 'Temporary or disposable email addresses are not allowed',
    };
  }

  // Check if from legitimate provider
  if (!isLegitimateEmailProvider(email)) {
    return {
      valid: false,
      message: 'Please use a legitimate email provider (Gmail, Outlook, Yahoo, etc.)',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Add a custom domain to the whitelist (for corporate emails)
 * This can be used to allow specific company domains
 */
export function addLegitimateProvider(domain: string): void {
  const normalizedDomain = domain.toLowerCase();
  if (!LEGITIMATE_EMAIL_PROVIDERS.includes(normalizedDomain)) {
    LEGITIMATE_EMAIL_PROVIDERS.push(normalizedDomain);
  }
}

