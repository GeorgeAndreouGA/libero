import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BetsService } from './bets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('bets')
@Controller('bets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Get()
  @ApiOperation({ summary: 'Get bets filtered by user category access' })
  async getBets(
    @CurrentUser() user: any,
    @Query('categoryId') categoryId?: string,
    @Query('result') result?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = parseInt(limit || '20', 10) || 20;
    return this.betsService.getBetsForUser(user.id, categoryId, result, pageNum, limitNum);
  }

  @Get('all-categories')
  @ApiOperation({ summary: 'Get all categories with access info' })
  async getAllCategoriesWithAccess(@CurrentUser() user: any) {
    return this.betsService.getAllCategoriesWithAccess(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single bet with category access control' })
  async getBet(@Param('id') id: string, @CurrentUser() user: any) {
    return this.betsService.getBet(id, user.id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export bet as PDF' })
  async exportBet(@Param('id') id: string, @CurrentUser() user: any) {
    return this.betsService.exportBet(id, user.id);
  }
}

