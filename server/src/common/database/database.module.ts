import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { BackupService } from './backup.service';

@Global()
@Module({
  providers: [DatabaseService, BackupService],
  exports: [DatabaseService, BackupService],
})
export class DatabaseModule {}
