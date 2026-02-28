import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public statistics for all categories (no auth required)' })
  @ApiQuery({ name: 'month', required: false, description: 'Filter by month (1-12)' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year' })
  async getStatistics(
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    const monthNum = month ? parseInt(month, 10) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;

    // Validate month range
    if (monthNum && (monthNum < 1 || monthNum > 12)) {
      return { error: 'Month must be between 1 and 12' };
    }

    return this.statisticsService.getStatistics(monthNum, yearNum);
  }

  @Get('available-months')
  @ApiOperation({ summary: 'Get list of months with available statistics data' })
  async getAvailableMonths() {
    return this.statisticsService.getAvailableMonths();
  }

  @Get('available-years')
  @ApiOperation({ summary: 'Get list of years with available statistics data' })
  async getAvailableYears() {
    return this.statisticsService.getAvailableYears();
  }

  @Get('historical')
  @ApiOperation({ summary: 'Get historical statistics (legacy data before system launch)' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year' })
  async getHistoricalStatistics(@Query('year') year?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.statisticsService.getHistoricalStatistics(yearNum);
  }
}
