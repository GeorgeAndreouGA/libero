import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class BetsService {
  constructor(private readonly db: DatabaseService) {}

  async getBetsForUser(userId: string, categoryId?: string, result?: string, page: number = 1, limit: number = 20) {
    // Pagination defaults
    const offset = (page - 1) * limit;
    const safeLimit = Math.min(Math.max(limit, 1), 100); // Clamp between 1 and 100

    // Get all categories the user has access to through their active subscriptions
    // IMPORTANT: Also check current_period_end > NOW() as a safety check
    // This ensures users can't access content if expiry cron hasn't run yet
    const userCategories = await this.db.query(
      `SELECT DISTINCT c.id, c.name FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN packs p ON pc.pack_id = p.id
       INNER JOIN subscriptions s ON p.id = s.pack_id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND c.is_active = TRUE`,
      [userId]
    );

    // Also include categories from inherited packs
    const inheritedCategories = await this.db.query(
      `SELECT DISTINCT c.id, c.name FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN pack_hierarchy ph ON pc.pack_id = ph.includes_pack_id
       INNER JOIN subscriptions s ON ph.pack_id = s.pack_id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND c.is_active = TRUE`,
      [userId]
    );

    // Also include categories from FREE packs (all users get free packs automatically)
    const freePackCategories = await this.db.query(
      `SELECT DISTINCT c.id, c.name FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN packs p ON pc.pack_id = p.id
       WHERE p.is_free = TRUE AND c.is_active = TRUE`,
      []
    );

    // Also include categories from packs INCLUDED in free packs (hierarchy for free packs)
    const freePackInheritedCategories = await this.db.query(
      `SELECT DISTINCT c.id, c.name FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN pack_hierarchy ph ON pc.pack_id = ph.includes_pack_id
       INNER JOIN packs p ON ph.pack_id = p.id
       WHERE p.is_free = TRUE AND c.is_active = TRUE`,
      []
    );

    const allCategories = [...userCategories, ...inheritedCategories, ...freePackCategories, ...freePackInheritedCategories];
    const categoryIds = [...new Set(allCategories.map((cat: any) => cat.id))];

    if (categoryIds.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit: safeLimit,
          total: 0,
          totalPages: 0,
        }
      };
    }

    // Build query to get bets
    let query = `
      SELECT b.id, b.image_url as imageUrl, 
             b.match_info as \`match\`, b.odds, b.analysis,
             b.status, b.result, b.published_at as publishedAt, 
             b.category_id as categoryId, b.created_at as createdAt,
             c.name as categoryName, c.name_el as categoryNameEl, c.standard_bet as standardBet
      FROM bets b
      INNER JOIN categories c ON b.category_id = c.id
      WHERE b.status = "PUBLISHED" AND b.category_id IN (${categoryIds.map(() => '?').join(',')})
    `;
    const params: any[] = [...categoryIds];

    if (categoryId) {
      query += ' AND b.category_id = ?';
      params.push(categoryId);
    }

    if (result && result !== 'ALL') {
      if (result === 'FINISHED') {
        query += ' AND b.result IN ("WIN", "LOST", "CASH_OUT")';
      } else if (result === 'WIN' || result === 'LOST' || result === 'IN_PROGRESS' || result === 'CASH_OUT') {
        query += ' AND b.result = ?';
        params.push(result);
      }
    }

    // Note: LIMIT and OFFSET are interpolated directly as integers (safe since they're validated numbers)
    query += ` ORDER BY b.published_at DESC LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`;

    const bets = await this.db.query(query, params);

    // Get total count for pagination info
    let countQuery = `
      SELECT COUNT(*) as total FROM bets b
      WHERE b.status = "PUBLISHED" AND b.category_id IN (${categoryIds.map(() => '?').join(',')})
    `;
    const countParams: any[] = [...categoryIds];
    
    if (categoryId) {
      countQuery += ' AND b.category_id = ?';
      countParams.push(categoryId);
    }
    
    if (result && result !== 'ALL') {
      if (result === 'FINISHED') {
        countQuery += ' AND b.result IN ("WIN", "LOST", "CASH_OUT")';
      } else if (result === 'WIN' || result === 'LOST' || result === 'IN_PROGRESS' || result === 'CASH_OUT') {
        countQuery += ' AND b.result = ?';
        countParams.push(result);
      }
    }
    
    const countResult = await this.db.queryOne(countQuery, countParams);
    const total = countResult?.total || 0;

    return {
      data: bets.map((bet: any) => ({
        ...bet,
        match: this.parseJsonField(bet.match),
        standardBet: parseFloat(bet.standardBet),
        publishedAt: this.getRelativeTime(bet.publishedAt),
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

  async getAllCategoriesWithAccess(userId: string) {
    // Get all categories
    const allCategories = await this.db.query(
      `SELECT c.id, c.name, c.name_el as nameEl, c.description, c.description_el as descriptionEl, c.display_order as displayOrder, c.standard_bet as standardBet
       FROM categories c
       WHERE c.is_active = TRUE
       ORDER BY c.display_order ASC, c.name ASC`
    );

    // Get categories the user has access to through subscriptions
    // IMPORTANT: Also check current_period_end > NOW() as a safety check
    const userCategoryIds = await this.db.query(
      `SELECT DISTINCT c.id FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN (
         SELECT s.pack_id FROM subscriptions s
         WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW()
         UNION
         SELECT ph.includes_pack_id as pack_id
         FROM subscriptions s
         INNER JOIN pack_hierarchy ph ON s.pack_id = ph.pack_id
         WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW()
       ) user_packs ON pc.pack_id = user_packs.pack_id
       WHERE c.is_active = TRUE`,
      [userId, userId]
    );

    // Get categories from FREE packs (all users get free packs automatically)
    const freePackCategoryIds = await this.db.query(
      `SELECT DISTINCT c.id FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN packs p ON pc.pack_id = p.id
       WHERE p.is_free = TRUE AND c.is_active = TRUE`,
      []
    );

    // Get categories from packs INCLUDED in free packs (hierarchy for free packs)
    const freePackInheritedCategoryIds = await this.db.query(
      `SELECT DISTINCT c.id FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN pack_hierarchy ph ON pc.pack_id = ph.includes_pack_id
       INNER JOIN packs p ON ph.pack_id = p.id
       WHERE p.is_free = TRUE AND c.is_active = TRUE`,
      []
    );

    const accessibleIds = new Set([
      ...userCategoryIds.map((c: any) => c.id),
      ...freePackCategoryIds.map((c: any) => c.id),
      ...freePackInheritedCategoryIds.map((c: any) => c.id),
    ]);

    return allCategories.map((cat: any) => ({
      ...cat,
      standardBet: parseFloat(cat.standardBet),
      hasAccess: accessibleIds.has(cat.id),
    }));
  }

  async getBet(id: string, userId: string) {
    const bet = await this.db.queryOne(
      `SELECT b.id, b.image_url as imageUrl,
              b.match_info as \`match\`, b.odds, b.analysis,
              b.status, b.result, b.published_at as publishedAt, 
              b.category_id as categoryId, b.created_at as createdAt,
              c.name as categoryName, c.name_el as categoryNameEl, c.standard_bet as standardBet
       FROM bets b
       INNER JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`,
      [id]
    );

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    // Check if user has access to this category through their subscriptions or free packs
    // IMPORTANT: Also check current_period_end > NOW() as a safety check
    const hasAccess = await this.db.queryOne(
      `SELECT COUNT(*) as count FROM (
        SELECT DISTINCT c.id FROM categories c
        INNER JOIN pack_categories pc ON c.id = pc.category_id
        INNER JOIN packs p ON pc.pack_id = p.id
        INNER JOIN subscriptions s ON p.id = s.pack_id
        WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND c.id = ?
        UNION
        SELECT DISTINCT c.id FROM categories c
        INNER JOIN pack_categories pc ON c.id = pc.category_id
        INNER JOIN pack_hierarchy ph ON pc.pack_id = ph.includes_pack_id
        INNER JOIN subscriptions s ON ph.pack_id = s.pack_id
        WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND c.id = ?
        UNION
        SELECT DISTINCT c.id FROM categories c
        INNER JOIN pack_categories pc ON c.id = pc.category_id
        INNER JOIN packs p ON pc.pack_id = p.id
        WHERE p.is_free = TRUE AND c.id = ?
        UNION
        SELECT DISTINCT c.id FROM categories c
        INNER JOIN pack_categories pc ON c.id = pc.category_id
        INNER JOIN pack_hierarchy ph ON pc.pack_id = ph.includes_pack_id
        INNER JOIN packs p ON ph.pack_id = p.id
        WHERE p.is_free = TRUE AND c.id = ?
      ) AS accessible_categories`,
      [userId, bet.categoryId, userId, bet.categoryId, bet.categoryId, bet.categoryId]
    );

    if (hasAccess.count === 0) {
      throw new ForbiddenException('You do not have access to this bet');
    }

    return {
      ...bet,
      match: this.parseJsonField(bet.match),
      standardBet: parseFloat(bet.standardBet),
      publishedAt: this.getRelativeTime(bet.publishedAt),
      createdAt: this.formatDate(bet.createdAt),
    };
  }

  async exportBet(id: string, userId: string) {
    // First check access
    await this.getBet(id, userId);

    // TODO: Implement PDF generation
    return { message: 'PDF export coming soon' };
  }

  private getRelativeTime(date: Date): string {
    if (!date) return 'Not published';
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
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  }
}

