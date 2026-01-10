import { Module, Global } from '@nestjs/common';
import { SecurityAuditService } from './security-audit.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [SecurityAuditService],
  exports: [SecurityAuditService],
})
export class SecurityModule {}
