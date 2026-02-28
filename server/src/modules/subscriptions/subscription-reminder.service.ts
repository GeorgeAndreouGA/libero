import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../common/database/database.service';
import { EmailService } from '../../common/email/email.service';

@Injectable()
export class SubscriptionReminderService {
  private readonly logger = new Logger(SubscriptionReminderService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Run daily at 9:00 AM to check for subscriptions expiring in 3 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendRenewalReminders() {
    this.logger.log('Running renewal reminder check...');

    try {
      // Get subscriptions that will expire in exactly 3 days
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(0, 0, 0, 0);

      const fourDaysFromNow = new Date(threeDaysFromNow);
      fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 1);

      const query = `
        SELECT 
          s.id,
          s.current_period_end,
          u.id as user_id,
          u.email,
          u.username,
          u.preferred_language,
          p.name as pack_name,
          p.price_monthly
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        JOIN packs p ON s.pack_id = p.id
        WHERE s.status = 'ACTIVE'
          AND s.current_period_end >= ?
          AND s.current_period_end < ?
      `;

      const subscriptions = await this.databaseService.query(query, [
        threeDaysFromNow,
        fourDaysFromNow,
      ]);

      this.logger.log(`Found ${subscriptions.length} subscriptions expiring in 3 days`);

      // Send reminder emails
      for (const subscription of subscriptions) {
        try {
          const language = (subscription.preferred_language === 'el' ? 'el' : 'en') as 'en' | 'el';
          await this.emailService.sendRenewalReminder(
            subscription.email,
            subscription.username,
            subscription.pack_name,
            subscription.price_monthly,
            new Date(subscription.current_period_end),
            language,
          );

          this.logger.log(
            `Renewal reminder sent to ${subscription.email} (${language}) for ${subscription.pack_name}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send renewal reminder to ${subscription.email}:`,
            error,
          );
          // Continue with other reminders even if one fails
        }
      }

      this.logger.log('Renewal reminder check completed');
    } catch (error) {
      this.logger.error('Failed to send renewal reminders:', error);
    }
  }
}

