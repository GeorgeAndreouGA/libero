import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CaptchaService } from './captcha.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
