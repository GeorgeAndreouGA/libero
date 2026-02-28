import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getStats(userId: string) {
    // Get user's active packs with names
    // IMPORTANT: Also check current_period_end > NOW() to ensure subscription hasn't expired
    const activePacks = await this.db.query(
      `SELECT p.name 
       FROM subscriptions s
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.status = "ACTIVE" AND s.current_period_end > NOW()`,
      [userId]
    );

    // Get bets received count for user's active categories
    const betsReceived = await this.db.queryOne(
      `SELECT COUNT(DISTINCT b.id) as count 
       FROM bets b
       JOIN pack_categories pc ON b.category_id = pc.category_id
       JOIN subscriptions s ON s.pack_id = pc.pack_id
       WHERE s.user_id = ? AND s.status = "ACTIVE" AND s.current_period_end > NOW() AND b.status = "PUBLISHED"`,
      [userId]
    );

    // Calculate win rate from finished bets
    const betStats = await this.db.queryOne(
      `SELECT 
         COUNT(CASE WHEN b.result = 'WIN' THEN 1 END) as wins,
         COUNT(CASE WHEN b.result IN ('WIN', 'LOST') THEN 1 END) as total
       FROM bets b
       JOIN pack_categories pc ON b.category_id = pc.category_id
       JOIN subscriptions s ON s.pack_id = pc.pack_id
       WHERE s.user_id = ? AND s.status = "ACTIVE" AND s.current_period_end > NOW() AND b.status = "PUBLISHED"`,
      [userId]
    );

    const wins = betStats?.wins || 0;
    const total = betStats?.total || 0;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Get subscription details with days remaining
    const subscriptionInfo = await this.getSubscriptionInfo(userId);

    return {
      activePacks: activePacks.map((p: any) => p.name),
      betsReceived: betsReceived?.count || 0,
      winRate,
      totalROI: 0, // Would be calculated from actual stakes if tracked
      recentActivity: [], // Would come from bet results tracking
      subscription: subscriptionInfo,
    };
  }

  /**
   * Get user's subscription info including days remaining
   */
  async getSubscriptionInfo(userId: string): Promise<{
    packName: string;
    daysRemaining: number;
    endDate: string;
    startDate: string;
    isActive: boolean;
  } | null> {
    // Get active paid subscription (not free)
    // IMPORTANT: Also check current_period_end > NOW() to ensure subscription hasn't expired
    const subscription = await this.db.queryOne(
      `SELECT s.current_period_start, s.current_period_end, p.name as packName, p.is_free
       FROM subscriptions s
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND p.is_free = FALSE
       ORDER BY p.price_monthly DESC
       LIMIT 1`,
      [userId]
    );

    if (!subscription || !subscription.current_period_end) {
      return null;
    }

    const now = new Date();
    const endDate = new Date(subscription.current_period_end);
    const startDate = new Date(subscription.current_period_start);
    
    // Calculate days remaining
    const timeDiff = endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

    return {
      packName: subscription.packName,
      daysRemaining,
      endDate: endDate.toISOString(),
      startDate: startDate.toISOString(),
      isActive: daysRemaining > 0,
    };
  }
}
