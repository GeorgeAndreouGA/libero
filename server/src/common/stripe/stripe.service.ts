import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_API_KEY');
    
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured - Stripe payments will not work');
    }

    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2025-02-24.acacia',
    });

    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  /**
   * Create or retrieve a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string, email: string, name?: string): Promise<Stripe.Customer> {
    // First, try to find existing customer by email
    const existingCustomers = await this.stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      const existingCustomer = existingCustomers.data[0];
      
      // If the customer exists but has a different userId (e.g., user deleted account and re-registered),
      // update the customer's metadata to link to the new user
      if (existingCustomer.metadata?.userId !== userId) {
        this.logger.log(`Updating Stripe customer ${existingCustomer.id} metadata from userId ${existingCustomer.metadata?.userId} to ${userId}`);
        const updatedCustomer = await this.stripe.customers.update(existingCustomer.id, {
          metadata: {
            userId,
            previousUserId: existingCustomer.metadata?.userId || 'unknown',
          },
          name: name || existingCustomer.name || undefined,
        });
        return updatedCustomer;
      }
      
      return existingCustomer;
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      name: name || undefined,
      metadata: {
        userId,
      },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
    return customer;
  }

  /**
   * Anonymize a Stripe customer's email (for account deletion/GDPR compliance)
   * This prevents conflicts when a user re-registers with the same email
   */
  async anonymizeCustomer(stripeCustomerId: string): Promise<void> {
    try {
      const anonymousEmail = `deleted_${Date.now()}_${Math.random().toString(36).substring(7)}@deleted.local`;
      await this.stripe.customers.update(stripeCustomerId, {
        email: anonymousEmail,
        metadata: {
          deletedAt: new Date().toISOString(),
          status: 'account_deleted',
        },
      });
      this.logger.log(`Anonymized Stripe customer ${stripeCustomerId}`);
    } catch (error) {
      this.logger.error(`Failed to anonymize Stripe customer ${stripeCustomerId}: ${error.message}`);
      // Don't throw - we don't want to fail account deletion if Stripe update fails
    }
  }

  /**
   * Create a Stripe Checkout Session for a subscription
   */
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    packId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
    isUpgrade?: boolean;
    currentSubscriptionId?: string;
    oldPackName?: string;
    previousPackId?: string;
  }): Promise<Stripe.Checkout.Session> {
    const { customerId, priceId, packId, userId, successUrl, cancelUrl, isUpgrade, currentSubscriptionId, oldPackName, previousPackId } = params;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        packId,
        userId,
        isUpgrade: isUpgrade ? 'true' : 'false',
        currentSubscriptionId: currentSubscriptionId || '',
        oldPackName: oldPackName || '',
        previousPackId: previousPackId || '',
      },
      subscription_data: {
        metadata: {
          packId,
          userId,
        },
      },
      allow_promotion_codes: true,
      // Allow customer to select saved payment methods
      saved_payment_method_options: {
        payment_method_save: 'enabled',
      },
      // Lock customer email and name - prevent changes during checkout
      customer_update: {
        address: 'auto',
        name: 'never',
      },
    };

    const session = await this.stripe.checkout.sessions.create(sessionParams);
    this.logger.log(`Created checkout session ${session.id} for user ${userId}, pack ${packId}`);
    
    return session;
  }

  /**
   * Create a one-time payment checkout session (alternative to subscription)
   */
  async createOneTimeCheckoutSession(params: {
    customerId: string;
    packId: string;
    packName: string;
    priceAmount: number; // in cents (full price for subscription)
    upgradePriceAmount?: number; // in cents (price difference for upgrades - first payment only)
    currency: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
    isUpgrade?: boolean;
    currentSubscriptionId?: string;
    oldPackName?: string;
    previousPackId?: string;
  }): Promise<Stripe.Checkout.Session> {
    const { 
      customerId, packId, packName, priceAmount, upgradePriceAmount, currency, 
      userId, successUrl, cancelUrl, isUpgrade, currentSubscriptionId, oldPackName, previousPackId 
    } = params;

    // For upgrades, we charge only the difference as a one-time payment
    // and then create the subscription via webhook with a trial so the full price starts next month
    if (isUpgrade && upgradePriceAmount !== undefined && upgradePriceAmount > 0) {
      // Create a one-time payment checkout for the upgrade difference
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${packName} - Upgrade from ${oldPackName || 'current plan'}`,
                description: 'One-time upgrade fee (prorated difference for this month)',
              },
              unit_amount: upgradePriceAmount,
            },
            quantity: 1,
          },
        ],
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        // Save payment method for future subscription charges
        payment_intent_data: {
          setup_future_usage: 'off_session',
        },
        metadata: {
          packId,
          userId,
          isUpgrade: 'true',
          currentSubscriptionId: currentSubscriptionId || '',
          oldPackName: oldPackName || '',
          previousPackId: previousPackId || '',
          fullPriceAmount: priceAmount.toString(),
          upgradePriceAmount: upgradePriceAmount.toString(),
          createSubscriptionAfterPayment: 'true',
        },
        phone_number_collection: {
          enabled: false,
        },
        allow_promotion_codes: true,
        // Allow customer to select saved payment methods
        saved_payment_method_options: {
          payment_method_save: 'enabled',
        },
        // Lock customer email and name - prevent changes during checkout
        customer_update: {
          address: 'auto',
          name: 'never',
        },
      });

      this.logger.log(`Created upgrade payment session ${session.id} for user ${userId}, pack ${packId}, upgrade amount: ${upgradePriceAmount} cents`);
      return session;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: packName,
              description: `Monthly subscription to ${packName}`,
            },
            unit_amount: priceAmount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        packId,
        userId,
        isUpgrade: isUpgrade ? 'true' : 'false',
        currentSubscriptionId: currentSubscriptionId || '',
        oldPackName: oldPackName || '',
        previousPackId: previousPackId || '',
      },
      subscription_data: {
        metadata: {
          packId,
          userId,
        },
      },
      // Disable Stripe Link (no phone number collection)
      phone_number_collection: {
        enabled: false,
      },
      allow_promotion_codes: true,
      // Allow customer to select saved payment methods
      saved_payment_method_options: {
        payment_method_save: 'enabled',
      },
      // Lock customer email and name - prevent changes during checkout
      customer_update: {
        address: 'auto',
        name: 'never',
      },
    });

    this.logger.log(`Created one-time checkout session ${session.id} for user ${userId}, pack ${packId}`);
    return session;
  }

  /**
   * Create a Stripe product and price for a pack
   */
  async createProductAndPrice(params: {
    packId: string;
    name: string;
    description?: string;
    priceMonthly: number; // in main currency units (e.g., euros)
    currency: string;
  }): Promise<{ productId: string; priceId: string }> {
    const { packId, name, description, priceMonthly, currency } = params;

    // Create product
    const product = await this.stripe.products.create({
      name,
      description: description || undefined,
      metadata: {
        packId,
      },
    });

    // Create recurring price
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(priceMonthly * 100), // Convert to cents
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'month',
      },
      metadata: {
        packId,
      },
    });

    this.logger.log(`Created Stripe product ${product.id} and price ${price.id} for pack ${packId}`);
    return { productId: product.id, priceId: price.id };
  }

  /**
   * Cancel a Stripe subscription
   */
  async cancelSubscription(subscriptionId: string, immediately = false): Promise<Stripe.Subscription> {
    if (immediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    }
    
    // Cancel at period end
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Verify and construct webhook event
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Get Stripe instance for advanced operations
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }

  /**
   * Create a customer portal session for managing subscriptions
   * Uses a configuration that disables email/name updates
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    // Get or create a portal configuration that restricts customer info updates
    const configurationId = await this.getOrCreatePortalConfiguration();
    
    return await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      configuration: configurationId,
    });
  }

  /**
   * Get or create a Stripe Billing Portal configuration that restricts updates
   */
  private async getOrCreatePortalConfiguration(): Promise<string> {
    try {
      // List existing configurations
      const configurations = await this.stripe.billingPortal.configurations.list({ limit: 10 });
      
      // Look for our custom configuration
      const existingConfig = configurations.data.find(
        (config) => config.metadata?.app === 'libero' && config.is_default === false
      );
      
      if (existingConfig) {
        return existingConfig.id;
      }

      // Create a new configuration with restricted customer info updates
      const newConfig = await this.stripe.billingPortal.configurations.create({
        business_profile: {
          headline: 'Manage your subscription',
        },
        features: {
          customer_update: {
            enabled: false, // Disable all customer info updates (email, name, address)
          },
          invoice_history: {
            enabled: true,
          },
          payment_method_update: {
            enabled: true,
          },
          subscription_cancel: {
            enabled: false, // Disable self-cancellation
          },
        },
        metadata: {
          app: 'libero',
        },
      });

      this.logger.log(`Created new portal configuration: ${newConfig.id}`);
      return newConfig.id;
    } catch (error) {
      this.logger.error(`Failed to get/create portal configuration: ${error.message}`);
      // Fall back to default portal (without restrictions)
      throw error;
    }
  }

  /**
   * Retrieve a checkout session
   */
  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });
  }

  /**
   * Create a refund for a payment intent
   */
  async createRefund(paymentIntentId: string, reason?: string): Promise<Stripe.Refund> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        custom_reason: reason || 'Admin requested refund',
      },
    });

    this.logger.log(`Created refund ${refund.id} for payment intent ${paymentIntentId}`);
    return refund;
  }

  /**
   * Create a partial refund for a payment intent
   */
  async createPartialRefund(paymentIntentId: string, amountInCents: number, reason?: string): Promise<Stripe.Refund> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountInCents,
      reason: 'requested_by_customer',
      metadata: {
        custom_reason: reason || 'Admin requested partial refund',
      },
    });

    this.logger.log(`Created partial refund ${refund.id} (${amountInCents} cents) for payment intent ${paymentIntentId}`);
    return refund;
  }

  /**
   * Get refund by ID
   */
  async getRefund(refundId: string): Promise<Stripe.Refund> {
    return await this.stripe.refunds.retrieve(refundId);
  }

  /**
   * List customer's payment methods
   */
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  }

  /**
   * Detach a payment method from customer (delete saved card)
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);
    this.logger.log(`Detached payment method ${paymentMethodId}`);
    return paymentMethod;
  }

  /**
   * Get payment intent details
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Get invoice details
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await this.stripe.invoices.retrieve(invoiceId);
  }

  /**
   * Create a subscription with a trial period (for upgrades where the first payment was a one-time charge)
   */
  async createSubscriptionWithTrial(params: {
    customerId: string;
    packId: string;
    packName: string;
    priceAmount: number; // in cents
    currency: string;
    userId: string;
    trialDays: number;
    defaultPaymentMethodId?: string; // Use existing payment method to avoid duplicates
  }): Promise<Stripe.Subscription> {
    const { customerId, packId, packName, priceAmount, currency, userId, trialDays, defaultPaymentMethodId } = params;

    // First, create a price for the subscription
    const price = await this.stripe.prices.create({
      unit_amount: priceAmount,
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: packName,
        metadata: {
          packId,
        },
      },
    });

    // Create the subscription with trial
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [
        {
          price: price.id,
        },
      ],
      trial_period_days: trialDays,
      metadata: {
        packId,
        userId,
      },
    };

    // Use the default payment method if provided
    if (defaultPaymentMethodId) {
      subscriptionParams.default_payment_method = defaultPaymentMethodId;
    }

    const subscription = await this.stripe.subscriptions.create(subscriptionParams);

    this.logger.log(`Created subscription ${subscription.id} with ${trialDays}-day trial for customer ${customerId}`);
    return subscription;
  }
}
