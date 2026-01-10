import { Controller, Get, Post, Put, Delete, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.id);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Put('2fa')
  @ApiOperation({ summary: 'Enable or disable two-factor authentication' })
  async toggle2FA(@CurrentUser() user: any, @Body() body: { enabled: boolean }) {
    return this.usersService.toggle2FA(user.id, body.enabled);
  }

  @Put('language')
  @Roles('admin')
  @ApiOperation({ summary: 'Update language preference (admin only - regular users have language locked to their Telegram channel)' })
  async updateLanguage(@CurrentUser() user: any, @Body() body: { language: string }) {
    return this.usersService.updateLanguage(user.id, body.language);
  }

  @Get('export-data')
  @Roles('user')
  @ApiOperation({ summary: 'Export all user data (GDPR Right to Data Portability) - Users only' })
  async exportUserData(@CurrentUser() user: any) {
    return this.usersService.exportUserData(user.id);
  }

  @Post('request-deletion')
  @Roles('user')
  @ApiOperation({ summary: 'Request account deletion (GDPR Right to be Forgotten) - Users only' })
  async requestAccountDeletion(
    @CurrentUser() user: any,
    @Body() body: { password: string; reason?: string },
  ) {
    return this.usersService.requestAccountDeletion(user.id, body.password, body.reason);
  }

  @Delete('delete-account')
  @Roles('user')
  @ApiOperation({ summary: 'Permanently delete or anonymize account (GDPR Right to be Forgotten) - Users only' })
  async deleteAccount(
    @CurrentUser() user: any,
    @Body() body: { password: string; confirmDeletion: boolean },
  ) {
    return this.usersService.deleteOrAnonymizeAccount(user.id, body.password, body.confirmDeletion);
  }

  @Post('telegram/link')
  @ApiOperation({ summary: 'Link Telegram account' })
  async linkTelegram(
    @CurrentUser() user: any,
    @Body() body: { telegramUserId: string },
  ) {
    return this.usersService.linkTelegram(user.id, body.telegramUserId);
  }

  @Delete('telegram/unlink')
  @ApiOperation({ summary: 'Unlink Telegram account' })
  async unlinkTelegram(@CurrentUser() user: any) {
    return this.usersService.unlinkTelegram(user.id);
  }

  @Get('telegram/status')
  @ApiOperation({ summary: 'Get Telegram link status' })
  async getTelegramStatus(@CurrentUser() user: any) {
    return this.usersService.getTelegramStatus(user.id);
  }

  @Get('all')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  async getAllUsers(
    @Query('search') search?: string,
    @Query('timeFilter') timeFilter?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = parseInt(limit || '50', 10) || 50;
    return this.usersService.getAllUsers(search, timeFilter, pageNum, limitNum);
  }

  @Get(':id/transactions')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user transactions (admin only)' })
  async getUserTransactions(
    @Query('userId') userId: string,
    @Query('timeFilter') timeFilter?: string,
  ) {
    return this.usersService.getUserTransactions(userId, timeFilter);
  }
}
