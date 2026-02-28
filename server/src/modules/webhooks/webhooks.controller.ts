import { 
  Controller, 
  Post, 
  Req, 
  Headers, 
  Body,
  BadRequestException,
  ForbiddenException,
  Logger,
  RawBodyRequest 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly telegramSecretToken: string;

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {
    this.telegramSecretToken = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET') || '';
  }

  @Post('stripe')
  @ApiExcludeEndpoint() // Hide from Swagger docs
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  async handleStripeWebhook(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('stripe-signature') signature: string
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Get raw body for signature verification
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    try {
      await this.webhooksService.handleStripeWebhook(rawBody, signature);
      return { received: true };
    } catch (error) {
      this.logger.error(`Stripe webhook error: ${error.message}`, error.stack);
      throw new BadRequestException(error.message);
    }
  }

  @Post('telegram')
  @ApiExcludeEndpoint() // Hide from Swagger docs
  @ApiOperation({ summary: 'Handle Telegram bot webhook updates' })
  async handleTelegramWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ) {
    // Always verify Telegram secret token - reject if not configured or invalid
    if (!this.telegramSecretToken) {
      this.logger.warn('Telegram webhook called but TELEGRAM_WEBHOOK_SECRET is not configured');
      throw new ForbiddenException('Webhook not configured');
    }
    
    if (!secretToken || secretToken !== this.telegramSecretToken) {
      this.logger.warn('Invalid or missing Telegram webhook secret token');
      throw new ForbiddenException('Invalid webhook secret');
    }

    try {
      await this.webhooksService.handleTelegramUpdate(update);
      return { ok: true };
    } catch (error) {
      this.logger.error(`Telegram webhook error: ${error.message}`, error.stack);
      // Always return ok to Telegram to prevent retries
      return { ok: true };
    }
  }
}
