import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../../common/database/database.module';
import { EmailModule } from '../../common/email/email.module';
import { TelegramModule } from '../../common/telegram/telegram.module';

@Module({
  imports: [DatabaseModule, EmailModule, TelegramModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
