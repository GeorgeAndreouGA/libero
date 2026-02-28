import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com or username',
    description: 'Email address or username to send password reset link',
  })
  @IsString()
  @IsNotEmpty()
  emailOrUsername: string;

  @ApiProperty({
    example: 'captcha-token',
    description: 'Turnstile CAPTCHA token for verification',
  })
  @IsString()
  @IsNotEmpty()
  captchaToken: string;
}
