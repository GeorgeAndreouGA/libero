import { Controller, Post, Body, HttpCode, HttpStatus, Res, Req, UnauthorizedException, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth/refresh', // Restrict to refresh endpoint
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Headers('user-agent') userAgent: string,
  ) {
    // Extract client IP (supports proxy headers)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || (req.headers['x-real-ip'] as string) 
      || req.ip;

    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    if ('refresh_token' in result) {
      res.setCookie('refresh_token', (result as any).refresh_token, COOKIE_OPTIONS);
      // Remove refresh_token from body response
      const { refresh_token, ...rest } = result as any;
      return rest;
    }

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const refreshToken = req.cookies['refresh_token'];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refresh(refreshToken);

    // Rotate refresh token
    if (result.refresh_token) {
      res.setCookie('refresh_token', result.refresh_token, COOKIE_OPTIONS);
      // Return only access token
      return { access_token: result.access_token };
    }

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear cookies' })
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { message: 'Logged out successfully' };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid verification token' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Password reset email sent if email/username exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.emailOrUsername, forgotPasswordDto.captchaToken);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA code and complete login' })
  @ApiResponse({ status: 200, description: '2FA verified, login successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired verification code' })
  async verify2FA(
    @Body() body: { userId: string; code: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Headers('user-agent') userAgent: string,
  ) {
    // Extract client IP (supports proxy headers)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || (req.headers['x-real-ip'] as string) 
      || req.ip;

    const result = await this.authService.verify2FA(body.userId, body.code, ipAddress, userAgent);

    if ('refresh_token' in result) {
      res.setCookie('refresh_token', (result as any).refresh_token, COOKIE_OPTIONS);
      const { refresh_token, ...rest } = result as any;
      return rest;
    }

    return result;
  }

  @Post('resend-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend 2FA verification code' })
  @ApiResponse({ status: 200, description: 'Verification code resent' })
  async resend2FA(@Body() body: { userId: string }) {
    return this.authService.resend2FACode(body.userId);
  }

  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 200, description: 'Verification email resent if account exists' })
  async resendVerificationEmail(@Body() body: { email: string }) {
    return this.authService.resendVerificationEmail(body.email);
  }
}
