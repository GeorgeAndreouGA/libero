import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface Category {
  id: string;
  name: string;
  nameEl: string | null;
  description: string | null;
  descriptionEl: string | null;
  standardBet: number;
  displayOrder: number;
  isActive: boolean;
  includeInStatistics: boolean;
  telegramNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDto {
  name: string;
  nameEl?: string;
  description?: string;
  descriptionEl?: string;
  standardBet: number;
  displayOrder?: number;
  isActive?: boolean;
  includeInStatistics?: boolean;
  telegramNotifications?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  nameEl?: string;
  description?: string;
  descriptionEl?: string;
  standardBet?: number;
  displayOrder?: number;
  isActive?: boolean;
  includeInStatistics?: boolean;
  telegramNotifications?: boolean;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly db: DatabaseService) {}

  async getCategories(includeInactive = false): Promise<Category[]> {
    const query = includeInactive
      ? 'SELECT * FROM categories ORDER BY display_order ASC, name ASC'
      : 'SELECT * FROM categories WHERE is_active = TRUE ORDER BY display_order ASC, name ASC';

    const categories = await this.db.query(query);

    return categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      nameEl: cat.name_el,
      description: cat.description,
      descriptionEl: cat.description_el,
      standardBet: parseFloat(cat.standard_bet),
      displayOrder: cat.display_order,
      isActive: Boolean(cat.is_active),
      includeInStatistics: Boolean(cat.include_in_statistics),
      telegramNotifications: Boolean(cat.telegram_notifications),
      createdAt: cat.created_at,
      updatedAt: cat.updated_at,
    }));
  }

  async getCategoriesPaginated(includeInactive = false, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
    const query = `SELECT * FROM categories ${whereClause} ORDER BY display_order ASC, name ASC LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`;
    const countQuery = `SELECT COUNT(*) as total FROM categories ${whereClause}`;

    const [categories, countResult] = await Promise.all([
      this.db.query(query),
      this.db.queryOne(countQuery),
    ]);

    const total = countResult?.total || 0;

    const data = categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      nameEl: cat.name_el,
      description: cat.description,
      descriptionEl: cat.description_el,
      standardBet: parseFloat(cat.standard_bet),
      displayOrder: cat.display_order,
      isActive: Boolean(cat.is_active),
      includeInStatistics: Boolean(cat.include_in_statistics),
      telegramNotifications: Boolean(cat.telegram_notifications),
      createdAt: cat.created_at,
      updatedAt: cat.updated_at,
    }));

    return {
      data,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      }
    };
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.db.queryOne(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return {
      id: category.id,
      name: category.name,
      nameEl: category.name_el,
      description: category.description,
      descriptionEl: category.description_el,
      standardBet: parseFloat(category.standard_bet),
      displayOrder: category.display_order,
      isActive: Boolean(category.is_active),
      includeInStatistics: Boolean(category.include_in_statistics),
      telegramNotifications: Boolean(category.telegram_notifications),
      createdAt: category.created_at,
      updatedAt: category.updated_at,
    };
  }

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    // Validate standardBet
    if (data.standardBet === undefined || data.standardBet === null) {
      throw new BadRequestException('Standard bet is required');
    }
    if (data.standardBet < 0) {
      throw new BadRequestException('Standard bet must be a positive number');
    }

    // Check if category with same name exists
    const existing = await this.db.queryOne(
      'SELECT id FROM categories WHERE name = ?',
      [data.name]
    );

    if (existing) {
      throw new ConflictException(`Category with name "${data.name}" already exists`);
    }

    // Auto-calculate next display order (last position)
    const maxOrder = await this.db.queryOne<{ max_order: number }>(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM categories'
    );
    const nextDisplayOrder = (maxOrder?.max_order || 0) + 1;

    const id = uuidv4();
    await this.db.query(
      `INSERT INTO categories (id, name, name_el, description, description_el, standard_bet, display_order, is_active, include_in_statistics, telegram_notifications)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.nameEl || null,
        data.description || null,
        data.descriptionEl || null,
        data.standardBet,
        nextDisplayOrder,
        true, // Always active
        data.includeInStatistics !== false, // Default to true
        data.telegramNotifications !== false, // Default to true
      ]
    );

    return this.getCategoryById(id);
  }

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    const category = await this.getCategoryById(id);

    // Check if new name conflicts with existing category
    if (data.name && data.name !== category.name) {
      const existing = await this.db.queryOne(
        'SELECT id FROM categories WHERE name = ? AND id != ?',
        [data.name, id]
      );

      if (existing) {
        throw new ConflictException(`Category with name "${data.name}" already exists`);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.nameEl !== undefined) {
      updates.push('name_el = ?');
      values.push(data.nameEl);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.descriptionEl !== undefined) {
      updates.push('description_el = ?');
      values.push(data.descriptionEl);
    }
    if (data.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(data.displayOrder);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive);
    }
    if (data.includeInStatistics !== undefined) {
      updates.push('include_in_statistics = ?');
      values.push(data.includeInStatistics);
    }
    if (data.standardBet !== undefined) {
      if (data.standardBet < 0) {
        throw new BadRequestException('Standard bet must be a positive number');
      }
      updates.push('standard_bet = ?');
      values.push(data.standardBet);
    }
    if (data.telegramNotifications !== undefined) {
      updates.push('telegram_notifications = ?');
      values.push(data.telegramNotifications);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.db.query(
        `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return this.getCategoryById(id);
  }

  async deleteCategory(id: string): Promise<void> {
    // Check if category exists
    await this.getCategoryById(id);

    // Check if category has any bets
    const bets = await this.db.queryOne(
      'SELECT COUNT(*) as count FROM bets WHERE category_id = ?',
      [id]
    );

    if (bets.count > 0) {
      throw new ConflictException(
        `Cannot delete category with ${bets.count} associated bet(s). Please reassign or delete the bets first.`
      );
    }

    // Check if category is linked to any packs
    const packs = await this.db.queryOne(
      'SELECT COUNT(*) as count FROM pack_categories WHERE category_id = ?',
      [id]
    );

    if (packs.count > 0) {
      throw new ConflictException(
        `Cannot delete category linked to ${packs.count} pack(s). Please unlink from packs first.`
      );
    }

    await this.db.query('DELETE FROM categories WHERE id = ?', [id]);
  }

  async getCategoriesForPack(packId: string): Promise<Category[]> {
    const categories = await this.db.query(
      `SELECT c.* FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       WHERE pc.pack_id = ? AND c.is_active = TRUE
       ORDER BY c.display_order ASC, c.name ASC`,
      [packId]
    );

    return categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      nameEl: cat.name_el,
      description: cat.description,
      descriptionEl: cat.description_el,
      standardBet: parseFloat(cat.standard_bet),
      displayOrder: cat.display_order,
      isActive: Boolean(cat.is_active),
      includeInStatistics: Boolean(cat.include_in_statistics),
      telegramNotifications: Boolean(cat.telegram_notifications),
      createdAt: cat.created_at,
      updatedAt: cat.updated_at,
    }));
  }

  async getCategoriesForUser(userId: string): Promise<Category[]> {
    // Get categories from directly subscribed packs AND inherited packs through hierarchy
    // IMPORTANT: Also check current_period_end > NOW() to ensure subscription hasn't expired
    const categories = await this.db.query(
      `SELECT DISTINCT c.* FROM categories c
       INNER JOIN pack_categories pc ON c.id = pc.category_id
       INNER JOIN (
         -- Direct pack subscription
         SELECT s.pack_id FROM subscriptions s
         WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW()
         UNION
         -- Inherited packs through hierarchy
         SELECT ph.includes_pack_id as pack_id
         FROM subscriptions s
         INNER JOIN pack_hierarchy ph ON s.pack_id = ph.pack_id
         WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW()
       ) user_packs ON pc.pack_id = user_packs.pack_id
       WHERE c.is_active = TRUE
       ORDER BY c.display_order ASC, c.name ASC`,
      [userId, userId]
    );

    return categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      nameEl: cat.name_el,
      description: cat.description,
      descriptionEl: cat.description_el,
      standardBet: parseFloat(cat.standard_bet),
      displayOrder: cat.display_order,
      isActive: Boolean(cat.is_active),
      includeInStatistics: Boolean(cat.include_in_statistics),
      telegramNotifications: Boolean(cat.telegram_notifications),
      createdAt: cat.created_at,
      updatedAt: cat.updated_at,
    }));
  }
}

