import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'abc123resettoken',
    description: 'Password reset token from email',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'NewSecurePass123!',
    description: 'New password (min 10 chars, must contain uppercase, lowercase, number, and special character)',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least 10 characters including uppercase, lowercase, number, and special character',
  })
  password: string;
}
