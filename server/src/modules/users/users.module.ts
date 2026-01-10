import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../../common/database/database.module';
import { TelegramModule } from '../../common/telegram/telegram.module';
import { StripeModule } from '../../common/stripe/stripe.module';

@Module({
  imports: [DatabaseModule, TelegramModule, StripeModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
