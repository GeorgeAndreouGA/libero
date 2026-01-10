import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createCipheriv, createDecipheriv, randomInt } from 'crypto';
import { DatabaseService } from '../../common/database/database.service';
import { EmailService } from '../../common/email/email.service';
import { CaptchaService } from '../../common/captcha/captcha.service';
import { SecurityAuditService } from '../../common/security/security-audit.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { validateEmail } from '../../common/validators/email-validator';

interface User {
  id: string;
  email: string;
  username?: string;
  password_hash: string;
  full_name?: string;
  role: string;
  status: string;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  two_factor_enabled?: boolean;
  two_factor_code?: string;
  two_factor_expires?: Date;
  preferred_language?: string;
  token_version?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
    private readonly captchaService: CaptchaService,
    private readonly securityAuditService: SecurityAuditService,
  ) {
    // Get encryption key from config (must be 32 bytes for aes-256)
    const key = this.configService.get<string>('ENCRYPTION_KEY') || '';
    this.encryptionKey = Buffer.from(key.slice(0, 32).padEnd(32, '0'));
  }

  /**
   * Encrypt a string value
   */
  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a string value
   */
  private decrypt(encryptedText: string): string {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      if (!ivHex || !encrypted) return '';
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  }

  /**
   * Sign up a new user
   */
  async signup(signupDto: SignupDto) {
    const { email, username, password, fullName, dateOfBirth, language, captchaToken } = signupDto;

    // Verify CAPTCHA first
    await this.captchaService.verifyToken(captchaToken);

    // Validate age - must be 18 or older
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      throw new BadRequestException('You must be at least 18 years old to use this service');
    }

    // Validate email legitimacy (block temporary emails)
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new BadRequestException(emailValidation.message);
    }

    // Check if email already exists
    const existingEmail = await this.db.queryOne<User>(
      'SELECT id FROM users WHERE email = ?',
      [email],
    );

    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    const existingUsername = await this.db.queryOne<User>(
      'SELECT id FROM users WHERE username = ?',
      [username],
    );

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const saltRounds = parseInt(
      this.configService.get('BCRYPT_ROUNDS') || '12',
    );
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Generate email verification token (expires in 10 minutes - set via MySQL for timezone consistency)
    const email_verification_token = randomBytes(32).toString('hex');

    // Create user with 'pending' status (cannot login until verified)
    const userId = randomBytes(16).toString('hex');
    const preferredLanguage = language || 'en'; // Default to English if not provided
    await this.db.execute(
      `INSERT INTO users (
        id, email, username, password_hash, full_name, role, status, 
        email_verified, email_verification_token, email_verification_expires, 
        date_of_birth, age_verified, preferred_language, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?, ?, ?, NOW())`,
      [
        userId,
        email,
        username,
        password_hash,
        fullName,
        'user',
        'pending', // User starts as pending until email verified
        false,
        email_verification_token,
        dateOfBirth,
        true, // Age verified during signup (validated above)
        preferredLanguage,
      ],
    );

    // Send verification email in user's preferred language
    try {
      await this.emailService.sendVerificationEmail(
        email,
        email_verification_token,
        username,
        preferredLanguage,
      );
    } catch (error) {
      // Log error but don't fail signup - user account is created
      console.error('Failed to send verification email:', error);
      // In production, you might want to queue this for retry
    }

    return {
      message: 'Signup successful. Please check your email to verify your account within 10 minutes.',
      user: {
        id: userId,
        email,
        username,
        role: 'user',
      },
    };
  }

  /**
   * Login user with account lockout protection
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { emailOrUsername, password, captchaToken } = loginDto;

    // Check if IP/user is locked out due to too many failed attempts
    const lockoutStatus = await this.securityAuditService.isLockedOut(ipAddress || '', emailOrUsername);
    if (lockoutStatus.locked) {
      this.logger.warn(`Login attempt blocked due to lockout: ${emailOrUsername} from IP ${ipAddress}`);
      throw new UnauthorizedException(
        `Too many failed login attempts. Please try again in ${lockoutStatus.remainingMinutes} minutes.`
      );
    }

    // Verify CAPTCHA first - log failure as failed login attempt
    try {
      await this.captchaService.verifyToken(captchaToken);
    } catch (error) {
      // Log captcha failure as a failed login attempt (prevents bypass attempts)
      await this.securityAuditService.logSecurityEvent('LOGIN_FAILED', {
        emailOrUsername,
        ipAddress,
        userAgent,
        details: { reason: 'Captcha verification failed' },
      });
      throw error;
    }

    // Find user by email or username
    const user = await this.db.queryOne<User>(
      'SELECT id, email, username, password_hash, role, status, email_verified, two_factor_enabled, preferred_language, token_version FROM users WHERE email = ? OR username = ?',
      [emailOrUsername, emailOrUsername],
    );

    if (!user) {
      // Log failed attempt
      await this.securityAuditService.logSecurityEvent('LOGIN_FAILED', {
        emailOrUsername,
        ipAddress,
        userAgent,
        details: { reason: 'User not found' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password first (to avoid leaking account status)
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      // Log failed attempt
      await this.securityAuditService.logSecurityEvent('LOGIN_FAILED', {
        userId: user.id,
        emailOrUsername,
        ipAddress,
        userAgent,
        details: { reason: 'Invalid password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified (return generic error for security)
    if (!user.email_verified) {
      await this.securityAuditService.logSecurityEvent('LOGIN_FAILED', {
        userId: user.id,
        emailOrUsername,
        ipAddress,
        userAgent,
        details: { reason: 'Email not verified' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account status is active (return generic error for security)
    if (user.status === 'pending') {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      // Generate 6-digit code using cryptographically secure random
      const twoFactorCode = randomInt(100000, 1000000).toString();

      // Encrypt and save code to database
      // Use MySQL's NOW() + INTERVAL to avoid timezone issues
      const encryptedCode = this.encrypt(twoFactorCode);
      await this.db.execute(
        'UPDATE users SET two_factor_code = ?, two_factor_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
        [encryptedCode, user.id],
      );

      // Send 2FA code via email in user's preferred language
      const language = user.preferred_language || 'en';
      try {
        await this.emailService.send2FACode(user.email, twoFactorCode, user.username, language);
      } catch (error) {
        this.logger.error('Failed to send 2FA code:', error);
        throw new BadRequestException('Failed to send verification code. Please try again.');
      }

      return {
        requiresTwoFactor: true,
        userId: user.id,
        message: 'Verification code sent to your email',
      };
    }

    // Generate tokens with token_version for session revocation
    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version || 0,
    });

    // Update last login
    await this.db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [
      user.id,
    ]);

    // Log successful login
    await this.securityAuditService.logSecurityEvent('LOGIN_SUCCESS', {
      userId: user.id,
      emailOrUsername,
      ipAddress,
      userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        email_verified: user.email_verified,
        preferred_language: user.preferred_language || 'en',
      },
    };
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Verify user still exists and is active
      const user = await this.db.queryOne<User>(
        'SELECT id, email, role, status, token_version FROM users WHERE id = ?',
        [payload.sub],
      );

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token version matches (for session revocation)
      const currentTokenVersion = user.token_version || 0;
      const payloadTokenVersion = payload.tokenVersion || 0;
      if (payloadTokenVersion !== currentTokenVersion) {
        this.logger.warn(`Token version mismatch for user ${user.id}: expected ${currentTokenVersion}, got ${payloadTokenVersion}`);
        throw new UnauthorizedException('Session has been invalidated. Please login again.');
      }

      // Generate new tokens (Rotation)
      const tokens = await this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: currentTokenVersion,
      });

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    // Include expiry check in query to avoid timezone issues (same pattern as 2FA)
    const user = await this.db.queryOne<User & { is_expired: number }>(
      `SELECT id, email, username, email_verification_expires, status, preferred_language,
       CASE WHEN email_verification_expires IS NOT NULL AND email_verification_expires < NOW() THEN 1 ELSE 0 END as is_expired
       FROM users WHERE email_verification_token = ?`,
      [token],
    );

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if token has expired using MySQL's comparison
    if (user.is_expired === 1) {
      // Delete expired unverified account
      await this.db.execute('DELETE FROM users WHERE id = ?', [user.id]);
      throw new BadRequestException(
        'Verification link has expired (10 minutes limit). Your account has been removed. Please sign up again.',
      );
    }

    // Update user: verify email, activate account, clear verification token
    await this.db.execute(
      `UPDATE users 
       SET email_verified = true, 
           status = 'active',
           email_verification_token = NULL,
           email_verification_expires = NULL 
       WHERE id = ?`,
      [user.id],
    );

    // Note: Free packs are automatically accessible to all users via bets service
    // No subscription entry needed - the system checks is_free=TRUE on packs directly

    // Send welcome email (non-blocking) in user's preferred language
    const language = user.preferred_language || 'en';
    this.emailService
      .sendWelcomeEmail(user.email, user.username, language)
      .catch((error) => console.error('Failed to send welcome email:', error));

    return {
      message: 'Email verified successfully. You can now login.',
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  /**
   * Request password reset
   */
  async forgotPassword(emailOrUsername: string, captchaToken: string) {
    // Verify captcha token
    await this.captchaService.verifyToken(captchaToken);

    // Try to find user by email or username
    const user = await this.db.queryOne<User>(
      'SELECT id, email, username, preferred_language FROM users WHERE email = ? OR username = ?',
      [emailOrUsername, emailOrUsername],
    );

    // Don't reveal if user exists
    if (!user) {
      return {
        message: 'If the email or username exists, a password reset link has been sent',
      };
    }

    // Generate reset token (expires in 10 minutes - set via MySQL for timezone consistency)
    const password_reset_token = randomBytes(32).toString('hex');

    await this.db.execute(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
      [password_reset_token, user.id],
    );

    // Send password reset email in user's preferred language
    const language = user.preferred_language || 'en';
    try {
      await this.emailService.sendPasswordResetEmail(user.email, password_reset_token, user.username, language);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't reveal that email sending failed for security reasons
    }

    return {
      message: 'If the email or username exists, a password reset link has been sent',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string) {
    // Include expiry check in query to avoid timezone issues (same pattern as 2FA)
    const user = await this.db.queryOne<User & { is_expired: number }>(
      `SELECT id, password_reset_expires,
       CASE WHEN password_reset_expires IS NOT NULL AND password_reset_expires < NOW() THEN 1 ELSE 0 END as is_expired
       FROM users WHERE password_reset_token = ?`,
      [token],
    );

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token expired using MySQL's comparison
    if (user.is_expired === 1) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const saltRounds = parseInt(
      this.configService.get('BCRYPT_ROUNDS') || '12',
    );
    const password_hash = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    await this.db.execute(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [password_hash, user.id],
    );

    return {
      message: 'Password reset successful',
    };
  }

  /**
   * Generate access and refresh tokens with token_version for session invalidation
   */
  private async generateTokens(user: { id: string; email: string; role: string; tokenVersion?: number }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
      }),
    ]);

    return { access_token, refresh_token };
  }

  /**
   * Generate access token only with token_version
   */
  private async generateAccessToken(user: { id: string; email: string; role: string; tokenVersion?: number }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION'),
    });
  }

  /**
   * Verify 2FA code and complete login
   */
  async verify2FA(userId: string, code: string, ipAddress?: string, userAgent?: string) {
    // Include expiry check in query to avoid timezone issues
    const user = await this.db.queryOne<User & { is_expired: number }>(
      `SELECT id, email, username, role, status, two_factor_code, two_factor_expires, token_version, preferred_language,
       CASE WHEN two_factor_expires IS NOT NULL AND two_factor_expires < NOW() THEN 1 ELSE 0 END as is_expired
       FROM users WHERE id = ?`,
      [userId],
    );

    if (!user) {
      await this.securityAuditService.logSecurityEvent('2FA_FAILED', {
        userId,
        ipAddress,
        userAgent,
        details: { reason: 'User not found' },
      });
      throw new UnauthorizedException('Invalid verification request');
    }

    if (user.status !== 'active') {
      await this.securityAuditService.logSecurityEvent('2FA_FAILED', {
        userId,
        ipAddress,
        userAgent,
        details: { reason: 'Account not active' },
      });
      throw new UnauthorizedException('Account is not active');
    }

    // Check if code matches and is not expired
    const decryptedCode = user.two_factor_code ? this.decrypt(user.two_factor_code) : '';
    if (!decryptedCode || decryptedCode !== code) {
      await this.securityAuditService.logSecurityEvent('2FA_FAILED', {
        userId,
        ipAddress,
        userAgent,
        details: { reason: 'Invalid code' },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    // Check expiry using the is_expired flag calculated in MySQL
    if ((user as any).is_expired === 1) {
      await this.securityAuditService.logSecurityEvent('2FA_FAILED', {
        userId,
        ipAddress,
        userAgent,
        details: { reason: 'Code expired' },
      });
      throw new UnauthorizedException('Verification code has expired');
    }

    // Clear the 2FA code
    await this.db.execute(
      'UPDATE users SET two_factor_code = NULL, two_factor_expires = NULL, last_login = NOW() WHERE id = ?',
      [userId],
    );

    // Generate tokens with token_version
    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version || 0,
    });

    // Log successful 2FA
    await this.securityAuditService.logSecurityEvent('2FA_SUCCESS', {
      userId,
      ipAddress,
      userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        preferred_language: user.preferred_language || 'en',
      },
    };
  }

  /**
   * Resend 2FA code
   */
  async resend2FACode(userId: string) {
    const user = await this.db.queryOne<User>(
      'SELECT id, email, username, status, preferred_language FROM users WHERE id = ?',
      [userId],
    );

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid request');
    }

    // Generate new code using cryptographically secure random
    const twoFactorCode = randomInt(100000, 1000000).toString();

    // Encrypt and save code to database
    // Use MySQL's NOW() + INTERVAL to avoid timezone issues
    const encryptedCode = this.encrypt(twoFactorCode);
    await this.db.execute(
      'UPDATE users SET two_factor_code = ?, two_factor_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
      [encryptedCode, userId],
    );

    // Send 2FA code via email in user's preferred language
    const language = user.preferred_language || 'en';
    try {
      await this.emailService.send2FACode(user.email, twoFactorCode, user.username, language);
    } catch (error) {
      console.error('Failed to send 2FA code:', error);
      throw new BadRequestException('Failed to send verification code. Please try again.');
    }

    return {
      message: 'Verification code sent to your email',
    };
  }

  /**
   * Resend email verification link
   */
  async resendVerificationEmail(email: string) {
    const user = await this.db.queryOne<User>(
      'SELECT id, email, username, status, email_verified, preferred_language FROM users WHERE email = ?',
      [email],
    );

    // Don't reveal if user exists for security
    if (!user) {
      return {
        message: 'If the email exists and is not yet verified, a new verification link has been sent.',
      };
    }

    // If already verified, don't send again
    if (user.email_verified || user.status === 'active') {
      return {
        message: 'If the email exists and is not yet verified, a new verification link has been sent.',
      };
    }

    // Generate new verification token (expires in 10 minutes - set via MySQL for timezone consistency)
    const email_verification_token = randomBytes(32).toString('hex');

    await this.db.execute(
      'UPDATE users SET email_verification_token = ?, email_verification_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
      [email_verification_token, user.id],
    );

    // Send verification email in user's preferred language
    const language = user.preferred_language || 'en';
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        email_verification_token,
        user.username,
        language,
      );
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      // Don't reveal error for security
    }

    return {
      message: 'If the email exists and is not yet verified, a new verification link has been sent.',
    };
  }
}
