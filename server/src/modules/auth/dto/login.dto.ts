import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com or username',
    description: 'User email address or username',
  })
  @IsString()
  @IsNotEmpty()
  emailOrUsername: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'eyJpZCI6IjE3MzU2...',
    description: 'Security verification token for bot protection',
  })
  @IsString()
  @IsNotEmpty({ message: 'Please complete the security check' })
  captchaToken: string;
}
