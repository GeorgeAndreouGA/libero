import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, Matches, MaxLength, IsNotEmpty, IsIn, IsDateString } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address (only legitimate email providers allowed)',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Unique username (3-50 chars, letters, numbers, and underscores - supports Greek and other Unicode letters)',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[\p{L}\p{N}_]+$/u, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password (min 10 chars, must contain uppercase, lowercase, number, and special character)',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least 10 characters including uppercase, lowercase, number, and special character',
  })
  password: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @ApiProperty({
    example: '2000-01-15',
    description: 'User date of birth (YYYY-MM-DD format). Must be 18 years or older.',
  })
  @IsDateString({}, { message: 'Date of birth must be a valid date in YYYY-MM-DD format' })
  @IsNotEmpty({ message: 'Date of birth is required' })
  dateOfBirth: string;

  @ApiProperty({
    example: 'en',
    description: 'Preferred language for emails and notifications (en or el)',
    enum: ['en', 'el'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['en', 'el'], {
    message: 'Language must be either "en" (English) or "el" (Greek)',
  })
  language: string;

  @ApiProperty({
    example: 'eyJpZCI6IjE3MzU2...',
    description: 'Security verification token for bot protection',
  })
  @IsString()
  @IsNotEmpty({ message: 'Please complete the security check' })
  captchaToken: string;
}
