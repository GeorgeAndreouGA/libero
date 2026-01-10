import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create subscription checkout' })
  async createSubscription(@Body() data: { packId: string }, @CurrentUser() user: any) {
    return this.subscriptionsService.createCheckout(user.id, data.packId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user subscriptions' })
  async getSubscriptions(@CurrentUser() user: any) {
    return this.subscriptionsService.getUserSubscriptions(user.id);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user active subscriptions' })
  async getActiveSubscriptions(@CurrentUser() user: any) {
    return this.subscriptionsService.getUserActiveSubscriptions(user.id);
  }

  // ===== Payment Methods Management =====

  @Post('customer-portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe Customer Portal session for managing payment methods' })
  async createCustomerPortal(@CurrentUser() user: any) {
    return this.subscriptionsService.createCustomerPortalSession(user.id);
  }
}
