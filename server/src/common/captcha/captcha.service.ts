import { Injectable, Logger, BadRequestException } from '@nestjs/common';

interface CaptchaToken {
  id: string;
  answer: number;
  time: number;
  ts: number;
}

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly minSolveTime = 2000; // Minimum 2 seconds to solve
  private readonly maxTokenAge = 300000; // Token valid for 5 minutes
  private readonly usedTokens = new Set<string>(); // Prevent token reuse

  /**
   * Verify a custom captcha token
   * @param token - The captcha token from the client
   * @returns true if verification succeeds
   * @throws BadRequestException if verification fails
   */
  async verifyToken(token: string): Promise<boolean> {
    if (!token) {
      throw new BadRequestException('Security verification required');
    }

    // Allow development bypass ONLY in development mode
    if (token === 'development-bypass-token' && process.env.NODE_ENV === 'development') {
      this.logger.warn('Development bypass token used - ONLY allowed in development mode');
      return true;
    }

    try {
      // Decode the token
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as CaptchaToken;
      
      // Check if token was already used (prevent replay attacks)
      if (this.usedTokens.has(decoded.id)) {
        this.logger.warn(`Token already used: ${decoded.id}`);
        throw new BadRequestException('Security verification expired. Please try again.');
      }

      // Check token age
      const tokenAge = Date.now() - decoded.ts;
      if (tokenAge > this.maxTokenAge) {
        this.logger.warn(`Token expired: age ${tokenAge}ms`);
        throw new BadRequestException('Security verification expired. Please refresh and try again.');
      }

      // Check solve time (too fast = bot)
      if (decoded.time < this.minSolveTime) {
        this.logger.warn(`Solve time too fast: ${decoded.time}ms`);
        throw new BadRequestException('Security verification failed. Please try again.');
      }

      // Mark token as used
      this.usedTokens.add(decoded.id);
      
      // Clean up old tokens periodically (keep memory usage low)
      if (this.usedTokens.size > 10000) {
        this.usedTokens.clear();
      }

      this.logger.debug(`Captcha verification successful (solve time: ${decoded.time}ms)`);
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Captcha verification error:', error);
      throw new BadRequestException('Security verification failed. Please try again.');
    }
  }
}
