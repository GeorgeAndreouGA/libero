import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 5; // 5 backups per batch
const TIME_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly commitBackupDir: string;
  private readonly timeBackupDir: string;
  
  // Counters for batch management
  private commitCounter = 0;
  private timeCounter = 0;
  
  // Locks to prevent concurrent backups
  private isCommitBackupInProgress = false;
  private isTimeBackupInProgress = false;
  
  // Timer for time-based backups
  private timeBackupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.backupDir = process.env.BACKUP_DIR || '/app/backups';
    this.commitBackupDir = path.join(this.backupDir, 'commit');
    this.timeBackupDir = path.join(this.backupDir, 'time');
  }

  async onModuleInit() {
    await this.ensureBackupDirs();
    await this.initializeCounters();
    this.startTimeBasedBackup();
    this.logger.log(`Backup service initialized.`);
    this.logger.log(`  Commit backups: ${this.commitBackupDir} (counter: ${this.commitCounter})`);
    this.logger.log(`  Time backups: ${this.timeBackupDir} (counter: ${this.timeCounter})`);
  }

  async onModuleDestroy() {
    if (this.timeBackupInterval) {
      clearInterval(this.timeBackupInterval);
      this.timeBackupInterval = null;
    }
  }

  private async ensureBackupDirs(): Promise<void> {
    try {
      await fs.promises.mkdir(this.commitBackupDir, { recursive: true });
      await fs.promises.mkdir(this.timeBackupDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create backup directories: ${error.message}`);
    }
  }

  /**
   * Initialize counters by reading existing backup files
   */
  private async initializeCounters(): Promise<void> {
    try {
      // Count existing commit backups
      const commitFiles = await this.getBackupFiles(this.commitBackupDir, 'commit_backup_');
      if (commitFiles.length > 0) {
        const maxNum = Math.max(...commitFiles.map(f => this.extractBackupNumber(f, 'commit_backup_')));
        this.commitCounter = maxNum;
      }

      // Count existing time backups
      const timeFiles = await this.getBackupFiles(this.timeBackupDir, 'time_backup_');
      if (timeFiles.length > 0) {
        const maxNum = Math.max(...timeFiles.map(f => this.extractBackupNumber(f, 'time_backup_')));
        this.timeCounter = maxNum;
      }
    } catch (error) {
      this.logger.error(`Failed to initialize counters: ${error.message}`);
    }
  }

  private extractBackupNumber(filename: string, prefix: string): number {
    const match = filename.match(new RegExp(`${prefix}(\\d+)\\.sql`));
    return match ? parseInt(match[1], 10) : 0;
  }

  private async getBackupFiles(dir: string, prefix: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(dir);
      return files.filter(f => f.startsWith(prefix) && f.endsWith('.sql'));
    } catch {
      return [];
    }
  }

  /**
   * Start the time-based backup interval (every 5 minutes)
   */
  private startTimeBasedBackup(): void {
    this.timeBackupInterval = setInterval(async () => {
      await this.createTimeBasedBackup();
    }, TIME_INTERVAL_MS);
    
    this.logger.log(`Time-based backup started (every ${TIME_INTERVAL_MS / 60000} minutes)`);
  }

  /**
   * Create a commit-based backup (called after each write operation)
   */
  async createCommitBackup(): Promise<boolean> {
    if (this.isCommitBackupInProgress) {
      this.logger.debug('Commit backup already in progress, skipping...');
      return false;
    }

    this.isCommitBackupInProgress = true;

    try {
      this.commitCounter++;
      const backupPath = path.join(this.commitBackupDir, `commit_backup_${this.commitCounter}.sql`);
      
      const success = await this.performBackup(backupPath);
      
      if (success) {
        this.logger.log(`Commit backup #${this.commitCounter} created successfully`);
        await this.cleanupOldBatch(this.commitBackupDir, 'commit_backup_', this.commitCounter);
        return true;
      } else {
        // Rollback counter on failure
        this.commitCounter--;
        return false;
      }
    } finally {
      this.isCommitBackupInProgress = false;
    }
  }

  /**
   * Create a time-based backup (called every 5 minutes)
   */
  async createTimeBasedBackup(): Promise<boolean> {
    if (this.isTimeBackupInProgress) {
      this.logger.debug('Time backup already in progress, skipping...');
      return false;
    }

    this.isTimeBackupInProgress = true;

    try {
      this.timeCounter++;
      const backupPath = path.join(this.timeBackupDir, `time_backup_${this.timeCounter}.sql`);
      
      const success = await this.performBackup(backupPath);
      
      if (success) {
        this.logger.log(`Time backup #${this.timeCounter} created successfully`);
        await this.cleanupOldBatch(this.timeBackupDir, 'time_backup_', this.timeCounter);
        return true;
      } else {
        // Rollback counter on failure
        this.timeCounter--;
        return false;
      }
    } finally {
      this.isTimeBackupInProgress = false;
    }
  }

  /**
   * Create a MySQL connection for backup operations
   */
  private async createConnection(): Promise<mysql.Connection> {
    return mysql.createConnection({
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT') || 3306,
      user: this.configService.get('DB_USER'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      timezone: '+02:00',
      charset: 'utf8mb4',  // Required for Greek characters
    });
  }

  /**
   * Perform the actual backup using mysql2 (no external mysqldump needed)
   */
  private async performBackup(backupPath: string): Promise<boolean> {
    const tempPath = backupPath + '.tmp';
    let connection: mysql.Connection | null = null;

    try {
      connection = await this.createConnection();
      const database = this.configService.get('DB_NAME');
      
      // Explicitly set UTF-8 charset for Greek characters (belt and suspenders)
      await connection.query('SET NAMES utf8mb4');
      await connection.query('SET CHARACTER SET utf8mb4');
      await connection.query('SET character_set_connection = utf8mb4');
      
      // Start building the SQL dump
      let sql = '';
      sql += `-- MySQL Backup\n`;
      sql += `-- Generated: ${new Date().toISOString()}\n`;
      sql += `-- Database: ${database}\n\n`;
      
      // UTF-8 encoding for Greek/Unicode characters
      sql += `SET NAMES utf8mb4;\n`;
      sql += `SET CHARACTER SET utf8mb4;\n`;
      sql += `SET character_set_connection=utf8mb4;\n\n`;
      
      sql += `SET FOREIGN_KEY_CHECKS=0;\n`;
      sql += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
      sql += `SET AUTOCOMMIT = 0;\n`;
      sql += `START TRANSACTION;\n\n`;

      // Get all tables
      const [tables] = await connection.query<mysql.RowDataPacket[]>('SHOW TABLES');
      const tableKey = `Tables_in_${database}`;

      for (const tableRow of tables) {
        const tableName = tableRow[tableKey];
        
        // Get CREATE TABLE statement
        const [createResult] = await connection.query<mysql.RowDataPacket[]>(
          `SHOW CREATE TABLE \`${tableName}\``
        );
        const createStatement = createResult[0]['Create Table'];
        
        sql += `-- Table: ${tableName}\n`;
        sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        sql += `${createStatement};\n\n`;

        // Get table data
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT * FROM \`${tableName}\``
        );

        if (rows.length > 0) {
          const columns = Object.keys(rows[0]);
          const columnNames = columns.map(c => `\`${c}\``).join(', ');
          
          sql += `-- Data for table: ${tableName}\n`;
          
          for (const row of rows) {
            const values = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'number') return value.toString();
              if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
              if (typeof value === 'boolean') return value ? '1' : '0';
              if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
              // Handle JSON objects - serialize to JSON string
              if (typeof value === 'object') {
                const jsonStr = JSON.stringify(value)
                  .replace(/\\/g, '\\\\')
                  .replace(/'/g, "\\'");
                return `'${jsonStr}'`;
              }
              // Escape special characters for strings
              const escaped = String(value)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              return `'${escaped}'`;
            }).join(', ');
            
            sql += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${values});\n`;
          }
          sql += '\n';
        }
      }

      sql += `SET FOREIGN_KEY_CHECKS=1;\n`;
      sql += `COMMIT;\n`;

      // Write to temp file
      await fs.promises.writeFile(tempPath, sql, 'utf8');

      // Verify the backup is valid
      const stats = await fs.promises.stat(tempPath);
      if (stats.size === 0) {
        this.logger.error('Backup failed: temp file is empty');
        await this.safeUnlink(tempPath);
        return false;
      }

      // Atomic rename
      await fs.promises.rename(tempPath, backupPath);
      
      const sizeKB = (stats.size / 1024).toFixed(2);
      this.logger.debug(`Backup size: ${sizeKB} KB`);
      
      return true;

    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`);
      await this.safeUnlink(tempPath);
      return false;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Cleanup old batch when a new batch is complete
   * E.g., when backup #10 is created, delete backups #1-5
   */
  private async cleanupOldBatch(dir: string, prefix: string, currentCounter: number): Promise<void> {
    // Check if we've completed a second batch (counter = 10, 15, 20, etc.)
    if (currentCounter >= BATCH_SIZE * 2 && currentCounter % BATCH_SIZE === 0) {
      const oldBatchStart = currentCounter - (BATCH_SIZE * 2) + 1;
      const oldBatchEnd = currentCounter - BATCH_SIZE;

      this.logger.log(`Cleaning up old batch: ${prefix}${oldBatchStart} to ${prefix}${oldBatchEnd}`);

      for (let i = oldBatchStart; i <= oldBatchEnd; i++) {
        const filePath = path.join(dir, `${prefix}${i}.sql`);
        await this.safeUnlink(filePath);
      }
    }
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Get information about all backups
   */
  async getBackupInfo(): Promise<{
    commit: { count: number; files: string[]; totalSizeKB: number };
    time: { count: number; files: string[]; totalSizeKB: number };
  }> {
    const commitFiles = await this.getBackupFiles(this.commitBackupDir, 'commit_backup_');
    const timeFiles = await this.getBackupFiles(this.timeBackupDir, 'time_backup_');

    const getSize = async (dir: string, files: string[]): Promise<number> => {
      let total = 0;
      for (const f of files) {
        try {
          const stats = await fs.promises.stat(path.join(dir, f));
          total += stats.size;
        } catch {}
      }
      return total / 1024;
    };

    return {
      commit: {
        count: commitFiles.length,
        files: commitFiles.sort(),
        totalSizeKB: await getSize(this.commitBackupDir, commitFiles),
      },
      time: {
        count: timeFiles.length,
        files: timeFiles.sort(),
        totalSizeKB: await getSize(this.timeBackupDir, timeFiles),
      },
    };
  }

  /**
   * Restore database from the latest backup (prefers commit over time)
   */
  async restoreLatest(): Promise<boolean> {
    // Try commit backups first (more recent)
    const commitFiles = await this.getBackupFiles(this.commitBackupDir, 'commit_backup_');
    if (commitFiles.length > 0) {
      const latestNum = Math.max(...commitFiles.map(f => this.extractBackupNumber(f, 'commit_backup_')));
      const latestPath = path.join(this.commitBackupDir, `commit_backup_${latestNum}.sql`);
      return this.restoreFromFile(latestPath);
    }

    // Fall back to time backups
    const timeFiles = await this.getBackupFiles(this.timeBackupDir, 'time_backup_');
    if (timeFiles.length > 0) {
      const latestNum = Math.max(...timeFiles.map(f => this.extractBackupNumber(f, 'time_backup_')));
      const latestPath = path.join(this.timeBackupDir, `time_backup_${latestNum}.sql`);
      return this.restoreFromFile(latestPath);
    }

    this.logger.error('No backup found to restore');
    return false;
  }

  /**
   * Restore database from a specific backup file
   */
  async restoreFromFile(backupPath: string): Promise<boolean> {
    let connection: mysql.Connection | null = null;

    try {
      await fs.promises.access(backupPath);
      
      const sql = await fs.promises.readFile(backupPath, 'utf8');
      
      connection = await this.createConnection();
      
      // Explicitly set UTF-8 charset for Greek characters (belt and suspenders)
      await connection.query('SET NAMES utf8mb4');
      await connection.query('SET CHARACTER SET utf8mb4');
      await connection.query('SET character_set_connection = utf8mb4');
      
      // Split SQL into statements and execute each
      const statements = sql
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement) {
          await connection.query(statement);
        }
      }

      this.logger.log(`Database restored from: ${backupPath}`);
      return true;

    } catch (error) {
      this.logger.error(`Restore failed: ${error.message}`);
      return false;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  // Getters for testing
  getCommitCounter(): number {
    return this.commitCounter;
  }

  getTimeCounter(): number {
    return this.timeCounter;
  }
}
