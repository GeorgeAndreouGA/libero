import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { CategoriesService } from '../categories/categories.service';
import { v4 as uuidv4 } from 'uuid';

export interface Pack {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  currency: string;
  displayOrder: number;
  isFree: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categories?: any[];
  includedPacks?: string[] | Pack[] | { id: string; name: string }[];
}

export interface CreatePackDto {
  name: string;
  description?: string;
  priceMonthly: number;
  currency?: string;
  displayOrder?: number;
  isFree?: boolean;
  isActive?: boolean;
  categoryIds?: string[];
  includedPackIds?: string[];
}

export interface UpdatePackDto {
  name?: string;
  description?: string;
  priceMonthly?: number;
  currency?: string;
  displayOrder?: number;
  isFree?: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive?: boolean;
}

@Injectable()
export class PacksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async getPacks(includeInactive = false): Promise<Pack[]> {
    const query = includeInactive
      ? 'SELECT * FROM packs ORDER BY display_order ASC, price_monthly ASC'
      : 'SELECT * FROM packs WHERE is_active = TRUE ORDER BY display_order ASC, price_monthly ASC';

    const packs = await this.db.query(query);

    return Promise.all(
      packs.map(async (pack: any) => {
        const categories = await this.categoriesService.getCategoriesForPack(pack.id);
        const includedPacks = await this.getIncludedPacks(pack.id);

        return {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          priceMonthly: parseFloat(pack.price_monthly),
          currency: pack.currency,
          displayOrder: pack.display_order,
          isFree: pack.is_free,
          stripeProductId: pack.stripe_product_id,
          stripePriceId: pack.stripe_price_id,
          isActive: pack.is_active,
          createdAt: pack.created_at,
          updatedAt: pack.updated_at,
          categories,
          includedPacks: includedPacks.map((p) => ({ id: p.id, name: p.name })),
        };
      })
    );
  }

  async getPacksPaginated(includeInactive = false, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
    const query = `SELECT * FROM packs ${whereClause} ORDER BY display_order ASC, price_monthly ASC LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`;
    const countQuery = `SELECT COUNT(*) as total FROM packs ${whereClause}`;

    const [packs, countResult] = await Promise.all([
      this.db.query(query),
      this.db.queryOne(countQuery),
    ]);

    const total = countResult?.total || 0;

    const data = await Promise.all(
      packs.map(async (pack: any) => {
        const categories = await this.categoriesService.getCategoriesForPack(pack.id);
        const includedPacks = await this.getIncludedPacks(pack.id);

        return {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          priceMonthly: parseFloat(pack.price_monthly),
          currency: pack.currency,
          displayOrder: pack.display_order,
          isFree: pack.is_free,
          stripeProductId: pack.stripe_product_id,
          stripePriceId: pack.stripe_price_id,
          isActive: pack.is_active,
          createdAt: pack.created_at,
          updatedAt: pack.updated_at,
          categories,
          includedPacks: includedPacks.map((p) => ({ id: p.id, name: p.name })),
        };
      })
    );

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

  async getPackById(id: string): Promise<Pack> {
    const pack = await this.db.queryOne('SELECT * FROM packs WHERE id = ?', [id]);

    if (!pack) {
      throw new NotFoundException(`Pack with ID ${id} not found`);
    }

    const categories = await this.categoriesService.getCategoriesForPack(id);
    const includedPacks = await this.getIncludedPacks(id);

    return {
      id: pack.id,
      name: pack.name,
      description: pack.description,
      priceMonthly: parseFloat(pack.price_monthly),
      currency: pack.currency,
      displayOrder: pack.display_order,
      isFree: pack.is_free,
      stripeProductId: pack.stripe_product_id,
      stripePriceId: pack.stripe_price_id,
      isActive: pack.is_active,
      createdAt: pack.created_at,
      updatedAt: pack.updated_at,
      categories,
      includedPacks,
    };
  }

  async createPack(data: CreatePackDto): Promise<Pack> {
    // Check if pack with same name exists
    const existing = await this.db.queryOne(
      'SELECT id FROM packs WHERE name = ?',
      [data.name]
    );

    if (existing) {
      throw new ConflictException(`Pack with name "${data.name}" already exists`);
    }

    // Auto-calculate next display order (last position)
    const maxOrder = await this.db.queryOne<{ max_order: number }>(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM packs'
    );
    const nextDisplayOrder = (maxOrder?.max_order || 0) + 1;

    const id = uuidv4();
    await this.db.query(
      `INSERT INTO packs (id, name, description, price_monthly, currency, display_order, is_free, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.priceMonthly,
        data.currency || 'EUR',
        nextDisplayOrder,
        data.isFree || false,
        true, // Always active
      ]
    );

    // Link categories
    if (data.categoryIds && data.categoryIds.length > 0) {
      await this.linkCategoriesToPack(id, data.categoryIds);
    }

    // Link included packs (hierarchy)
    if (data.includedPackIds && data.includedPackIds.length > 0) {
      await this.setPackHierarchy(id, data.includedPackIds);
    }

    // Note: Free packs don't need subscription entries - they are automatically
    // accessible to all users via the bets service which checks is_free=TRUE directly

    return this.getPackById(id);
  }

  async updatePack(id: string, data: UpdatePackDto): Promise<Pack> {
    const pack = await this.getPackById(id);

    // Check if new name conflicts with existing pack
    if (data.name && data.name !== pack.name) {
      const existing = await this.db.queryOne(
        'SELECT id FROM packs WHERE name = ? AND id != ?',
        [data.name, id]
      );

      if (existing) {
        throw new ConflictException(`Pack with name "${data.name}" already exists`);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.priceMonthly !== undefined) {
      updates.push('price_monthly = ?');
      values.push(data.priceMonthly);
    }
    if (data.currency !== undefined) {
      updates.push('currency = ?');
      values.push(data.currency);
    }
    if (data.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(data.displayOrder);
    }
    if (data.isFree !== undefined) {
      updates.push('is_free = ?');
      values.push(data.isFree);
    }
    if (data.stripeProductId !== undefined) {
      updates.push('stripe_product_id = ?');
      values.push(data.stripeProductId);
    }
    if (data.stripePriceId !== undefined) {
      updates.push('stripe_price_id = ?');
      values.push(data.stripePriceId);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.db.query(
        `UPDATE packs SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Note: If pack became free, no subscription entries needed - the bets service
    // automatically grants access to free pack categories by checking is_free=TRUE

    return this.getPackById(id);
  }

  async deletePack(id: string): Promise<void> {
    // Check if pack exists
    const pack = await this.getPackById(id);

    // If pack is NOT free, check if it has active subscriptions
    // Free packs CAN be deleted even with active subscriptions
    if (!pack.isFree) {
      const subs = await this.db.queryOne(
        'SELECT COUNT(*) as count FROM subscriptions WHERE pack_id = ? AND status = "ACTIVE"',
        [id]
      );

      if (subs.count > 0) {
        throw new ConflictException(
          `Cannot delete paid pack with ${subs.count} active subscription(s). Users have purchased this pack.`
        );
      }
    }

    // For free packs, first delete all subscriptions
    if (pack.isFree) {
      await this.db.query('DELETE FROM subscriptions WHERE pack_id = ?', [id]);
    }

    // Delete pack categories
    await this.db.query('DELETE FROM pack_categories WHERE pack_id = ?', [id]);

    // Delete pack hierarchy
    await this.db.query(
      'DELETE FROM pack_hierarchy WHERE pack_id = ? OR includes_pack_id = ?',
      [id, id]
    );

    // Delete pack
    await this.db.query('DELETE FROM packs WHERE id = ?', [id]);
  }

  async linkCategoriesToPack(packId: string, categoryIds: string[]): Promise<void> {
    // Verify pack exists
    await this.getPackById(packId);

    // Verify all categories exist
    for (const categoryId of categoryIds) {
      await this.categoriesService.getCategoryById(categoryId);
    }

    // Remove existing links
    await this.db.query('DELETE FROM pack_categories WHERE pack_id = ?', [packId]);

    // Add new links
    for (const categoryId of categoryIds) {
      const linkId = uuidv4();
      await this.db.query(
        'INSERT INTO pack_categories (id, pack_id, category_id) VALUES (?, ?, ?)',
        [linkId, packId, categoryId]
      );
    }
  }

  async setPackHierarchy(packId: string, includedPackIds: string[]): Promise<void> {
    // Verify pack exists
    await this.getPackById(packId);

    // Verify all included packs exist
    for (const includedPackId of includedPackIds) {
      if (includedPackId === packId) {
        throw new BadRequestException('A pack cannot include itself');
      }
      await this.getPackById(includedPackId);
    }

    // Check for circular dependencies
    for (const includedPackId of includedPackIds) {
      const circularCheck = await this.db.queryOne(
        'SELECT id FROM pack_hierarchy WHERE pack_id = ? AND includes_pack_id = ?',
        [includedPackId, packId]
      );

      if (circularCheck) {
        throw new BadRequestException(
          'Circular dependency detected: included pack cannot include this pack'
        );
      }
    }

    // Remove existing hierarchy
    await this.db.query('DELETE FROM pack_hierarchy WHERE pack_id = ?', [packId]);

    // Add new hierarchy
    for (const includedPackId of includedPackIds) {
      const hierarchyId = uuidv4();
      await this.db.query(
        'INSERT INTO pack_hierarchy (id, pack_id, includes_pack_id) VALUES (?, ?, ?)',
        [hierarchyId, packId, includedPackId]
      );
    }
  }

  async getIncludedPacks(packId: string): Promise<Pack[]> {
    const included = await this.db.query(
      `SELECT p.* FROM packs p
       INNER JOIN pack_hierarchy ph ON p.id = ph.includes_pack_id
       WHERE ph.pack_id = ?
       ORDER BY p.display_order ASC`,
      [packId]
    );

    return included.map((pack: any) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      priceMonthly: parseFloat(pack.price_monthly),
      currency: pack.currency,
      displayOrder: pack.display_order,
      isFree: pack.is_free,
      stripeProductId: pack.stripe_product_id,
      stripePriceId: pack.stripe_price_id,
      isActive: pack.is_active,
      createdAt: pack.created_at,
      updatedAt: pack.updated_at,
    }));
  }

  async getAllCategoriesForPack(packId: string): Promise<any[]> {
    // Get categories directly associated with this pack
    const directCategories = await this.categoriesService.getCategoriesForPack(packId);

    // Get categories from included packs (recursively)
    const includedPacks = await this.getIncludedPacks(packId);
    const inheritedCategories: any[] = [];

    for (const includedPack of includedPacks) {
      const categories = await this.getAllCategoriesForPack(includedPack.id);
      inheritedCategories.push(...categories);
    }

    // Combine and deduplicate
    const allCategories = [...directCategories, ...inheritedCategories];
    const uniqueCategories = Array.from(
      new Map(allCategories.map((cat) => [cat.id, cat])).values()
    );

    return uniqueCategories;
  }

  async getPacksForUser(userId: string): Promise<Pack[]> {
    // IMPORTANT: Also check current_period_end > NOW() to ensure subscription hasn't expired
    const packs = await this.db.query(
      `SELECT p.* FROM packs p
       INNER JOIN subscriptions s ON p.id = s.pack_id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW()
       ORDER BY p.display_order ASC`,
      [userId]
    );

    return Promise.all(
      packs.map(async (pack: any) => {
        const allCategories = await this.getAllCategoriesForPack(pack.id);

        return {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          priceMonthly: parseFloat(pack.price_monthly),
          currency: pack.currency,
          displayOrder: pack.display_order,
          isFree: pack.is_free,
          stripeProductId: pack.stripe_product_id,
          stripePriceId: pack.stripe_price_id,
          isActive: pack.is_active,
          createdAt: pack.created_at,
          updatedAt: pack.updated_at,
          categories: allCategories,
        };
      })
    );
  }

}

