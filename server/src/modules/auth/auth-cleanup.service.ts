import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../common/database/database.service';

/**
 * Auth Cleanup Service
 * Handles cleanup of expired unverified accounts and expired tokens
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Clean up expired unverified accounts
   * Runs every minute (for testing - normally should be every hour)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredUnverifiedAccounts() {
    try {
      this.logger.log('Starting cleanup of expired unverified accounts...');

      // Delete users where:
      // 1. Email is not verified
      // 2. Status is 'pending'
      // 3. Email verification has expired
      const result = await this.db.execute(
        `DELETE FROM users 
         WHERE email_verified = false 
         AND status = 'pending'
         AND email_verification_expires IS NOT NULL
         AND email_verification_expires < NOW()`,
      );

      const deletedCount = result.affectedRows || 0;

      if (deletedCount > 0) {
        this.logger.log(
          `Cleaned up ${deletedCount} expired unverified account(s)`,
        );
      } else {
        this.logger.debug('No expired unverified accounts to clean up');
      }

      return {
        success: true,
        deletedCount,
      };
    } catch (error) {
      this.logger.error('Error cleaning up expired accounts:', error);
      throw error;
    }
  }

  /**
   * Clean up expired password reset tokens
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredPasswordResetTokens() {
    try {
      const result = await this.db.execute(
        `UPDATE users 
         SET password_reset_token = NULL, password_reset_expires = NULL 
         WHERE password_reset_expires IS NOT NULL AND password_reset_expires < NOW()`,
      );

      const cleanedCount = result.affectedRows || 0;

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired password reset token(s)`);
      }

      return { success: true, deletedCount: cleanedCount };
    } catch (error) {
      this.logger.error('Error cleaning up expired password reset tokens:', error);
      throw error;
    }
  }

  /**
   * Clean up expired 2FA tokens
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpired2FATokens() {
    try {
      const result = await this.db.execute(
        `UPDATE users 
         SET two_factor_code = NULL, two_factor_expires = NULL 
         WHERE two_factor_expires IS NOT NULL AND two_factor_expires < NOW()`,
      );

      const cleanedCount = result.affectedRows || 0;

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired 2FA token(s)`);
      }

      return { success: true, deletedCount: cleanedCount };
    } catch (error) {
      this.logger.error('Error cleaning up expired 2FA tokens:', error);
      throw error;
    }
  }

  /**
   * Clean up old webhook events
   * Runs daily at 3am - keeps events for 30 days
   */
  @Cron('0 3 * * *') // Every day at 3:00 AM
  async cleanupOldWebhookEvents() {
    try {
      this.logger.log('Starting cleanup of old webhook events...');

      // Delete webhook events older than 30 days
      const result = await this.db.execute(
        `DELETE FROM webhook_events 
         WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      );

      const deletedCount = result.affectedRows || 0;

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old webhook event(s)`);
      } else {
        this.logger.debug('No old webhook events to clean up');
      }

      return { success: true, deletedCount };
    } catch (error) {
      this.logger.error('Error cleaning up old webhook events:', error);
      throw error;
    }
  }

  /**
   * Clean up old security events
   * Runs daily at 3:30am - keeps logs for 90 days
   */
  @Cron('30 3 * * *') // Every day at 3:30 AM
  async cleanupOldSecurityEvents() {
    try {
      this.logger.log('Starting cleanup of old security events...');

      // Delete security events older than 90 days
      const result = await this.db.execute(
        `DELETE FROM security_events 
         WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`,
      );

      const deletedCount = result.affectedRows || 0;

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old security event(s)`);
      } else {
        this.logger.debug('No old security events to clean up');
      }

      return { success: true, deletedCount };
    } catch (error) {
      this.logger.error('Error cleaning up old security events:', error);
      throw error;
    }
  }

  /**
   * Manual cleanup trigger (can be called from admin panel)
   */
  async manualCleanup() {
    this.logger.log('Manual cleanup triggered');
    const [accounts, passwordTokens, twoFaTokens, webhookEvents, securityEvents] = await Promise.all([
      this.cleanupExpiredUnverifiedAccounts(),
      this.cleanupExpiredPasswordResetTokens(),
      this.cleanupExpired2FATokens(),
      this.cleanupOldWebhookEvents(),
      this.cleanupOldSecurityEvents(),
    ]);
    return {
      expiredAccounts: accounts.deletedCount,
      expiredPasswordResetTokens: passwordTokens.deletedCount,
      expired2FATokens: twoFaTokens.deletedCount,
      oldWebhookEvents: webhookEvents.deletedCount,
      oldSecurityEvents: securityEvents.deletedCount,
    };
  }
}

