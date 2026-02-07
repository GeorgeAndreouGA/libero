import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { StripeService } from '../../common/stripe/stripe.service';
import { EmailService } from '../../common/email/email.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly stripeService: StripeService,
    private readonly emailService: EmailService,
    private readonly telegramService: TelegramService,
  ) {}

  async getStats() {
    // Get active users count (only users with truly active subscriptions)
    const activeUsersResult = await this.db.queryOne(
      'SELECT COUNT(DISTINCT user_id) as count FROM subscriptions WHERE status = "ACTIVE" AND current_period_end > NOW()'
    );
    const activeUsers = activeUsersResult?.count || 0;

    // Get monthly revenue
    const revenueResult = await this.db.queryOne(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE status = "COMPLETED" 
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const monthlyRevenue = revenueResult?.total || 0;

    // Get active subscriptions count (only truly active, not expired)
    const activeSubsResult = await this.db.queryOne(
      'SELECT COUNT(*) as count FROM subscriptions WHERE status = "ACTIVE" AND current_period_end > NOW()'
    );
    const activeSubscriptions = activeSubsResult?.count || 0;

    // Get published bets count
    const betsResult = await this.db.queryOne(
      'SELECT COUNT(*) as count FROM bets WHERE status = "PUBLISHED"'
    );
    const betsPublished = betsResult?.count || 0;

    // Get recent transactions with pack info
    const recentTransactions = await this.db.query(
      `SELECT t.id, u.email as user, t.amount, t.created_at as date,
              GROUP_CONCAT(p.name) as packs
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN subscriptions s ON t.subscription_id = s.id
       LEFT JOIN packs p ON s.pack_id = p.id
       WHERE t.status = "COMPLETED"
       GROUP BY t.id, u.email, t.amount, t.created_at
       ORDER BY t.created_at DESC
       LIMIT 5`
    );

    return {
      activeUsers,
      monthlyRevenue,
      activeSubscriptions,
      betsPublished,
      recentSubscriptions: recentTransactions.map((trans: any) => ({
        user: trans.user,
        amount: trans.amount,
        packs: trans.packs ? trans.packs.split(',') : [],
        date: this.getRelativeTime(trans.date),
      })),
    };
  }

  async getRevenueOverview() {
    // Get revenue for the last 6 months
    const monthlyRevenue = await this.db.query(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(amount) as total,
        COUNT(*) as transactions
       FROM transactions 
       WHERE status = "COMPLETED" 
       AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`
    );

    // Get total revenue all time
    const totalRevenueResult = await this.db.queryOne(
      `SELECT SUM(amount) as total FROM transactions WHERE status = "COMPLETED"`
    );
    const totalRevenue = totalRevenueResult?.total || 0;

    // Get this month's revenue
    const thisMonthResult = await this.db.queryOne(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE status = "COMPLETED" 
       AND MONTH(created_at) = MONTH(NOW())
       AND YEAR(created_at) = YEAR(NOW())`
    );
    const thisMonthRevenue = thisMonthResult?.total || 0;

    // Get last month's revenue for comparison
    const lastMonthResult = await this.db.queryOne(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE status = "COMPLETED" 
       AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
       AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))`
    );
    const lastMonthRevenue = lastMonthResult?.total || 0;

    // Calculate growth percentage
    const growth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : thisMonthRevenue > 0 ? 100 : 0;

    return {
      monthlyData: monthlyRevenue.map((row: any) => ({
        month: row.month,
        total: parseFloat(row.total) || 0,
        transactions: row.transactions,
      })),
      totalRevenue: parseFloat(totalRevenue) || 0,
      thisMonthRevenue: parseFloat(thisMonthRevenue) || 0,
      lastMonthRevenue: parseFloat(lastMonthRevenue) || 0,
      growth: Math.round(growth * 10) / 10,
    };
  }

  async getBets(page: number = 1, limit: number = 50, categoryId?: string, result?: string) {
    const offset = (page - 1) * limit;
    const safeLimit = Math.min(Math.max(limit, 1), 200); // Clamp between 1 and 200

    // Build dynamic WHERE clause for filters
    let whereClause = '';
    const params: any[] = [];

    if (categoryId) {
      whereClause += ' WHERE b.category_id = ?';
      params.push(categoryId);
    }

    if (result && result !== 'ALL') {
      whereClause += whereClause ? ' AND' : ' WHERE';
      if (result === 'FINISHED') {
        whereClause += ' b.result IN ("WIN", "LOST", "CASH_OUT")';
      } else if (['WIN', 'LOST', 'IN_PROGRESS', 'CASH_OUT'].includes(result)) {
        whereClause += ' b.result = ?';
        params.push(result);
      }
    }

    // Note: LIMIT and OFFSET are interpolated directly as integers (safe since they're validated numbers)
    const bets = await this.db.query(
      `SELECT b.id, b.image_url as imageUrl,
              b.match_info as \`match\`, b.odds, b.status, b.result,
              c.name as categoryName, b.category_id as categoryId, 
              c.standard_bet as standardBet,
              b.published_at as publishedAt, b.created_at as createdAt
       FROM bets b
       LEFT JOIN categories c ON b.category_id = c.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`,
      params
    );

    // Get total count for pagination (with same filters)
    const countResult = await this.db.queryOne(
      `SELECT COUNT(*) as total FROM bets b${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    return {
      data: bets.map((bet: any) => ({
        ...bet,
        match: this.parseJsonField(bet.match),
        standardBet: parseFloat(bet.standardBet) || 0,
        publishedAt: bet.publishedAt ? this.formatDate(bet.publishedAt) : null,
        createdAt: this.formatDate(bet.createdAt),
      })),
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      }
    };
  }

  private parseJsonField(value: any): any {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  async createBet(data: any) {
    // Validate required fields
    if (!data.categoryId) {
      throw new BadRequestException('Category is required');
    }
    if (!data.odds) {
      throw new BadRequestException('Odds are required');
    }

    const id = uuidv4();
    // Validate result status
    const validResults = ['IN_PROGRESS', 'WIN', 'LOST', 'CASH_OUT'];
    const result = validResults.includes(data.result) ? data.result : 'IN_PROGRESS';
    
    // Bets are immediately published when created
    await this.db.query(
      `INSERT INTO bets (id, category_id, image_url, match_info, odds, analysis, result, status, published_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', NOW(), ?)`,
      [
        id,
        data.categoryId,
        data.imageUrl || null,
        JSON.stringify(data.match || {}),
        data.odds,
        data.analysis || null,
        result,
        data.createdBy,
      ]
    );

    // Send Telegram notification for the new bet
    try {
      await this.sendBetTelegramNotification(data.categoryId, {
        odds: data.odds,
        match: data.match,
        analysis: data.analysis,
      });
    } catch (telegramError) {
      this.logger.error('Failed to send Telegram notification for bet:', telegramError);
      // Don't fail bet creation if Telegram notification fails
    }

    return { id, message: 'Bet created and published successfully' };
  }

  /**
   * Send bet notification to appropriate Telegram channels based on category pack membership
   * 
   * Rules:
   * - Free pack categories → Public/Free channels (both EN + EL)
   * - VIP pack categories → VIP channels (both EN + EL)
   * - Categories in both free and VIP packs → Both channels
   * - Future categories route automatically based on which pack(s) they're assigned to
   */
  private async sendBetTelegramNotification(categoryId: string, bet: {
    odds?: string;
    match?: any;
    analysis?: string;
  }) {
    // Get category details
    const category = await this.db.queryOne(
      'SELECT id, name, name_el as nameEl, standard_bet as standardBet, telegram_notifications as telegramNotifications FROM categories WHERE id = ?',
      [categoryId]
    );

    if (!category) {
      this.logger.warn(`Category ${categoryId} not found for Telegram notification`);
      return;
    }

    // Check if Telegram notifications are enabled for this category
    if (!category.telegramNotifications) {
      this.logger.log(`Telegram notifications disabled for category "${category.name}", skipping`);
      return;
    }

    // Get ONLY packs that have DIRECT access to this category (not inherited)
    // This ensures we show the correct pack diamonds
    const packsWithDirectAccess = await this.db.query(
      `SELECT DISTINCT p.id, p.name, p.is_free as isFree, p.display_order as displayOrder
       FROM packs p
       JOIN pack_categories pc ON p.id = pc.pack_id
       WHERE pc.category_id = ? AND p.is_active = TRUE
       ORDER BY p.display_order ASC`,
      [categoryId]
    );

    // Check if any pack with direct access is free or VIP
    const allPacks = packsWithDirectAccess.map((pack: any) => ({
      id: pack.id,
      name: pack.name,
      isFree: !!pack.isFree,
      displayOrder: pack.displayOrder,
    }));

    if (allPacks.length === 0) {
      this.logger.warn(`Category "${category.name}" has no active packs assigned, skipping Telegram notification`);
      return;
    }

    const isFreeCategory = allPacks.some(p => p.isFree);
    const isVipCategory = allPacks.some(p => !p.isFree);

    // Route based on pack membership:
    // - Free pack categories → Public channels
    // - VIP pack categories → VIP channels
    // - Both → Both channels
    const sendToVip = isVipCategory;
    const sendToPublic = isFreeCategory;

    const result = await this.telegramService.sendBetNotification(
      bet,
      { name: category.name, nameEl: category.nameEl, standardBet: category.standardBet },
      allPacks,
      sendToVip,
      sendToPublic,
    );

    this.logger.log(
      `Telegram notification sent for category ${category.name} - VIP EN: ${result.vipEn ? 'YES' : 'NO'}, VIP EL: ${result.vipEl ? 'YES' : 'NO'}, Public EN: ${result.publicEn ? 'YES' : 'NO'}, Public EL: ${result.publicEl ? 'YES' : 'NO'}`
    );
  }

  async updateBet(id: string, data: any) {
    const updates: string[] = [];
    const values: any[] = [];

    // If updating image, get the old image to delete it
    let oldImageUrl: string | null = null;
    if (data.imageUrl !== undefined) {
      const oldBet = await this.db.queryOne(
        'SELECT image_url FROM bets WHERE id = ?',
        [id]
      );
      oldImageUrl = oldBet?.image_url;
    }

    if (data.categoryId !== undefined && data.categoryId !== '') {
      updates.push('category_id = ?');
      values.push(data.categoryId);
    }
    if (data.imageUrl !== undefined) {
      updates.push('image_url = ?');
      values.push(data.imageUrl);
    }
    if (data.match !== undefined) {
      updates.push('match_info = ?');
      values.push(JSON.stringify(data.match));
    }
    if (data.odds !== undefined && data.odds !== '') {
      updates.push('odds = ?');
      values.push(data.odds);
    }
    if (data.analysis !== undefined) {
      updates.push('analysis = ?');
      values.push(data.analysis);
    }
    if (data.result !== undefined && data.result !== '') {
      updates.push('result = ?');
      values.push(data.result);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.db.query(
        `UPDATE bets SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Delete old image if it was replaced with a new one
    if (oldImageUrl && data.imageUrl && oldImageUrl !== data.imageUrl) {
      try {
        const oldImagePath = join(process.cwd(), oldImageUrl);
        if (existsSync(oldImagePath)) {
          unlinkSync(oldImagePath);
        }
      } catch (err) {
        console.error('Failed to delete old image file:', err);
      }
    }

    return { message: 'Bet updated successfully' };
  }

  async deleteBet(id: string) {
    // First, get the bet to find the image URL
    const bet = await this.db.queryOne(
      'SELECT image_url FROM bets WHERE id = ?',
      [id]
    );

    // Delete the bet from database
    await this.db.query('DELETE FROM bets WHERE id = ?', [id]);

    // If there was an image, delete the file
    if (bet?.image_url) {
      try {
        // image_url is like /uploads/bets/filename.webp
        const imagePath = join(process.cwd(), bet.image_url);
        if (existsSync(imagePath)) {
          unlinkSync(imagePath);
        }
      } catch (err) {
        // Log but don't fail if file deletion fails
        console.error('Failed to delete image file:', err);
      }
    }

    return { message: 'Bet deleted successfully' };
  }

  async publishBet(id: string) {
    await this.db.query(
      `UPDATE bets SET status = 'PUBLISHED', published_at = NOW() WHERE id = ?`,
      [id]
    );
    return { message: 'Bet published successfully' };
  }

  async updateBetResult(id: string, result: string) {
    if (!['IN_PROGRESS', 'WIN', 'LOST', 'CASH_OUT'].includes(result)) {
      throw new Error('Invalid result value');
    }
    await this.db.query(
      `UPDATE bets SET result = ? WHERE id = ?`,
      [result, id]
    );
    return { message: 'Bet result updated successfully' };
  }

  async getSubscriptions() {
    const subs = await this.db.query(
      `SELECT s.id, s.user_id, u.email, u.username as name,
              p.name as packName, p.id as packId, s.status,
              s.current_period_end as nextBilling, s.created_at as startDate
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN packs p ON s.pack_id = p.id
       ORDER BY s.created_at DESC`
    );

    return subs.map((sub: any) => ({
      id: sub.id,
      user: {
        email: sub.email,
        name: sub.name,
        id: sub.user_id,
      },
      pack: sub.packName,
      packId: sub.packId,
      status: sub.status,
      nextBilling: sub.nextBilling ? this.formatDate(sub.nextBilling) : null,
      startDate: this.formatDate(sub.startDate),
    }));
  }

  async refundSubscription(id: string) {
    // Get subscription details with user and pack info
    const subscription = await this.db.queryOne(
      `SELECT s.*, u.email, u.username, u.full_name, u.preferred_language, p.name as packName, p.currency
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN packs p ON s.pack_id = p.id
       WHERE s.id = ?`,
      [id]
    );

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    // Find the most recent completed payment for this subscription
    const payment = await this.db.queryOne(
      `SELECT * FROM transactions 
       WHERE subscription_id = ? AND status = 'COMPLETED'
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    if (!payment) {
      throw new BadRequestException('No completed payment found for this subscription');
    }

    if (!payment.stripe_payment_intent_id) {
      throw new BadRequestException('No Stripe payment intent found. Manual refund required in Stripe dashboard.');
    }

    try {
      // Process refund in Stripe
      const refund = await this.stripeService.createRefund(
        payment.stripe_payment_intent_id,
        `Admin refund for subscription ${id}`
      );

      // Update payment status to REFUNDED
      await this.db.query(
        `UPDATE transactions SET status = 'REFUNDED', updated_at = NOW() WHERE id = ?`,
        [payment.id]
      );

      // Cancel the subscription in our database
      await this.db.query(
        `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?`,
        [id]
      );

      // Check if user has any other active paid subscriptions before kicking from Telegram
      // IMPORTANT: Also check current_period_end > NOW() to ensure subscription hasn't expired
      const otherActiveSubscriptions = await this.db.query(
        `SELECT s.id FROM subscriptions s
         JOIN packs p ON s.pack_id = p.id
         WHERE s.user_id = ? 
           AND s.status = 'ACTIVE' 
           AND s.current_period_end > NOW()
           AND p.is_free = FALSE
           AND s.id != ?`,
        [subscription.user_id, id]
      );

      // Only kick from Telegram if user has NO other active paid subscriptions
      if (otherActiveSubscriptions.length === 0) {
        try {
          const kicked = await this.telegramService.kickUserByUserId(subscription.user_id);
          if (kicked) {
            this.logger.log(`User ${subscription.user_id} kicked from VIP Telegram group (subscription refunded)`);
          }
        } catch (telegramError) {
          this.logger.error(`Failed to kick user from Telegram: ${telegramError.message}`);
        }
      }

      // Cancel in Stripe if there's a Stripe subscription
      if (subscription.stripe_subscription_id) {
        try {
          await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, true);
        } catch (stripeError) {
          this.logger.warn(`Failed to cancel Stripe subscription: ${stripeError.message}`);
        }
      }

      // Send refund confirmation email to user
      const username = subscription.username || subscription.full_name || 'Customer';
      const language = (subscription.preferred_language === 'el' ? 'el' : 'en') as 'en' | 'el';
      await this.emailService.sendRefundConfirmation(
        subscription.email,
        username,
        subscription.packName,
        parseFloat(payment.amount),
        subscription.currency || '€',
        new Date(),
        language
      );

      this.logger.log(`Refund processed for subscription ${id}, refund ID: ${refund.id}`);

      return { 
        message: 'Refund processed successfully',
        refundId: refund.id,
        amount: parseFloat(payment.amount),
        currency: subscription.currency || 'EUR'
      };
    } catch (error) {
      this.logger.error(`Failed to process refund: ${error.message}`);
      throw new BadRequestException(`Failed to process refund: ${error.message}`);
    }
  }

  async cancelSubscription(id: string) {
    await this.db.query(
      `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?`,
      [id]
    );
    return { message: 'Subscription cancelled successfully' };
  }

  /**
   * Sync all free packs to all verified users
   * Note: Free packs are now automatically accessible to all users without subscription entries.
   * The bets service checks is_free=TRUE on packs directly, so no sync is needed.
   */
  async syncFreePacks() {
    // Get all active free packs (for information purposes)
    const freePacks = await this.db.query<{ id: string; name: string }>(
      'SELECT id, name FROM packs WHERE is_free = TRUE AND is_active = TRUE'
    );

    return { 
      message: 'Free packs are automatically accessible to all users without subscription entries. No sync needed.',
      freePacksCount: freePacks?.length || 0,
      freePackNames: freePacks?.map(p => p.name) || []
    };
  }

  private getRelativeTime(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds} secs ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
  }
}
