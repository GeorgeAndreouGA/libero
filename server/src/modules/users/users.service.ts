import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { SecurityAuditService } from '../../common/security/security-audit.service';
import { StripeService } from '../../common/stripe/stripe.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly telegramService: TelegramService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly stripeService: StripeService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.db.queryOne(
      'SELECT id, email, username, full_name, role, two_factor_enabled, preferred_language FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      twoFactorEnabled: user.two_factor_enabled || false,
      preferredLanguage: user.preferred_language || 'en',
    };
  }

  async toggle2FA(userId: string, enabled: boolean) {
    await this.db.query(
      'UPDATE users SET two_factor_enabled = ? WHERE id = ?',
      [enabled, userId]
    );

    return { 
      message: enabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled',
      twoFactorEnabled: enabled,
    };
  }

  async updateLanguage(userId: string, language: string) {
    // Validate language
    if (!['en', 'el'].includes(language)) {
      throw new BadRequestException('Invalid language. Supported languages: en, el');
    }

    await this.db.execute(
      'UPDATE users SET preferred_language = ? WHERE id = ?',
      [language, userId]
    );

    return { 
      message: 'Language preference updated successfully',
      preferredLanguage: language,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Validate password requirements
    if (newPassword.length < 10) {
      throw new BadRequestException('Password must be at least 10 characters');
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?])/;
    if (!passwordRegex.test(newPassword)) {
      throw new BadRequestException('Password must contain uppercase, lowercase, number, and special character');
    }

    // Get current password hash
    const user = await this.db.queryOne(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password and increment token_version to invalidate all existing sessions
    await this.db.query(
      'UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
      [newPasswordHash, userId]
    );

    // Log password change event
    await this.securityAuditService.logSecurityEvent('PASSWORD_CHANGE', {
      userId,
      details: { reason: 'User initiated password change' },
    });

    this.logger.log(`Password changed for user ${userId}, all sessions invalidated`);

    return { 
      message: 'Password changed successfully. Please login again with your new password.',
      sessionInvalidated: true,
    };
  }

  async getAllUsers(search?: string, timeFilter?: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    const safeLimit = Math.min(Math.max(limit, 1), 100); // Clamp between 1 and 100

    // IMPORTANT: Also check current_period_end > NOW() to count only truly active subscriptions
    let query = `
      SELECT u.id, u.email, u.username, u.full_name, u.role, u.status, 
             u.created_at, u.last_login,
             COUNT(DISTINCT s.id) as activeSubscriptions,
             SUM(CASE WHEN t.status = 'COMPLETED' THEN t.amount ELSE 0 END) as totalSpent
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'ACTIVE' AND s.current_period_end > NOW()
      LEFT JOIN transactions t ON u.id = t.user_id
      WHERE u.role = 'user'
    `;

    let countQuery = `SELECT COUNT(*) as total FROM users u WHERE u.role = 'user'`;
    const params: any[] = [];
    const countParams: any[] = [];

    // Add search filter
    if (search) {
      query += ' AND (u.email LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)';
      countQuery += ' AND (u.email LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Add time filter
    if (timeFilter === '24h') {
      query += ' AND u.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
      countQuery += ' AND u.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
    } else if (timeFilter === 'month') {
      query += ' AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      countQuery += ' AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    query += ' GROUP BY u.id, u.email, u.username, u.full_name, u.role, u.status, u.created_at, u.last_login';
    query += ` ORDER BY u.created_at DESC LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`;

    const [users, countResult] = await Promise.all([
      this.db.query(query, params),
      this.db.queryOne(countQuery, countParams),
    ]);
    
    const total = countResult?.total || 0;

    return {
      data: users,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      }
    };
  }

  async getUserTransactions(userId: string, timeFilter?: string) {
    let query = `
      SELECT t.id, t.amount, t.currency, t.status, t.description, 
             t.created_at, s.id as subscriptionId,
             p.name as packName
      FROM transactions t
      LEFT JOIN subscriptions s ON t.subscription_id = s.id
      LEFT JOIN packs p ON s.pack_id = p.id
      WHERE t.user_id = ?
    `;

    const params: any[] = [userId];

    // Add time filter
    if (timeFilter === '24h') {
      query += ' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
    } else if (timeFilter === 'month') {
      query += ' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    query += ' ORDER BY t.created_at DESC';

    const transactions = await this.db.query(query, params);
    return transactions;
  }

  /**
   * Export all user data (GDPR Right to Data Portability - Article 20)
   */
  async exportUserData(userId: string) {
    // Get user profile
    const user = await this.db.queryOne(
      `SELECT id, email, username, full_name, role, status, 
              two_factor_enabled, preferred_language, created_at, last_login
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get subscriptions
    const subscriptions = await this.db.query(
      `SELECT s.id, s.status, s.current_period_start, s.current_period_end, s.created_at,
              p.name as pack_name, p.price_monthly as pack_price
       FROM subscriptions s
       LEFT JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ?`,
      [userId]
    );

    // Get transactions
    const transactions = await this.db.query(
      `SELECT id, amount, currency, status, description, created_at
       FROM transactions WHERE user_id = ?`,
      [userId]
    );

    // Format export data
    const exportData = {
      exportDate: new Date().toISOString(),
      exportFormat: 'JSON',
      gdprArticle: 'Article 20 - Right to Data Portability',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        status: user.status,
        twoFactorEnabled: user.two_factor_enabled || false,
        preferredLanguage: user.preferred_language || 'en',
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
      subscriptions: subscriptions.map((s: any) => ({
        id: s.id,
        packName: s.pack_name,
        packPrice: s.pack_price,
        status: s.status,
        periodStart: s.current_period_start,
        periodEnd: s.current_period_end,
        createdAt: s.created_at,
      })),
      transactions: transactions.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        description: t.description,
        createdAt: t.created_at,
      })),
    };

    return exportData;
  }

  /**
   * Request account deletion (initiates the process)
   */
  async requestAccountDeletion(userId: string, password: string, reason?: string) {
    // Verify password
    const user = await this.db.queryOne(
      'SELECT id, email, password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new BadRequestException('Invalid password');
    }

    // Log deletion request (for audit purposes)
    console.log(`Account deletion requested for user ${userId}. Reason: ${reason || 'Not specified'}`);

    return {
      message: 'Account deletion request received. Your account will be deleted or anonymized according to our data retention policy.',
      deletionInfo: {
        accountData: 'Will be anonymized immediately',
        transactionRecords: 'Will be retained for 7 years (tax compliance) in anonymized form',
        subscriptionHistory: 'Will be anonymized immediately',
        processingTime: 'Up to 30 days as per GDPR requirements',
      },
      nextStep: 'Confirm deletion by calling the delete endpoint with your password and confirmDeletion: true',
    };
  }

  /**
   * Delete or anonymize user account (GDPR Right to be Forgotten - Article 17)
   */
  async deleteOrAnonymizeAccount(userId: string, password: string, confirmDeletion: boolean) {
    if (!confirmDeletion) {
      throw new BadRequestException('You must confirm deletion by setting confirmDeletion to true');
    }

    // Verify password
    const user = await this.db.queryOne(
      'SELECT id, email, password_hash, stripe_customer_id FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new BadRequestException('Invalid password');
    }

    // Generate anonymous identifier for retained records
    const anonymousId = `DELETED_USER_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Kick user from VIP Telegram group BEFORE anonymizing data
    // (we need the original preferred_language to know which group to kick from)
    try {
      const kicked = await this.telegramService.kickUserByUserId(userId);
      if (kicked) {
        this.logger.log(`Successfully kicked user ${userId} from VIP Telegram groups`);
      }
    } catch (telegramError) {
      // Log but don't fail the deletion
      console.error('Failed to kick user from Telegram during account deletion:', telegramError);
    }

    // Anonymize user data (keep structure for referential integrity)
    // Use 'inactive' status since 'deleted' is not in the enum
    // Clear stripe_customer_id to avoid UNIQUE constraint conflicts if user re-registers
    // Clear telegram_user_id after kicking
    await this.db.execute(
      `UPDATE users SET 
        email = ?,
        username = ?,
        full_name = 'Deleted User',
        password_hash = 'DELETED',
        status = 'inactive',
        email_verified = false,
        email_verification_token = NULL,
        email_verification_expires = NULL,
        password_reset_token = NULL,
        password_reset_expires = NULL,
        two_factor_enabled = false,
        two_factor_code = NULL,
        two_factor_expires = NULL,
        preferred_language = 'en',
        stripe_customer_id = NULL,
        telegram_user_id = NULL,
        deleted_at = NOW()
       WHERE id = ?`,
      [
        `deleted_${anonymousId}@deleted.local`,
        `deleted_${anonymousId}`,
        userId
      ]
    );

    // Cancel active subscriptions in Stripe first, then in database
    const activeSubscriptions = await this.db.query(
      `SELECT stripe_subscription_id FROM subscriptions WHERE user_id = ? AND status = 'ACTIVE' AND stripe_subscription_id IS NOT NULL`,
      [userId]
    );

    for (const sub of activeSubscriptions) {
      try {
        await this.stripeService.cancelSubscription(sub.stripe_subscription_id, true); // true = immediately
        this.logger.log(`Cancelled Stripe subscription ${sub.stripe_subscription_id} for deleted user ${userId}`);
      } catch (stripeError) {
        this.logger.error(`Failed to cancel Stripe subscription ${sub.stripe_subscription_id}: ${stripeError.message}`);
        // Continue with other subscriptions even if one fails
      }
    }

    // Anonymize Stripe customer to allow re-registration with same email
    if (user.stripe_customer_id) {
      await this.stripeService.anonymizeCustomer(user.stripe_customer_id);
      this.logger.log(`Anonymized Stripe customer ${user.stripe_customer_id} for deleted user ${userId}`);
    }

    // Update database status
    await this.db.execute(
      `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW() WHERE user_id = ? AND status = 'ACTIVE'`,
      [userId]
    );

    // Anonymize transaction descriptions but keep financial records for 7 years
    await this.db.execute(
      `UPDATE transactions SET description = CONCAT('Transaction for deleted user: ', ?) WHERE user_id = ?`,
      [anonymousId, userId]
    );

    return {
      message: 'Account successfully deleted/anonymized',
      details: {
        profileData: 'Anonymized',
        subscriptions: 'Cancelled and anonymized',
        transactions: 'Anonymized but retained for tax compliance (7 years)',
        gdprCompliance: 'Article 17 - Right to Erasure fulfilled',
        note: 'Some data may be retained in anonymized form for legal compliance. This data cannot be linked back to you.',
      },
    };
  }

  /**
   * Link user's Telegram account
   */
  async linkTelegram(userId: string, telegramUserId: string) {
    // Validate telegram user ID (should be numeric)
    if (!/^\d+$/.test(telegramUserId)) {
      throw new BadRequestException('Invalid Telegram user ID format');
    }

    await this.telegramService.updateUserTelegramId(userId, telegramUserId);

    return {
      message: 'Telegram account linked successfully',
      telegramUserId,
    };
  }

  /**
   * Unlink user's Telegram account
   */
  async unlinkTelegram(userId: string) {
    await this.db.query(
      'UPDATE users SET telegram_user_id = NULL WHERE id = ?',
      [userId]
    );

    return {
      message: 'Telegram account unlinked successfully',
    };
  }

  /**
   * Get user's Telegram link status
   */
  async getTelegramStatus(userId: string) {
    const user = await this.db.queryOne(
      'SELECT telegram_user_id FROM users WHERE id = ?',
      [userId]
    );

    return {
      isLinked: !!user?.telegram_user_id,
      telegramUserId: user?.telegram_user_id || null,
    };
  }
}
