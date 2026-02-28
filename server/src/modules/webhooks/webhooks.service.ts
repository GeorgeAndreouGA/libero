import { Injectable, Logger } from '@nestjs/common';
import { StripeService } from '../../common/stripe/stripe.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmailService } from '../../common/email/email.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { DatabaseService } from '../../common/database/database.service';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly emailService: EmailService,
    private readonly telegramService: TelegramService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Handle incoming Stripe webhook events
   */
  async handleStripeWebhook(payload: Buffer, signature: string): Promise<void> {
    const event = this.stripeService.constructWebhookEvent(payload, signature);

    this.logger.log(`Received Stripe webhook event: ${event.type}`);

    // Log webhook event to database
    const webhookEventId = uuidv4();
    let processed = false;
    let error: string | null = null;

    try {
      // Insert webhook event with processed = false initially
      await this.db.query(
        `INSERT INTO webhook_events (id, provider, event_id, event_type, payload, processed, created_at)
         VALUES (?, 'stripe', ?, ?, ?, FALSE, NOW())
         ON DUPLICATE KEY UPDATE retry_count = retry_count + 1`,
        [webhookEventId, event.id, event.type, JSON.stringify(event)]
      );
    } catch (insertErr) {
      this.logger.warn(`Failed to log webhook event to database: ${insertErr.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(event.data.object as Stripe.Charge);
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
      processed = true;
    } catch (processErr) {
      error = processErr.message;
      throw processErr; // Re-throw to let controller handle it
    } finally {
      // Update webhook event as processed
      try {
        await this.db.query(
          `UPDATE webhook_events 
           SET processed = ?, processed_at = NOW(), error = ?
           WHERE event_id = ? AND provider = 'stripe'`,
          [processed, error, event.id]
        );
      } catch (updateErr) {
        this.logger.warn(`Failed to update webhook event status: ${updateErr.message}`);
      }
    }
  }

  /**
   * Handle successful checkout session completion
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    this.logger.log(`Processing checkout.session.completed for session ${session.id}, mode: ${session.mode}`);
    this.logger.log(`Session metadata: ${JSON.stringify(session.metadata)}`);
    this.logger.log(`Session subscription: ${session.subscription}, customer: ${session.customer}`);

    const metadata = session.metadata;
    if (!metadata?.userId || !metadata?.packId) {
      this.logger.error(`Missing userId or packId in session metadata. Full session: ${JSON.stringify({ id: session.id, metadata: session.metadata })}`);
      return;
    }

    const { userId, packId, isUpgrade, currentSubscriptionId, oldPackName } = metadata;

    // If this is an upgrade, cancel the old Stripe subscription
    if (isUpgrade === 'true' && currentSubscriptionId) {
      try {
        await this.stripeService.cancelSubscription(currentSubscriptionId, true);
        this.logger.log(`Cancelled old subscription ${currentSubscriptionId} for upgrade`);
      } catch (error) {
        this.logger.error(`Failed to cancel old subscription: ${error.message}`);
      }
    }

    // Get the subscription ID from the checkout session
    let stripeSubscriptionId = session.subscription as string;

    // Handle upgrade payment sessions (mode: 'payment' instead of 'subscription')
    // For upgrades, we need to create a subscription with a 30-day trial after the one-time payment
    if (session.mode === 'payment' && metadata.createSubscriptionAfterPayment === 'true') {
      this.logger.log(`Upgrade payment completed, creating subscription with trial for user ${userId}`);
      
      try {
        const fullPriceAmount = parseInt(metadata.fullPriceAmount || '0', 10);
        const customerId = session.customer as string;
        
        // Get the payment intent to find the payment method used
        let defaultPaymentMethodId: string | undefined;
        if (session.payment_intent) {
          try {
            const paymentIntent = await this.stripeService.getPaymentIntent(session.payment_intent as string);
            defaultPaymentMethodId = paymentIntent.payment_method as string;
            this.logger.log(`Found payment method ${defaultPaymentMethodId} from payment intent`);
          } catch (e) {
            this.logger.warn(`Could not get payment method from payment intent: ${e.message}`);
          }
        }
        
        // Create a subscription with a 30-day trial (so next charge is in 30 days at full price)
        const subscription = await this.stripeService.createSubscriptionWithTrial({
          customerId,
          packId,
          packName: oldPackName ? `Upgraded to new plan` : 'Subscription',
          priceAmount: fullPriceAmount,
          currency: session.currency || 'eur',
          userId,
          trialDays: 30,
          defaultPaymentMethodId, // Use the same payment method to avoid duplicates
        });
        
        stripeSubscriptionId = subscription.id;
        this.logger.log(`Created subscription ${stripeSubscriptionId} with 30-day trial for upgrade`);

        // Set subscription to cancel at period end (no auto-renewal)
        await this.stripeService.cancelSubscription(stripeSubscriptionId, false);
        this.logger.log(`Auto-renewal disabled for upgrade subscription ${stripeSubscriptionId}`);
      } catch (error) {
        this.logger.error(`Failed to create subscription after upgrade payment: ${error.message}`);
        // Still activate the subscription in our DB - user paid for this month
      }
    } else if (stripeSubscriptionId) {
      // IMPORTANT: Disable auto-renewal by default
      // Set the subscription to cancel at period end (no auto-renewal)
      try {
        await this.stripeService.cancelSubscription(stripeSubscriptionId, false); // false = cancel at period end, not immediately
        this.logger.log(`Auto-renewal disabled for subscription ${stripeSubscriptionId}`);
      } catch (error) {
        this.logger.error(`Failed to disable auto-renewal: ${error.message}`);
      }
    }

    // Activate the subscription in our database with upgrade info
    const upgradeInfo = isUpgrade === 'true' ? {
      isUpgrade: true,
      previousPackId: metadata.previousPackId,
      previousSubscriptionId: currentSubscriptionId,
    } : undefined;
    
    const subscriptionRecord = await this.subscriptionsService.activatePaidSubscription(userId, packId, stripeSubscriptionId, upgradeInfo);

    this.logger.log(`Activated subscription for user ${userId}, pack ${packId}${isUpgrade === 'true' ? ' (upgrade)' : ''}, internal ID: ${subscriptionRecord.id}`);

    // Record the transaction using the INTERNAL subscription ID (not Stripe's)
    try {
      const amountPaid = (session.amount_total || 0) / 100; // Convert from cents
      const currency = session.currency || 'eur';
      
      await this.subscriptionsService.recordTransaction({
        userId,
        subscriptionId: subscriptionRecord.id, // Use internal UUID, not Stripe subscription ID
        amount: amountPaid,
        currency,
        status: 'COMPLETED',
        stripePaymentIntentId: session.payment_intent as string || undefined,
        description: isUpgrade === 'true' 
          ? `Upgrade to pack ${packId} from ${oldPackName}` 
          : `Subscription to pack ${packId}`,
        metadata: {
          sessionId: session.id,
          packId,
          isUpgrade: isUpgrade === 'true',
          oldPackName: oldPackName || null,
          stripeSubscriptionId: stripeSubscriptionId || null,
        },
      });
      this.logger.log(`Transaction recorded for user ${userId}, subscription ${subscriptionRecord.id}`);
    } catch (txError) {
      this.logger.error(`Failed to record transaction: ${txError.message}`);
      // Don't throw - subscription was successful
    }

    // Send payment confirmation email
    try {
      const subscriptionDetails = await this.subscriptionsService.getSubscriptionDetailsForEmail(userId, packId);
      if (subscriptionDetails) {
        const amountPaid = (session.amount_total || 0) / 100; // Convert from cents
        const currency = (session.currency || 'eur').toUpperCase() === 'EUR' ? '€' : session.currency?.toUpperCase() || '€';
        
        await this.emailService.sendPaymentConfirmation(
          subscriptionDetails.email,
          subscriptionDetails.username,
          subscriptionDetails.packName,
          amountPaid,
          currency,
          subscriptionDetails.startDate,
          subscriptionDetails.endDate,
          isUpgrade === 'true',
          oldPackName,
          subscriptionDetails.preferredLanguage,
          subscriptionDetails.userId, // Pass userId for bot deep link generation
        );
        this.logger.log(`Payment confirmation email sent to ${subscriptionDetails.email}`);
      }
    } catch (emailError) {
      this.logger.error(`Failed to send payment confirmation email: ${emailError.message}`);
      // Don't throw - payment was successful, email failure shouldn't fail the webhook
    }
  }

  /**
   * Handle subscription created event
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Subscription created: ${subscription.id}`);
    // Most handling is done in checkout.session.completed
    // This is for subscriptions created outside of checkout (e.g., customer portal)
  }

  /**
   * Handle subscription updated event (e.g., renewal, plan change)
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);

    const existingSubscription = await this.subscriptionsService.getSubscriptionByStripeId(subscription.id);
    
    if (!existingSubscription) {
      this.logger.warn(`No local subscription found for Stripe subscription ${subscription.id}`);
      return;
    }

    // Update the subscription period only if valid timestamps are provided
    if (subscription.current_period_start && subscription.current_period_end) {
      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      // Validate the dates are reasonable (after year 2000)
      if (periodStart.getFullYear() >= 2000 && periodEnd.getFullYear() >= 2000) {
        await this.subscriptionsService.updateSubscriptionPeriod(
          subscription.id,
          periodStart,
          periodEnd
        );
        this.logger.log(`Updated subscription period for ${subscription.id}`);
      } else {
        this.logger.warn(`Invalid subscription period dates for ${subscription.id}: start=${periodStart}, end=${periodEnd}`);
      }
    } else {
      this.logger.warn(`Missing period timestamps for subscription ${subscription.id}`);
    }
  }

  /**
   * Handle subscription deleted/cancelled event
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Subscription deleted: ${subscription.id}`);

    await this.subscriptionsService.handleStripeSubscriptionCancelled(subscription.id);
  }

  /**
   * Handle successful invoice payment (subscription renewal)
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    this.logger.log(`Invoice paid: ${invoice.id}`);

    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) {
      this.logger.warn(`No subscription ID in invoice ${invoice.id}`);
      return;
    }

    const existingSubscription = await this.subscriptionsService.getSubscriptionByStripeId(subscriptionId);

    if (!existingSubscription) {
      this.logger.warn(`No local subscription found for Stripe subscription ${subscriptionId}`);
      return;
    }

    // Record the payment
    await this.subscriptionsService.recordPayment({
      userId: existingSubscription.user_id,
      subscriptionId: existingSubscription.id,
      amount: (invoice.amount_paid || 0) / 100, // Convert from cents
      currency: invoice.currency?.toUpperCase() || 'EUR',
      stripePaymentIntentId: invoice.payment_intent as string,
      stripeInvoiceId: invoice.id,
      status: 'COMPLETED',
    });

    this.logger.log(`Recorded payment for subscription ${subscriptionId}`);
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    this.logger.log(`Invoice payment failed: ${invoice.id}`);

    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) {
      this.logger.warn(`No subscription ID in failed invoice ${invoice.id}`);
      return;
    }

    const existingSubscription = await this.subscriptionsService.getSubscriptionByStripeId(subscriptionId);

    if (!existingSubscription) {
      return;
    }

    // Record the failed payment
    await this.subscriptionsService.recordPayment({
      userId: existingSubscription.user_id,
      subscriptionId: existingSubscription.id,
      amount: (invoice.amount_due || 0) / 100,
      currency: invoice.currency?.toUpperCase() || 'EUR',
      stripePaymentIntentId: invoice.payment_intent as string,
      stripeInvoiceId: invoice.id,
      status: 'FAILED',
    });

    // Get user info for admin notification
    const user = await this.subscriptionsService.getUserByStripeCustomerId(invoice.customer as string);
    if (user) {
      await this.emailService.sendAdminPaymentAlert(
        'charge_failed',
        user.email,
        user.id,
        (invoice.amount_due || 0) / 100,
        invoice.currency?.toUpperCase() || 'EUR',
        invoice.payment_intent as string || invoice.id,
        `Invoice payment failed for subscription ${subscriptionId}`
      );
    }

    this.logger.warn(`Payment failed for subscription ${subscriptionId}`);
  }

  /**
   * Handle failed charge - money may have been deducted but charge failed
   */
  private async handleChargeFailed(charge: Stripe.Charge): Promise<void> {
    this.logger.warn(`Charge failed: ${charge.id}`);

    // Get user info from customer
    const user = await this.subscriptionsService.getUserByStripeCustomerId(charge.customer as string);
    
    if (user) {
      await this.emailService.sendAdminPaymentAlert(
        'charge_failed',
        user.email,
        user.id,
        (charge.amount || 0) / 100,
        charge.currency?.toUpperCase() || 'EUR',
        charge.payment_intent as string || charge.id,
        `Charge failed. Failure code: ${charge.failure_code || 'unknown'}. Message: ${charge.failure_message || 'No message'}`
      );
    } else {
      // Still notify admin even without user info
      await this.emailService.sendAdminPaymentAlert(
        'charge_failed',
        charge.billing_details?.email || 'unknown',
        'unknown',
        (charge.amount || 0) / 100,
        charge.currency?.toUpperCase() || 'EUR',
        charge.payment_intent as string || charge.id,
        `Charge failed for unknown user. Customer ID: ${charge.customer}`
      );
    }
  }

  /**
   * Handle dispute created - customer disputed a charge
   */
  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    this.logger.warn(`Dispute created: ${dispute.id}`);

    // Get charge details
    const charge = dispute.charge as Stripe.Charge | string;
    const chargeId = typeof charge === 'string' ? charge : charge.id;
    
    // Try to get user info
    let userEmail = 'unknown';
    let userId = 'unknown';
    
    if (typeof charge !== 'string' && charge.customer) {
      const user = await this.subscriptionsService.getUserByStripeCustomerId(charge.customer as string);
      if (user) {
        userEmail = user.email;
        userId = user.id;
      }
    }

    await this.emailService.sendAdminPaymentAlert(
      'dispute_created',
      userEmail,
      userId,
      (dispute.amount || 0) / 100,
      dispute.currency?.toUpperCase() || 'EUR',
      chargeId,
      `Dispute reason: ${dispute.reason || 'unknown'}. Status: ${dispute.status}`
    );
  }

  /**
   * Handle charge refunded - revoke access and potentially restore previous pack
   */
  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.log(`Charge refunded: ${charge.id}, amount refunded: ${charge.amount_refunded}`);
    
    const paymentIntentId = charge.payment_intent as string;
    const amountRefunded = charge.amount_refunded || 0;
    const currency = charge.currency || 'eur';
    
    // Handle the refund in our system
    const result = await this.subscriptionsService.handleRefund({
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: charge.id,
      amountRefunded: amountRefunded / 100, // Convert from cents
      currency: currency.toUpperCase(),
    });
    
    if (result.success) {
      this.logger.log(`Refund handled: ${result.action}. User: ${result.userId || 'unknown'}`);
      if (result.previousPackRestored) {
        this.logger.log(`Previous pack restored: ${result.previousPackRestored}`);
      }
      
      // Send notification to admin about the refund
      try {
        const user = result.userId 
          ? await this.subscriptionsService.getUserByStripeCustomerId(charge.customer as string)
          : null;
        
        await this.emailService.sendAdminPaymentAlert(
          'refund_processed',
          user?.email || 'unknown',
          result.userId || 'unknown',
          amountRefunded / 100,
          currency.toUpperCase(),
          charge.id,
          `Refund processed. Action: ${result.action}. ${result.previousPackRestored ? `Previous pack restored: ${result.previousPackRestored}` : ''}`
        );
      } catch (emailError) {
        this.logger.error(`Failed to send refund notification email: ${emailError.message}`);
      }
    } else {
      this.logger.warn(`Refund could not be fully processed: ${result.action}`);
    }
  }

  /**
   * Handle incoming Telegram bot updates
   * This is used to capture user IDs when they interact with the bot
   */
  async handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
    this.logger.log(`Received Telegram update: ${JSON.stringify(update)}`);

    // Handle /start command with deep link (for linking accounts)
    if (update.message?.text?.startsWith('/start')) {
      await this.handleTelegramStartCommand(update.message);
      return;
    }

    // Handle new chat members (when user joins VIP group)
    if (update.message?.new_chat_members) {
      await this.handleNewChatMembers(update.message);
      return;
    }

    // Handle left chat member (when user leaves VIP group)
    if (update.message?.left_chat_member) {
      this.logger.log(`User left chat: ${update.message.left_chat_member.id}`);
      return;
    }
  }

  /**
   * Handle /start command with deep link parameter
   * Deep link format: /start link_<userId>
   * After linking, sends one-time VIP invite links to the user
   */
  private async handleTelegramStartCommand(message: TelegramMessage): Promise<void> {
    const text = message.text || '';
    const telegramUserId = message.from?.id?.toString();
    const firstName = message.from?.first_name || 'there';

    if (!telegramUserId) {
      this.logger.warn('No telegram user ID in start command');
      return;
    }

    // Check for deep link parameter (link_<userId>)
    const deepLinkMatch = text.match(/\/start\s+link_([a-f0-9-]+)/i);
    if (deepLinkMatch) {
      const appUserId = deepLinkMatch[1];
      this.logger.log(`Linking Telegram user ${telegramUserId} to app user ${appUserId}`);
      
      try {
        // First, update the user's telegram ID
        await this.telegramService.updateUserTelegramId(appUserId, telegramUserId);
        this.logger.log(`Successfully linked Telegram account for user ${appUserId}`);
        
        // Check if user has an active subscription
        const { hasSubscription, language } = await this.telegramService.userHasActiveSubscription(appUserId);
        
        if (hasSubscription) {
          // First, unban user from groups in case they were previously banned (e.g. subscription expired)
          // This allows them to rejoin with the new invite links
          await this.telegramService.unbanUserFromGroups(telegramUserId, language);
          this.logger.log(`Unbanned user ${telegramUserId} from VIP groups before sending new invite links`);

          // Generate one-time invite links for both VIP channel and community
          const [vipLink, communityLink] = await Promise.all([
            this.telegramService.createInviteLink(language),
            this.telegramService.createCommunityInviteLink(language),
          ]);

          // Build welcome message based on language
          const isGreek = language === 'el';
          let welcomeMessage = isGreek 
            ? `🎉 <b>Γεια σου ${firstName}!</b>\n\nΟ λογαριασμός σου συνδέθηκε επιτυχώς! ✅\n\n`
            : `🎉 <b>Hi ${firstName}!</b>\n\nYour account has been linked successfully! ✅\n\n`;

          welcomeMessage += isGreek
            ? `Ακολουθούν οι προσωπικοί σύνδεσμοι πρόσβασης VIP σου:\n\n`
            : `Here are your personal VIP access links:\n\n`;

          const buttons: Array<Array<{ text: string; url: string }>> = [];

          if (vipLink) {
            welcomeMessage += isGreek
              ? `💎 <b>VIP Κανάλι Tips:</b> Λάβε ειδοποιήσεις για όλα τα premium στοιχήματα\n`
              : `💎 <b>VIP Tips Channel:</b> Get notifications for all premium bets\n`;
            buttons.push([{ text: isGreek ? '💎 Είσοδος στο VIP Κανάλι' : '💎 Join VIP Channel', url: vipLink }]);
          }

          if (communityLink) {
            welcomeMessage += isGreek
              ? `💬 <b>VIP Κοινότητα:</b> Συνομίλησε με άλλα VIP μέλη\n`
              : `💬 <b>VIP Community:</b> Chat with other VIP members\n`;
            buttons.push([{ text: isGreek ? '💬 Είσοδος στην Κοινότητα' : '💬 Join VIP Community', url: communityLink }]);
          }

          welcomeMessage += isGreek
            ? `\n⚠️ <i>Αυτοί οι σύνδεσμοι είναι μόνο για εσένα και λήγουν μετά τη χρήση.</i>`
            : `\n⚠️ <i>These links are for you only and expire after use.</i>`;

          // Send the welcome message with VIP links
          await this.telegramService.sendDirectMessage(telegramUserId, welcomeMessage, 'HTML', buttons);
          this.logger.log(`Sent VIP links to Telegram user ${telegramUserId} for app user ${appUserId}`);
        } else {
          // No active subscription - just confirm linking
          const noSubMessage = language === 'el'
            ? `✅ <b>Λογαριασμός Συνδεδεμένος!</b>\n\nΓεια σου ${firstName}! Ο λογαριασμός Telegram σου συνδέθηκε επιτυχώς.\n\nΌταν αγοράσεις ένα πακέτο συνδρομής, θα λάβεις τους συνδέσμους πρόσβασης VIP εδώ!`
            : `✅ <b>Account Linked!</b>\n\nHi ${firstName}! Your Telegram account has been linked successfully.\n\nWhen you purchase a subscription pack, you'll receive your VIP access links here!`;
          
          await this.telegramService.sendDirectMessage(telegramUserId, noSubMessage, 'HTML');
          this.logger.log(`Account linked for ${appUserId} but no active subscription`);
        }
      } catch (error) {
        this.logger.error(`Failed to link Telegram account: ${error.message}`);
        
        // Send error message to user
        const errorMessage = `❌ Something went wrong while linking your account. Please try again or contact support.`;
        await this.telegramService.sendDirectMessage(telegramUserId, errorMessage, 'HTML');
      }
    } else {
      // Regular /start without deep link - send a generic welcome message
      const genericMessage = `👋 <b>Welcome to Libero Bets!</b>\n\nTo link your account and get VIP access, please click the link in your payment confirmation email.`;
      await this.telegramService.sendDirectMessage(telegramUserId, genericMessage, 'HTML');
    }
  }

  /**
   * Handle new members joining the chat
   * Validates that the user has an active subscription - kicks them if not
   * This prevents unauthorized access via shared/old invite links
   */
  private async handleNewChatMembers(message: TelegramMessage): Promise<void> {
    const newMembers = message.new_chat_members || [];
    const chatId = message.chat.id.toString();
    
    for (const member of newMembers) {
      // Skip bots
      if (member.is_bot) {
        continue;
      }

      const telegramUserId = member.id.toString();
      this.logger.log(`New member joined chat ${chatId}: ${telegramUserId} (${member.first_name})`);

      try {
        // Find user by telegram_user_id
        const user = await this.db.queryOne(
          `SELECT u.id, u.preferred_language 
           FROM users u 
           WHERE u.telegram_user_id = ?`,
          [telegramUserId]
        );

        if (!user) {
          // User not linked - kick them
          this.logger.warn(`Telegram user ${telegramUserId} not linked to any account - kicking from chat ${chatId}`);
          await this.kickUnauthorizedUser(telegramUserId, chatId, member.first_name);
          continue;
        }

        // Check if user has active paid subscription
        const { hasSubscription } = await this.telegramService.userHasActiveSubscription(user.id);

        if (!hasSubscription) {
          // User has no active subscription - kick them
          this.logger.warn(`User ${user.id} (Telegram: ${telegramUserId}) has no active subscription - kicking from chat ${chatId}`);
          await this.kickUnauthorizedUser(telegramUserId, chatId, member.first_name);
          continue;
        }

        this.logger.log(`User ${user.id} (Telegram: ${telegramUserId}) verified with active subscription - allowed in chat ${chatId}`);
      } catch (error) {
        this.logger.error(`Error validating new member ${telegramUserId}: ${error.message}`);
        // On error, kick the user to be safe - they can re-request access via bot
        await this.kickUnauthorizedUser(telegramUserId, chatId, member.first_name);
      }
    }
  }

  /**
   * Kick an unauthorized user from a chat and send them a message
   */
  private async kickUnauthorizedUser(telegramUserId: string, chatId: string, firstName: string): Promise<void> {
    try {
      // Ban the user from the chat (permanent until they re-subscribe)
      const banUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/banChatMember`;
      const banResponse = await fetch(banUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: parseInt(telegramUserId, 10),
        }),
      });

      const banResult = await banResponse.json();
      if (banResult.ok) {
        this.logger.log(`Banned unauthorized user ${telegramUserId} from chat ${chatId}`);
      } else {
        this.logger.error(`Failed to ban user ${telegramUserId}: ${banResult.description}`);
      }

      // Send a private message explaining why they were removed
      const message = `❌ <b>Access Denied</b>\n\nHi ${firstName}, you were removed from the VIP group because you don't have an active subscription.\n\n` +
        `To get access:\n` +
        `1. Purchase a subscription pack on our website\n` +
        `2. Click the Telegram link in your payment confirmation email\n` +
        `3. You'll receive new invite links here\n\n` +
        `If you believe this is an error, please contact support.`;
      
      await this.telegramService.sendDirectMessage(telegramUserId, message, 'HTML');
    } catch (error) {
      this.logger.error(`Error kicking unauthorized user ${telegramUserId}: ${error.message}`);
    }
  }
}

// Telegram update types
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}
