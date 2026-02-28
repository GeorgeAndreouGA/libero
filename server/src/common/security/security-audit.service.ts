import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomBytes } from 'crypto';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | '2FA_SUCCESS'
  | '2FA_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'ADMIN_ACTION';

export interface SecurityEventDetails {
  reason?: string;
  attemptCount?: number;
  lockDuration?: number;
  action?: string;
  targetUserId?: string;
  [key: string]: any;
}

@Injectable()
export class SecurityAuditService implements OnModuleInit {
  private readonly logger = new Logger(SecurityAuditService.name);

  // Lockout configuration
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;
  private readonly FAILED_ATTEMPT_WINDOW_MINUTES = 15;

  // Log retention configuration (in days)
  private readonly LOG_RETENTION_DAYS = 90; // Keep logs for 90 days
  private readonly CLEANUP_INTERVAL_HOURS = 24; // Run cleanup daily

  constructor(private readonly db: DatabaseService) {}

  /**
   * Start periodic cleanup job on module initialization
   */
  onModuleInit() {
    // Run cleanup on startup (after a short delay to let DB connect)
    setTimeout(() => this.cleanupOldLogs(), 30000);
    
    // Schedule periodic cleanup
    setInterval(
      () => this.cleanupOldLogs(),
      this.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000
    );
  }

  /**
   * Delete security events older than retention period
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - this.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const cutoffDateStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');
      
      const result = await this.db.execute(
        'DELETE FROM security_events WHERE created_at < ?',
        [cutoffDateStr]
      );

      const deletedCount = result.affectedRows || 0;
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} security events older than ${this.LOG_RETENTION_DAYS} days`);
      }
      
      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to cleanup old security logs: ${error.message}`);
      return 0;
    }
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    eventType: SecurityEventType,
    options: {
      userId?: string;
      emailOrUsername?: string;
      ipAddress?: string;
      userAgent?: string;
      details?: SecurityEventDetails;
    },
  ): Promise<void> {
    try {
      const id = randomBytes(16).toString('hex');
      await this.db.execute(
        `INSERT INTO security_events (id, event_type, user_id, email_or_username, ip_address, user_agent, details) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          eventType,
          options.userId || null,
          options.emailOrUsername || null,
          options.ipAddress || null,
          options.userAgent || null,
          options.details ? JSON.stringify(options.details) : null,
        ],
      );

      this.logger.log(
        `Security event: ${eventType} - User: ${options.userId || options.emailOrUsername || 'unknown'} - IP: ${options.ipAddress || 'unknown'}`,
      );
    } catch (error) {
      // Don't fail the request if logging fails
      this.logger.error(`Failed to log security event: ${error.message}`);
    }
  }

  /**
   * Check if an IP address or user account is locked out due to too many failed attempts
   */
  async isLockedOut(ipAddress: string, emailOrUsername?: string): Promise<{ locked: boolean; remainingMinutes?: number }> {
    try {
      // Check for failed attempts from this IP in the last window
      const windowStart = new Date(Date.now() - this.FAILED_ATTEMPT_WINDOW_MINUTES * 60 * 1000);
      // Format as MySQL datetime string to avoid timezone issues
      const windowStartStr = windowStart.toISOString().slice(0, 19).replace('T', ' ');
      
      // Check IP-based lockout
      const ipFailures = await this.db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM security_events 
         WHERE ip_address = ? 
         AND event_type = 'LOGIN_FAILED' 
         AND created_at > ?`,
        [ipAddress, windowStartStr],
      );

      const ipFailureCount = ipFailures ? Number(ipFailures.count) : 0;

      if (ipFailureCount >= this.MAX_FAILED_ATTEMPTS) {
        // Check if the 5th failed attempt is within the lockout duration
        // Using MySQL's TIMESTAMPDIFF to avoid timezone issues
        const lockoutCheck = await this.db.queryOne<{ is_locked: number; remaining_seconds: number }>(
          `SELECT 
             CASE WHEN TIMESTAMPDIFF(MINUTE, se.created_at, NOW()) < ? THEN 1 ELSE 0 END as is_locked,
             GREATEST(0, ? - TIMESTAMPDIFF(SECOND, se.created_at, NOW())) as remaining_seconds
           FROM (
             SELECT created_at FROM security_events 
             WHERE ip_address = ? 
             AND event_type = 'LOGIN_FAILED' 
             AND created_at > ?
             ORDER BY created_at ASC
             LIMIT ${this.MAX_FAILED_ATTEMPTS - 1}, 1
           ) as se`,
          [this.LOCKOUT_DURATION_MINUTES, this.LOCKOUT_DURATION_MINUTES * 60, ipAddress, windowStartStr],
        );

        if (lockoutCheck && lockoutCheck.is_locked === 1) {
          const remainingMinutes = Math.ceil(lockoutCheck.remaining_seconds / 60);
          this.logger.warn(`IP ${ipAddress} is locked out for ${remainingMinutes} more minutes`);
          return { locked: true, remainingMinutes };
        }
      }

      // Check user-based lockout if username/email provided
      if (emailOrUsername) {
        const userFailures = await this.db.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM security_events 
           WHERE email_or_username = ? 
           AND event_type = 'LOGIN_FAILED' 
           AND created_at > ?`,
          [emailOrUsername, windowStartStr],
        );

        const userFailureCount = userFailures ? Number(userFailures.count) : 0;

        if (userFailureCount >= this.MAX_FAILED_ATTEMPTS) {
          // Check if the 5th failed attempt is within the lockout duration using MySQL's time functions
          const lockoutCheck = await this.db.queryOne<{ is_locked: number; remaining_seconds: number }>(
            `SELECT 
               CASE WHEN TIMESTAMPDIFF(MINUTE, se.created_at, NOW()) < ? THEN 1 ELSE 0 END as is_locked,
               GREATEST(0, ? - TIMESTAMPDIFF(SECOND, se.created_at, NOW())) as remaining_seconds
             FROM (
               SELECT created_at FROM security_events 
               WHERE email_or_username = ? 
               AND event_type = 'LOGIN_FAILED' 
               AND created_at > ?
               ORDER BY created_at ASC
               LIMIT ${this.MAX_FAILED_ATTEMPTS - 1}, 1
             ) as se`,
            [this.LOCKOUT_DURATION_MINUTES, this.LOCKOUT_DURATION_MINUTES * 60, emailOrUsername, windowStartStr],
          );

          if (lockoutCheck && lockoutCheck.is_locked === 1) {
            const remainingMinutes = Math.ceil(lockoutCheck.remaining_seconds / 60);
            this.logger.warn(`User ${emailOrUsername} is locked out for ${remainingMinutes} more minutes`);
            return { locked: true, remainingMinutes };
          }
        }
      }

      return { locked: false };
    } catch (error) {
      this.logger.error(`Failed to check lockout status: ${error.message}`);
      // Don't lock out on error - fail open
      return { locked: false };
    }
  }

  /**
   * Get the number of failed attempts for an IP/user
   */
  async getFailedAttemptCount(ipAddress: string, emailOrUsername?: string): Promise<number> {
    try {
      const windowStart = new Date(Date.now() - this.FAILED_ATTEMPT_WINDOW_MINUTES * 60 * 1000);
      const windowStartStr = windowStart.toISOString().slice(0, 19).replace('T', ' ');
      
      const result = await this.db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM security_events 
         WHERE (ip_address = ? OR email_or_username = ?)
         AND event_type = 'LOGIN_FAILED' 
         AND created_at > ?`,
        [ipAddress, emailOrUsername || '', windowStartStr],
      );

      return result ? Number(result.count) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Clear failed attempts after successful login
   */
  async clearFailedAttempts(ipAddress: string, emailOrUsername: string): Promise<void> {
    // We don't actually delete the records (for audit purposes)
    // The lockout check uses time windows, so old failures naturally expire
    this.logger.debug(`Successful login clears lockout for IP: ${ipAddress}, user: ${emailOrUsername}`);
  }

  /**
   * Log an admin action for audit trail
   */
  async logAdminAction(
    adminUserId: string,
    action: string,
    targetUserId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent('ADMIN_ACTION', {
      userId: adminUserId,
      ipAddress,
      userAgent,
      details: {
        action,
        targetUserId,
        ...details,
      },
    });
  }

  /**
   * Get recent security events for a user (for admin review)
   */
  async getRecentSecurityEvents(userId: string, limit: number = 50): Promise<any[]> {
    const events = await this.db.query(
      `SELECT id, event_type, ip_address, user_agent, details, created_at 
       FROM security_events 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit],
    );

    return events.map((event: any) => ({
      ...event,
      details: event.details ? JSON.parse(event.details) : null,
    }));
  }
}
