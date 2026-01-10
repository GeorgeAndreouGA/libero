import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

export interface CategoryStatistics {
  id: string;
  name: string;
  nameEl: string | null;
  standardBet: number;
  wins: number;
  losses: number;
  cashOuts: number;
  totalBets: number; // wins + losses (excludes cash outs for win rate calculation)
  winRate: number; // wins / (wins + losses) - cash outs excluded
  totalProfit: number; // sum(wins) + sum(cashOuts × 0.95) - sum(losses)
}

export interface StatisticsResponse {
  categories: CategoryStatistics[];
  month: string | null; // null means all time
  year: number | null;
}

export interface HistoricalStatistic {
  id: string;
  year: number;
  month: number;
  isProfit: boolean;
  amount: number;
  runningTotal: number;
  notes: string | null;
}

export interface HistoricalStatisticsResponse {
  statistics: HistoricalStatistic[];
  years: number[];
}

@Injectable()
export class StatisticsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get statistics for all categories that are included in statistics (exclude UFC and LIVE)
   * @param month Optional month filter (1-12)
   * @param year Optional year filter
   */
  async getStatistics(month?: number, year?: number): Promise<StatisticsResponse> {
    // Build the date filter if month/year are provided
    let dateFilter = '';
    const params: any[] = [];

    if (month && year) {
      dateFilter = 'AND MONTH(b.published_at) = ? AND YEAR(b.published_at) = ?';
      params.push(month, year);
    } else if (year) {
      dateFilter = 'AND YEAR(b.published_at) = ?';
      params.push(year);
    }

    // Optimized: Single query to get all category stats at once
    // This replaces the N+1 query pattern (was 2 queries per category)
    const categoryStats = await this.db.query(
      `SELECT 
         c.id,
         c.name,
         c.name_el as nameEl,
         c.standard_bet as standardBet,
         COUNT(CASE WHEN b.result = 'WIN' THEN 1 END) as wins,
         COUNT(CASE WHEN b.result = 'LOST' THEN 1 END) as losses,
         COUNT(CASE WHEN b.result = 'CASH_OUT' THEN 1 END) as cashOuts,
         COALESCE(SUM(
           CASE 
             WHEN b.result = 'WIN' AND b.odds IS NOT NULL AND b.odds REGEXP '^[0-9]+\\.?[0-9]*$'
             THEN (c.standard_bet * CAST(b.odds AS DECIMAL(10,2))) - c.standard_bet
             WHEN b.result = 'CASH_OUT' AND b.odds IS NOT NULL AND b.odds REGEXP '^[0-9]+\\.?[0-9]*$'
             THEN ((c.standard_bet * CAST(b.odds AS DECIMAL(10,2))) - c.standard_bet) * 0.95
             WHEN b.result = 'LOST' 
             THEN -c.standard_bet
             ELSE 0
           END
         ), 0) as totalProfit
       FROM categories c
       LEFT JOIN bets b ON b.category_id = c.id 
         AND b.status = 'PUBLISHED'
         AND b.result IN ('WIN', 'LOST', 'CASH_OUT')
         ${dateFilter}
       WHERE c.is_active = TRUE AND c.include_in_statistics = TRUE
       GROUP BY c.id, c.name, c.name_el, c.standard_bet, c.display_order
       ORDER BY c.display_order ASC, c.name ASC`,
      params
    );

    const categories = categoryStats.map((stat: any) => {
      const wins = parseInt(stat.wins || 0);
      const losses = parseInt(stat.losses || 0);
      const cashOuts = parseInt(stat.cashOuts || 0);
      // totalBets excludes cash outs for win rate calculation (only WIN/LOST)
      const totalBets = wins + losses;
      const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;
      const standardBet = parseFloat(stat.standardBet || 0);
      const totalProfit = parseFloat(stat.totalProfit || 0);

      return {
        id: stat.id,
        name: stat.name,
        nameEl: stat.nameEl,
        standardBet,
        wins,
        losses,
        cashOuts,
        totalBets,
        winRate: Math.round(winRate * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
      };
    });

    return {
      categories,
      month: month ? month.toString().padStart(2, '0') : null,
      year: year || null,
    };
  }

  /**
   * Get available months that have bet data
   */
  async getAvailableMonths(): Promise<{ month: number; year: number; label: string }[]> {
    const months = await this.db.query(
      `SELECT DISTINCT 
         MONTH(published_at) as month, 
         YEAR(published_at) as year
       FROM bets 
       WHERE status = 'PUBLISHED' 
         AND result IN ('WIN', 'LOST', 'CASH_OUT')
         AND published_at IS NOT NULL
       ORDER BY year DESC, month DESC`
    );

    return months.map((m: any) => ({
      month: m.month,
      year: m.year,
      label: `${new Date(m.year, m.month - 1).toLocaleString('default', { month: 'long' })} ${m.year}`,
    }));
  }

  /**
   * Get available years that have bet data
   */
  async getAvailableYears(): Promise<{ year: number; label: string }[]> {
    const years = await this.db.query(
      `SELECT DISTINCT 
         YEAR(published_at) as year
       FROM bets 
       WHERE status = 'PUBLISHED' 
         AND result IN ('WIN', 'LOST', 'CASH_OUT')
         AND published_at IS NOT NULL
       ORDER BY year DESC`
    );

    return years.map((y: any) => ({
      year: y.year,
      label: `${y.year}`,
    }));
  }

  /**
   * Get historical statistics (legacy data before system launch)
   * @param year Optional year filter
   */
  async getHistoricalStatistics(year?: number): Promise<HistoricalStatisticsResponse> {
    let query = `SELECT 
      id, year, month, is_profit, amount, running_total, notes
      FROM historical_statistics`;
    const params: any[] = [];

    if (year) {
      query += ' WHERE year = ?';
      params.push(year);
    }

    query += ' ORDER BY year ASC, month ASC';

    const statistics = await this.db.query(query, params);

    // Get available years
    const yearsResult = await this.db.query(
      `SELECT DISTINCT year FROM historical_statistics ORDER BY year DESC`
    );

    return {
      statistics: statistics.map((s: any) => ({
        id: s.id,
        year: s.year,
        month: s.month,
        isProfit: Boolean(s.is_profit),
        amount: parseFloat(s.amount),
        runningTotal: parseFloat(s.running_total),
        notes: s.notes,
      })),
      years: yearsResult.map((y: any) => y.year),
    };
  }
}
