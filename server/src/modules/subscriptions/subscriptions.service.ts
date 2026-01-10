import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../common/database/database.service';
import { StripeService } from '../../common/stripe/stripe.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
  }

  /**
   * Get user's current active paid subscription (excluding free packs)
   * IMPORTANT: Also checks current_period_end > NOW() to ensure subscription hasn't expired
   */
  async getUserActivePaidSubscription(userId: string): Promise<any | null> {
    const subscription = await this.db.queryOne(
      `SELECT s.*, p.price_monthly, p.is_free, p.name as packName
       FROM subscriptions s
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND p.is_free = FALSE
       ORDER BY p.price_monthly DESC
       LIMIT 1`,
      [userId]
    );
    return subscription || null;
  }

  /**
   * Get all user's active free subscriptions
   */
  async getUserActiveFreeSubscriptions(userId: string): Promise<any[]> {
    const subscriptions = await this.db.query(
      `SELECT s.*, p.name as packName
       FROM subscriptions s
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND p.is_free = TRUE
       ORDER BY p.display_order ASC`,
      [userId]
    );
    return subscriptions;
  }

  /**
   * Create a subscription for a user. 
   * Rules:
   * - Only ONE paid subscription allowed per user at a time
   * - When upgrading (buying higher-priced pack), old paid subscription is cancelled
   * - Downgrading (buying lower-priced pack) is NOT allowed
   * - Multiple free subscriptions are allowed and remain active
   */
  async createCheckout(userId: string, packId: string) {
    // Get pack details
    const pack = await this.db.queryOne(
      'SELECT * FROM packs WHERE id = ?',
      [packId]
    );

    if (!pack) {
      throw new BadRequestException('Pack not found');
    }

    // Free packs should not be purchased - they are auto-assigned
    if (pack.is_free) {
      throw new BadRequestException('Free packs cannot be purchased, they are automatically assigned');
    }

    // Check if user already has this pack (and subscription hasn't expired)
    const existingSubscription = await this.db.queryOne(
      `SELECT s.* FROM subscriptions s WHERE s.user_id = ? AND s.pack_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW()`,
      [userId, packId]
    );

    if (existingSubscription) {
      throw new ConflictException('You already have an active subscription for this pack');
    }

    // Get user's current active paid subscription
    const currentPaidSubscription = await this.getUserActivePaidSubscription(userId);

    if (currentPaidSubscription) {
      const currentPrice = parseFloat(currentPaidSubscription.price_monthly);
      const newPrice = parseFloat(pack.price_monthly);

      // Prevent downgrades
      if (newPrice < currentPrice) {
        throw new BadRequestException(
          `Cannot downgrade from ${currentPaidSubscription.packName} (€${currentPrice}/month) to ${pack.name} (€${newPrice}/month). Only upgrades are allowed.`
        );
      }
    }

    // Get user details
    const user = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get or create Stripe customer
    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await this.stripeService.getOrCreateCustomer(
        userId,
        user.email,
        user.full_name
      );
      stripeCustomerId = customer.id;

      // Save Stripe customer ID to user
      await this.db.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [stripeCustomerId, userId]);
    }

    // Determine if we have a Stripe price ID or need to create a dynamic one
    const isUpgrade = currentPaidSubscription ? parseFloat(pack.price_monthly) > parseFloat(currentPaidSubscription.price_monthly) : false;
    const oldPackName = currentPaidSubscription?.packName || '';
    const previousPackId = currentPaidSubscription?.pack_id || '';
    
    // Calculate upgrade price difference (in cents) for upgrade scenarios
    const upgradePriceDifference = isUpgrade && currentPaidSubscription
      ? Math.round((parseFloat(pack.price_monthly) - parseFloat(currentPaidSubscription.price_monthly)) * 100)
      : undefined;
    
    let checkoutSession;
    if (pack.stripe_price_id) {
      // Use existing Stripe price
      checkoutSession = await this.stripeService.createCheckoutSession({
        customerId: stripeCustomerId,
        priceId: pack.stripe_price_id,
        packId,
        userId,
        successUrl: `${this.frontendUrl}/packs?payment=success`,
        cancelUrl: `${this.frontendUrl}/packs?payment=cancelled`,
        isUpgrade,
        currentSubscriptionId: currentPaidSubscription?.stripe_subscription_id,
        oldPackName,
        previousPackId,
      });
    } else {
      // Create a dynamic price-based checkout
      checkoutSession = await this.stripeService.createOneTimeCheckoutSession({
        customerId: stripeCustomerId,
        packId,
        packName: pack.name,
        priceAmount: Math.round(parseFloat(pack.price_monthly) * 100), // Convert to cents
        upgradePriceAmount: upgradePriceDifference, // Pass upgrade difference for first payment
        currency: pack.currency || 'EUR',
        userId,
        successUrl: `${this.frontendUrl}/packs?payment=success`,
        cancelUrl: `${this.frontendUrl}/packs?payment=cancelled`,
        isUpgrade,
        currentSubscriptionId: currentPaidSubscription?.stripe_subscription_id,
        oldPackName,
        previousPackId,
      });
    }

    this.logger.log(`Created Stripe checkout session for user ${userId}, pack ${packId}`);

    return { 
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      packId,
      packName: pack.name,
      price: parseFloat(pack.price_monthly),
      isUpgrade,
      upgradePriceDifference: currentPaidSubscription 
        ? parseFloat(pack.price_monthly) - parseFloat(currentPaidSubscription.price_monthly)
        : null
    };
  }

  /**
   * Create a customer portal session for managing subscriptions
   */
  async createPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user || !user.stripe_customer_id) {
      throw new BadRequestException('No Stripe customer found for this user');
    }

    const portalSession = await this.stripeService.createPortalSession(
      user.stripe_customer_id,
      `${this.frontendUrl}/dashboard`
    );

    return { url: portalSession.url };
  }

  /**
   * Called after successful payment to activate subscription
   * Cancels old paid subscription if upgrading
   */
  async activatePaidSubscription(userId: string, packId: string, stripeSubscriptionId?: string, upgradeInfo?: { isUpgrade: boolean; previousPackId?: string; previousSubscriptionId?: string }): Promise<any> {
    // Get pack details
    const pack = await this.db.queryOne('SELECT * FROM packs WHERE id = ?', [packId]);
    
    if (!pack || pack.is_free) {
      throw new BadRequestException('Invalid pack for paid subscription');
    }

    // Cancel any existing paid subscriptions (upgrade scenario)
    const currentPaidSubscription = await this.getUserActivePaidSubscription(userId);
    const isUpgrade = upgradeInfo?.isUpgrade || (currentPaidSubscription !== null);
    const previousPackId = upgradeInfo?.previousPackId || currentPaidSubscription?.pack_id;
    const previousSubscriptionId = upgradeInfo?.previousSubscriptionId || currentPaidSubscription?.id;
    
    if (currentPaidSubscription) {
      await this.db.query(
        `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?`,
        [currentPaidSubscription.id]
      );
    }

    // Create new subscription with upgrade tracking
    const subscriptionId = uuidv4();
    const now = new Date();
    // Calculate period end properly - handle month boundaries correctly
    // E.g., Jan 31 + 1 month should be Feb 28/29, not March 3
    const periodEnd = new Date(now);
    const currentDay = now.getDate();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    // If the day changed (month overflow), set to last day of the target month
    if (periodEnd.getDate() !== currentDay) {
      // Go back to the last day of the previous month (which is the correct target month)
      periodEnd.setDate(0);
    }

    await this.db.query(
      `INSERT INTO subscriptions (id, user_id, pack_id, previous_pack_id, status, stripe_subscription_id, current_period_start, current_period_end, is_upgrade, upgrade_from_subscription_id, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, NOW())`,
      [subscriptionId, userId, packId, isUpgrade ? previousPackId : null, stripeSubscriptionId || null, now, periodEnd, isUpgrade ? 1 : 0, isUpgrade ? previousSubscriptionId : null]
    );
    
    return { id: subscriptionId, userId, packId, stripeSubscriptionId, isUpgrade, previousPackId };
  }

  /**
   * Get subscription details for email after payment
   */
  async getSubscriptionDetailsForEmail(userId: string, packId: string): Promise<{
    userId: string;
    email: string;
    username: string;
    packName: string;
    startDate: Date;
    endDate: Date;
    preferredLanguage: 'en' | 'el';
  } | null> {
    const result = await this.db.queryOne(
      `SELECT u.id as id, u.email, u.username, u.preferred_language as preferredLanguage, p.name as packName, 
              s.current_period_start as startDate, s.current_period_end as endDate
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.pack_id = ? AND s.status = 'ACTIVE'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId, packId]
    );

    if (!result) return null;

    return {
      userId: result.id,
      email: result.email,
      username: result.username,
      packName: result.packName,
      startDate: new Date(result.startDate),
      endDate: new Date(result.endDate),
      preferredLanguage: (result.preferredLanguage === 'el' ? 'el' : 'en') as 'en' | 'el',
    };
  }

  async getUserSubscriptions(userId: string) {
    const subs = await this.db.query(
      `SELECT s.id, s.pack_id as packId, s.status, 
              s.current_period_end as currentPeriodEnd, s.created_at as createdAt,
              p.name as packName, p.is_free as isFree, p.price_monthly as priceMonthly
       FROM subscriptions s
       LEFT JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return subs;
  }

  /**
   * Get user's active packs (paid only - excludes free packs)
   * IMPORTANT: Also checks current_period_end > NOW() to ensure subscription hasn't expired
   */
  async getUserActiveSubscriptions(userId: string) {
    const subs = await this.db.query(
      `SELECT s.id, s.pack_id as packId, s.status,
              p.name as packName, p.is_free as isFree, p.price_monthly as priceMonthly
       FROM subscriptions s
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND p.is_free = FALSE
       ORDER BY p.price_monthly DESC`,
      [userId]
    );

    return subs;
  }

  /**
   * Cancel a user's subscription
   */
  async cancelSubscription(userId: string, subscriptionId: string, immediately = false): Promise<void> {
    const subscription = await this.db.queryOne(
      `SELECT s.*, p.is_free FROM subscriptions s
       JOIN packs p ON s.pack_id = p.id
       WHERE s.id = ? AND s.user_id = ?`,
      [subscriptionId, userId]
    );

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    if (subscription.is_free) {
      throw new BadRequestException('Free subscriptions cannot be cancelled');
    }

    // Cancel in Stripe if there's a Stripe subscription
    if (subscription.stripe_subscription_id) {
      await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, immediately);
    }

    // Update local subscription status
    if (immediately) {
      await this.db.query(
        `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?`,
        [subscriptionId]
      );
    } else {
      await this.db.query(
        `UPDATE subscriptions SET cancel_at_period_end = TRUE WHERE id = ?`,
        [subscriptionId]
      );
    }

    this.logger.log(`Cancelled subscription ${subscriptionId} for user ${userId}`);
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  async getSubscriptionByStripeId(stripeSubscriptionId: string) {
    return this.db.queryOne(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?',
      [stripeSubscriptionId]
    );
  }

  /**
   * Update subscription period from Stripe webhook
   */
  async updateSubscriptionPeriod(
    stripeSubscriptionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    await this.db.query(
      `UPDATE subscriptions 
       SET current_period_start = ?, current_period_end = ?, updated_at = NOW()
       WHERE stripe_subscription_id = ?`,
      [periodStart, periodEnd, stripeSubscriptionId]
    );
  }

  /**
   * Handle subscription cancelled from Stripe
   */
  async handleStripeSubscriptionCancelled(stripeSubscriptionId: string): Promise<void> {
    // Get the subscription details before updating
    const subscription = await this.db.queryOne(
      `SELECT s.id, s.user_id FROM subscriptions s WHERE s.stripe_subscription_id = ?`,
      [stripeSubscriptionId]
    );

    await this.db.query(
      `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW() WHERE stripe_subscription_id = ?`,
      [stripeSubscriptionId]
    );
    this.logger.log(`Subscription ${stripeSubscriptionId} cancelled via Stripe webhook`);

    // Check if user has any other active paid subscriptions (not expired)
    if (subscription) {
      const otherActiveSubscriptions = await this.db.query(
        `SELECT s.id FROM subscriptions s
         JOIN packs p ON s.pack_id = p.id
         WHERE s.user_id = ? 
           AND s.status = 'ACTIVE' 
           AND s.current_period_end > NOW()
           AND p.is_free = FALSE
           AND s.id != ?`,
        [subscription.user_id, subscription.id]
      );

      // Only kick from Telegram if user has NO other active paid subscriptions
      if (otherActiveSubscriptions.length === 0) {
        try {
          const kicked = await this.telegramService.kickUserByUserId(subscription.user_id);
          if (kicked) {
            this.logger.log(`User ${subscription.user_id} kicked from VIP Telegram group (subscription cancelled, no other active paid subscriptions)`);
          }
        } catch (telegramError) {
          this.logger.error(
            `Failed to kick user ${subscription.user_id} from Telegram:`,
            telegramError
          );
        }
      } else {
        this.logger.log(
          `User ${subscription.user_id} still has ${otherActiveSubscriptions.length} active paid subscription(s), not kicking from Telegram`
        );
      }
    }
  }

  /**
   * Record a payment in the database
   */
  async recordPayment(params: {
    userId: string;
    subscriptionId?: string;
    amount: number;
    currency: string;
    stripePaymentIntentId?: string;
    stripeInvoiceId?: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  }): Promise<void> {
    const paymentId = uuidv4();
    await this.db.query(
      `INSERT INTO payments (id, user_id, subscription_id, amount, currency, stripe_payment_intent_id, stripe_invoice_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        paymentId,
        params.userId,
        params.subscriptionId || null,
        params.amount,
        params.currency,
        params.stripePaymentIntentId || null,
        params.stripeInvoiceId || null,
        params.status,
      ]
    );
    this.logger.log(`Recorded payment ${paymentId} for user ${params.userId}`);
  }

  /**
   * Get user by Stripe customer ID
   */
  async getUserByStripeCustomerId(stripeCustomerId: string) {
    return this.db.queryOne('SELECT * FROM users WHERE stripe_customer_id = ?', [stripeCustomerId]);
  }

  /**
   * Create a Stripe Customer Portal session for managing payment methods
   */
  async createCustomerPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user || !user.stripe_customer_id) {
      throw new BadRequestException('No Stripe customer found for this user');
    }

    const returnUrl = `${this.frontendUrl}/profile`;
    const session = await this.stripeService.createPortalSession(user.stripe_customer_id, returnUrl);
    
    return { url: session.url };
  }

  /**
   * Record a transaction in the database
   */
  async recordTransaction(params: {
    userId: string;
    subscriptionId?: string;
    amount: number;
    currency: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    stripePaymentIntentId?: string;
    stripeInvoiceId?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const {
      userId,
      subscriptionId,
      amount,
      currency,
      status,
      stripePaymentIntentId,
      stripeInvoiceId,
      description,
      metadata,
    } = params;

    const transactionId = uuidv4();

    await this.db.query(
      `INSERT INTO transactions (id, user_id, subscription_id, amount, currency, status, stripe_payment_intent_id, stripe_invoice_id, description, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        userId,
        subscriptionId || null,
        amount,
        currency.toUpperCase(),
        status,
        stripePaymentIntentId || null,
        stripeInvoiceId || null,
        description || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    this.logger.log(`Transaction ${transactionId} recorded for user ${userId}, amount: ${amount} ${currency}`);
  }

  /**
   * Handle a refund - revoke access and restore previous pack if it was an upgrade
   * Uses database transaction to ensure atomic operations
   * Returns information about what action was taken
   */
  async handleRefund(params: {
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    amountRefunded: number;
    currency: string;
  }): Promise<{ success: boolean; action: string; userId?: string; previousPackRestored?: string }> {
    const { stripePaymentIntentId, stripeChargeId, amountRefunded, currency } = params;

    // Find the transaction by payment intent ID (outside transaction - read only)
    let transaction = null;
    if (stripePaymentIntentId) {
      transaction = await this.db.queryOne(
        'SELECT * FROM transactions WHERE stripe_payment_intent_id = ?',
        [stripePaymentIntentId]
      );
    }

    if (!transaction) {
      this.logger.warn(`No transaction found for refund. PaymentIntent: ${stripePaymentIntentId}, Charge: ${stripeChargeId}`);
      return { success: false, action: 'no_transaction_found' };
    }

    const userId = transaction.user_id;

    // Find the active subscription for this user (outside transaction - read only)
    // IMPORTANT: Also check current_period_end > NOW() to ensure subscription hasn't expired
    const activeSubscription = await this.db.queryOne(
      `SELECT s.*, p.name as pack_name 
       FROM subscriptions s 
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND p.is_free = FALSE
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );

    // Use database transaction for all write operations
    const result = await this.db.withTransaction(async (tx) => {
      // Update the transaction status to REFUNDED
      await tx.execute(
        `UPDATE transactions SET status = 'REFUNDED', updated_at = NOW() WHERE id = ?`,
        [transaction.id]
      );
      this.logger.log(`Transaction ${transaction.id} marked as REFUNDED`);

      if (!activeSubscription) {
        this.logger.warn(`No active subscription found for user ${userId} during refund`);
        return { success: true, action: 'transaction_refunded_no_active_subscription', userId };
      }

      // Check if this was an upgrade
      const isUpgrade = activeSubscription.is_upgrade === 1;
      const previousPackId = activeSubscription.previous_pack_id;
      const previousSubscriptionId = activeSubscription.upgrade_from_subscription_id;

      // Cancel the current subscription
      await tx.execute(
        `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?`,
        [activeSubscription.id]
      );
      this.logger.log(`Cancelled subscription ${activeSubscription.id} due to refund`);

      // If this was an upgrade refund, restore the previous subscription
      if (isUpgrade && previousPackId) {
        // Get previous pack details
        const previousPack = await tx.queryOne('SELECT * FROM packs WHERE id = ?', [previousPackId]);
        
        if (previousPack && !previousPack.is_free) {
          // Get the previous subscription to copy its upgrade chain
          let previousSubUpgradeInfo = { is_upgrade: 0, previous_pack_id: null, upgrade_from_subscription_id: null };
          if (previousSubscriptionId) {
            const prevSub = await tx.queryOne(
              'SELECT is_upgrade, previous_pack_id, upgrade_from_subscription_id FROM subscriptions WHERE id = ?',
              [previousSubscriptionId]
            );
            if (prevSub) {
              previousSubUpgradeInfo = prevSub;
            }
          }

          // Create a new subscription for the previous pack, preserving its upgrade chain
          const newSubscriptionId = uuidv4();
          const now = new Date();
          // Calculate period end properly - handle month boundaries correctly
          const periodEnd = new Date(now);
          const currentDay = now.getDate();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          // If the day changed (month overflow), set to last day of the target month
          if (periodEnd.getDate() !== currentDay) {
            periodEnd.setDate(0);
          }

          await tx.execute(
            `INSERT INTO subscriptions (id, user_id, pack_id, previous_pack_id, status, stripe_subscription_id, current_period_start, current_period_end, is_upgrade, upgrade_from_subscription_id, created_at)
             VALUES (?, ?, ?, ?, 'ACTIVE', NULL, ?, ?, ?, ?, NOW())`,
            [
              newSubscriptionId, 
              userId, 
              previousPackId, 
              previousSubUpgradeInfo.previous_pack_id, 
              now, 
              periodEnd, 
              previousSubUpgradeInfo.is_upgrade, 
              previousSubUpgradeInfo.upgrade_from_subscription_id
            ]
          );
          
          this.logger.log(`Restored previous pack ${previousPack.name} for user ${userId} after upgrade refund`);
          
          return { 
            success: true, 
            action: 'upgrade_refunded_previous_pack_restored', 
            userId,
            previousPackRestored: previousPack.name,
            shouldKickFromTelegram: false
          };
        }
      }

      // For non-upgrade refunds, check if user has other active subscriptions before kicking
      return { 
        success: true, 
        action: 'subscription_cancelled', 
        userId,
        cancelledSubscriptionId: activeSubscription.id,
        shouldCheckOtherSubscriptions: true 
      };
    });

    // Cancel in Stripe AFTER the transaction commits (external service, can't rollback)
    if (activeSubscription?.stripe_subscription_id) {
      try {
        await this.stripeService.cancelSubscription(activeSubscription.stripe_subscription_id, true);
        this.logger.log(`Cancelled Stripe subscription ${activeSubscription.stripe_subscription_id}`);
      } catch (error) {
        this.logger.error(`Failed to cancel Stripe subscription: ${error.message}`);
        // Don't fail the refund - database is already updated
      }
    }

    // Check for other active subscriptions before kicking from Telegram
    // This handles the case where user has multiple subscriptions
    if ((result as any).shouldCheckOtherSubscriptions) {
      const otherActiveSubscriptions = await this.db.query(
        `SELECT s.id FROM subscriptions s
         JOIN packs p ON s.pack_id = p.id
         WHERE s.user_id = ? 
           AND s.status = 'ACTIVE' 
           AND s.current_period_end > NOW()
           AND p.is_free = FALSE
           AND s.id != ?`,
        [userId, (result as any).cancelledSubscriptionId]
      );

      // Only kick from Telegram if user has NO other active paid subscriptions
      if (otherActiveSubscriptions.length === 0) {
        try {
          const kicked = await this.telegramService.kickUserByUserId(userId);
          if (kicked) {
            this.logger.log(`User ${userId} kicked from VIP Telegram group after refund (no other active subscriptions)`);
          }
        } catch (telegramError) {
          this.logger.error(`Failed to kick user ${userId} from Telegram:`, telegramError);
          // Don't fail the refund - database is already updated
        }
      } else {
        this.logger.log(`User ${userId} still has ${otherActiveSubscriptions.length} other active subscription(s), not kicking from Telegram`);
      }
    }

    // Remove internal flags before returning
    const { shouldCheckOtherSubscriptions, cancelledSubscriptionId, ...returnResult } = result as any;
    return returnResult;
  }

  /**
   * Get subscription by payment intent ID (via transaction lookup)
   */
  async getSubscriptionByPaymentIntent(paymentIntentId: string): Promise<any | null> {
    const transaction = await this.db.queryOne(
      'SELECT * FROM transactions WHERE stripe_payment_intent_id = ?',
      [paymentIntentId]
    );

    if (!transaction || !transaction.subscription_id) {
      return null;
    }

    return this.db.queryOne(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?',
      [transaction.subscription_id]
    );
  }
}
