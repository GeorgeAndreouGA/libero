import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'abc123emailtoken',
    description: 'Email verification token from email',
  })
  @IsString()
  token: string;
}
