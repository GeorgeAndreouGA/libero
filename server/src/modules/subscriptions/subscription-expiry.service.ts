import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../common/database/database.service';
import { EmailService } from '../../common/email/email.service';
import { TelegramService } from '../../common/telegram/telegram.service';

@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Run every hour to check for expired subscriptions
   * IMPORTANT: This catches ALL expired subscriptions, not just recent ones
   * This ensures no subscriptions slip through if server was down
   */
  @Cron('0 * * * *') // Every hour at minute 0
  async checkExpiredSubscriptions() {
    this.logger.log('Checking for expired subscriptions...');

    try {
      const now = new Date();

      // Log for debugging
      console.log('[Expiry Check] Now:', now.toISOString());

      // Get ALL subscriptions that are ACTIVE but have expired (period_end <= now)
      // This catches any missed expirations (e.g., if server was down)
      const query = `
        SELECT 
          s.id,
          s.current_period_end,
          u.id as user_id,
          u.email,
          u.username,
          u.preferred_language,
          p.name as pack_name,
          p.is_free
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        JOIN packs p ON s.pack_id = p.id
        WHERE s.status = 'ACTIVE'
          AND s.current_period_end <= ?
      `;

      const expiredSubscriptions = await this.databaseService.query(query, [
        now,
      ]);

      console.log('[Expiry Check] Found subscriptions:', expiredSubscriptions.length);
      this.logger.log(`Found ${expiredSubscriptions.length} expired subscriptions`);

      // Update subscription status and send emails
      for (const subscription of expiredSubscriptions) {
        try {
          // Update subscription status to EXPIRED
          await this.databaseService.query(
            'UPDATE subscriptions SET status = ? WHERE id = ?',
            ['EXPIRED', subscription.id],
          );

          // Skip kick and email for FREE subscriptions - they never had VIP access
          if (subscription.is_free) {
            this.logger.log(
              `Free subscription ${subscription.id} marked as expired (no kick or email needed)`,
            );
            continue;
          }

          // Check if user has ANY other active PAID subscription before kicking from Telegram
          // This handles the upgrade scenario: if user upgraded, they still have an active subscription
          // IMPORTANT: Also check current_period_end > NOW() to ensure those subscriptions haven't also expired
          const otherActiveSubscriptions = await this.databaseService.query(
            `SELECT s.id FROM subscriptions s
             JOIN packs p ON s.pack_id = p.id
             WHERE s.user_id = ? 
               AND s.status = 'ACTIVE' 
               AND s.current_period_end > NOW()
               AND p.is_free = FALSE
               AND s.id != ?`,
            [subscription.user_id, subscription.id],
          );

          // Only kick from Telegram AND send expiry email if user has NO other active paid subscriptions
          // If they upgraded, they still have access - don't send confusing "expired" email
          if (otherActiveSubscriptions.length === 0) {
            // User has no other active subscriptions - they truly lost access
            try {
              const kicked = await this.telegramService.kickUserByUserId(subscription.user_id);
              if (kicked) {
                this.logger.log(`User ${subscription.user_id} kicked from VIP Telegram group (no active paid subscriptions)`);
              }
            } catch (telegramError) {
              this.logger.error(
                `Failed to kick user ${subscription.user_id} from Telegram:`,
                telegramError,
              );
              // Continue even if Telegram kick fails
            }

            // Send expiry notification email ONLY if user has no other active subscriptions
            const language = (subscription.preferred_language === 'el' ? 'el' : 'en') as 'en' | 'el';
            await this.emailService.sendSubscriptionEnded(
              subscription.email,
              subscription.username,
              subscription.pack_name,
              new Date(subscription.current_period_end),
              language,
            );

            this.logger.log(
              `Subscription ${subscription.id} marked as expired and email sent to ${subscription.email} (${language})`,
            );
          } else {
            // User upgraded - they have another active subscription
            // Don't send expiry email, don't kick from Telegram
            this.logger.log(
              `User ${subscription.user_id} still has ${otherActiveSubscriptions.length} active paid subscription(s), not kicking from Telegram and not sending expiry email (upgrade scenario)`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to process expired subscription ${subscription.id}:`,
            error,
          );
          // Continue with other subscriptions even if one fails
        }
      }

      this.logger.log('Expired subscriptions check completed');
    } catch (error) {
      this.logger.error('Failed to check expired subscriptions:', error);
    }
  }
}

