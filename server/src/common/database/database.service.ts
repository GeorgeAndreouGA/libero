import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';

/**
 * Transaction context passed to callback functions
 * Provides the same query methods but uses the transaction connection
 */
export interface TransactionContext {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader>;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: mysql.Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.pool = mysql.createPool({
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      user: this.configService.get('DB_USER'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+02:00', // EET timezone to match MySQL and container
      charset: 'utf8mb4', // Required for Greek and other Unicode characters
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  async execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
    const [result] = await this.pool.execute(sql, params);
    return result as mysql.ResultSetHeader;
  }

  /**
   * Execute multiple database operations within a transaction.
   * If any operation fails, all changes are rolled back.
   * 
   * @param callback - Function that receives a transaction context with query methods
   * @returns The result of the callback function
   * 
   * @example
   * ```typescript
   * const result = await this.db.withTransaction(async (tx) => {
   *   await tx.execute('UPDATE users SET status = ? WHERE id = ?', ['active', id]);
   *   await tx.execute('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [id, 'activated']);
   *   return { success: true };
   * });
   * ```
   */
  async withTransaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      this.logger.debug('Transaction started');

      // Create transaction context with bound connection
      const tx: TransactionContext = {
        query: async <R = any>(sql: string, params?: any[]): Promise<R[]> => {
          const [rows] = await connection.execute(sql, params);
          return rows as R[];
        },
        queryOne: async <R = any>(sql: string, params?: any[]): Promise<R | null> => {
          const [rows] = await connection.execute(sql, params);
          const rowArray = rows as R[];
          return rowArray[0] || null;
        },
        execute: async (sql: string, params?: any[]): Promise<mysql.ResultSetHeader> => {
          const [result] = await connection.execute(sql, params);
          return result as mysql.ResultSetHeader;
        },
      };

      const result = await callback(tx);

      await connection.commit();
      this.logger.debug('Transaction committed');

      return result;
    } catch (error) {
      await connection.rollback();
      this.logger.warn(`Transaction rolled back: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }
}
