import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EmailModule } from '../../common/email/email.module';
import { TelegramModule } from '../../common/telegram/telegram.module';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [SubscriptionsModule, EmailModule, TelegramModule, DatabaseModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
