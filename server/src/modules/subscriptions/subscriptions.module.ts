import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionReminderService } from './subscription-reminder.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { DatabaseModule } from '../../common/database/database.module';
import { EmailModule } from '../../common/email/email.module';
import { TelegramModule } from '../../common/telegram/telegram.module';

@Module({
  imports: [DatabaseModule, EmailModule, TelegramModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionReminderService,
    SubscriptionExpiryService,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
