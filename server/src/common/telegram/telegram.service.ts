import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiBaseUrl: string;
  private readonly webhookUrl: string;
  private readonly webhookSecret: string;
  
  // English channels
  private readonly vipChatIdEn: string;
  private readonly publicChatIdEn: string;
  
  // Greek channels
  private readonly vipChatIdEl: string;
  private readonly publicChatIdEl: string;
  
  // VIP Community Chat Groups (for users to chat)
  private readonly vipCommunityChatIdEn: string;
  private readonly vipCommunityChatIdEl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL') || '';
    this.webhookSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET') || '';
    
    // English channels (default)
    this.vipChatIdEn = this.configService.get<string>('TELEGRAM_VIP_CHAT_ID') || '';
    this.publicChatIdEn = this.configService.get<string>('TELEGRAM_PUBLIC_CHAT_ID') || '';
    
    // Greek channels
    this.vipChatIdEl = this.configService.get<string>('TELEGRAM_VIP_CHAT_ID_EL') || '';
    this.publicChatIdEl = this.configService.get<string>('TELEGRAM_PUBLIC_CHAT_ID_EL') || '';
    
    // VIP Community Chat Groups
    this.vipCommunityChatIdEn = this.configService.get<string>('TELEGRAM_VIP_COMMUNITY_CHAT_ID') || '';
    this.vipCommunityChatIdEl = this.configService.get<string>('TELEGRAM_VIP_COMMUNITY_CHAT_ID_EL') || '';
    
    this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;

    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured');
    }
    if (!this.vipChatIdEn) {
      this.logger.warn('TELEGRAM_VIP_CHAT_ID (English) is not configured');
    }
    if (!this.vipChatIdEl) {
      this.logger.warn('TELEGRAM_VIP_CHAT_ID_EL (Greek) is not configured');
    }
    if (!this.publicChatIdEn) {
      this.logger.warn('TELEGRAM_PUBLIC_CHAT_ID (English) is not configured');
    }
    if (!this.publicChatIdEl) {
      this.logger.warn('TELEGRAM_PUBLIC_CHAT_ID_EL (Greek) is not configured');
    }
    if (!this.vipCommunityChatIdEn) {
      this.logger.warn('TELEGRAM_VIP_COMMUNITY_CHAT_ID (English) is not configured');
    }
    if (!this.vipCommunityChatIdEl) {
      this.logger.warn('TELEGRAM_VIP_COMMUNITY_CHAT_ID_EL (Greek) is not configured');
    }
  }

  /**
   * Automatically set up the Telegram webhook on app startup
   */
  async onModuleInit(): Promise<void> {
    if (!this.webhookUrl || !this.botToken) {
      this.logger.log('TELEGRAM_WEBHOOK_URL not configured, skipping automatic webhook setup');
      return;
    }

    try {
      const fullWebhookUrl = `${this.webhookUrl}/api/webhooks/telegram`;
      const url = `${this.apiBaseUrl}/setWebhook`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: fullWebhookUrl,
          secret_token: this.webhookSecret,
          allowed_updates: ['message', 'chat_member', 'my_chat_member'],
        }),
      });

      const result = await response.json();
      
      if (result.ok) {
        this.logger.log(`✅ Telegram webhook set to: ${fullWebhookUrl}`);
      } else {
        this.logger.error(`❌ Failed to set Telegram webhook: ${result.description}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error setting Telegram webhook: ${error.message}`);
    }
  }

  /**
   * Get VIP chat ID based on language
   */
  private getVipChatId(language: 'en' | 'el' = 'en'): string {
    return language === 'el' ? this.vipChatIdEl : this.vipChatIdEn;
  }

  /**
   * Get Public chat ID based on language
   */
  private getPublicChatId(language: 'en' | 'el' = 'en'): string {
    return language === 'el' ? this.publicChatIdEl : this.publicChatIdEn;
  }

  /**
   * Get VIP Community chat ID based on language
   */
  private getVipCommunityChatId(language: 'en' | 'el' = 'en'): string {
    return language === 'el' ? this.vipCommunityChatIdEl : this.vipCommunityChatIdEn;
  }

  /**
   * Check if Telegram integration is properly configured for VIP (at least one language)
   */
  isConfigured(language?: 'en' | 'el'): boolean {
    if (language) {
      const chatId = this.getVipChatId(language);
      return !!this.botToken && !!chatId;
    }
    // If no language specified, check if at least one VIP channel is configured
    return !!this.botToken && (!!this.vipChatIdEn || !!this.vipChatIdEl);
  }

  /**
   * Check if VIP Community chat is configured for a language
   */
  isCommunityChatConfigured(language?: 'en' | 'el'): boolean {
    if (language) {
      const chatId = this.getVipCommunityChatId(language);
      return !!this.botToken && !!chatId;
    }
    // If no language specified, check if at least one community chat is configured
    return !!this.botToken && (!!this.vipCommunityChatIdEn || !!this.vipCommunityChatIdEl);
  }

  /**
   * Check if Telegram integration is properly configured for Public channel
   */
  isPublicConfigured(language?: 'en' | 'el'): boolean {
    if (language) {
      const chatId = this.getPublicChatId(language);
      return !!this.botToken && !!chatId;
    }
    // If no language specified, check if at least one Public channel is configured
    return !!this.botToken && (!!this.publicChatIdEn || !!this.publicChatIdEl);
  }

  /**
   * Ban a user from the VIP Telegram group
   * User stays banned until they re-subscribe and go through the bot flow (which will unban them)
   * This prevents users from rejoining with old/shared invite links
   * @param telegramUserId - The Telegram user ID
   * @param language - The language of the VIP group to kick from (en or el)
   */
  async kickUserFromVipGroup(telegramUserId: string, language: 'en' | 'el' = 'en'): Promise<boolean> {
    if (!this.isConfigured(language)) {
      this.logger.warn(`Telegram VIP (${language}) is not configured, skipping kick`);
      return false;
    }

    if (!telegramUserId) {
      this.logger.warn('No Telegram user ID provided, skipping kick');
      return false;
    }

    const chatId = this.getVipChatId(language);

    try {
      // Ban the user - they stay banned until they re-subscribe
      // This prevents rejoining with old/shared invite links
      const banResponse = await this.banChatMember(telegramUserId, chatId);
      
      if (!banResponse.ok) {
        this.logger.error(`Failed to ban user ${telegramUserId} from ${language}: ${banResponse.description}`);
        return false;
      }

      this.logger.log(`Successfully banned user ${telegramUserId} from VIP group (${language})`);
      return true;
    } catch (error) {
      this.logger.error(`Error banning user ${telegramUserId} from VIP group (${language}):`, error);
      return false;
    }
  }

  /**
   * Ban a user from the VIP Community Chat group
   * User stays banned until they re-subscribe and go through the bot flow (which will unban them)
   * This prevents users from rejoining with old/shared invite links
   * @param telegramUserId - The Telegram user ID
   * @param language - The language of the community group to kick from (en or el)
   */
  async kickUserFromCommunityChat(telegramUserId: string, language: 'en' | 'el' = 'en'): Promise<boolean> {
    if (!this.isCommunityChatConfigured(language)) {
      this.logger.warn(`Telegram VIP Community (${language}) is not configured, skipping kick`);
      return false;
    }

    if (!telegramUserId) {
      this.logger.warn('No Telegram user ID provided, skipping community kick');
      return false;
    }

    const chatId = this.getVipCommunityChatId(language);

    try {
      // Ban the user - they stay banned until they re-subscribe
      // This prevents rejoining with old/shared invite links
      const banResponse = await this.banChatMember(telegramUserId, chatId);
      
      if (!banResponse.ok) {
        this.logger.error(`Failed to ban user ${telegramUserId} from community (${language}): ${banResponse.description}`);
        return false;
      }

      this.logger.log(`Successfully banned user ${telegramUserId} from VIP Community group (${language})`);
      return true;
    } catch (error) {
      this.logger.error(`Error banning user ${telegramUserId} from VIP Community group (${language}):`, error);
      return false;
    }
  }

  /**
   * Ban a chat member permanently (removes them from the group)
   * User stays banned until explicitly unbanned via unbanChatMember
   */
  private async banChatMember(telegramUserId: string, chatId: string): Promise<TelegramApiResponse> {
    const url = `${this.apiBaseUrl}/banChatMember`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: parseInt(telegramUserId, 10),
          // No until_date = permanent ban until manually unbanned
        }),
      });

      return await response.json();
    } catch (error) {
      this.logger.error('Ban API call failed:', error);
      return { ok: false, description: error.message };
    }
  }

  /**
   * Unban a chat member (allows them to rejoin)
   */
  private async unbanChatMember(telegramUserId: string, chatId: string): Promise<TelegramApiResponse> {
    const url = `${this.apiBaseUrl}/unbanChatMember`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: parseInt(telegramUserId, 10),
          only_if_banned: true,
        }),
      });

      return await response.json();
    } catch (error) {
      this.logger.error('Unban API call failed:', error);
      return { ok: false, description: error.message };
    }
  }

  /**
   * Unban a user from VIP group and Community chat
   * Called when user re-subscribes to allow them to join again
   * @param telegramUserId - The Telegram user ID
   * @param language - The language of the groups (en or el)
   */
  async unbanUserFromGroups(telegramUserId: string, language: 'en' | 'el' = 'en'): Promise<boolean> {
    if (!telegramUserId) {
      this.logger.warn('No Telegram user ID provided, skipping unban');
      return false;
    }

    let success = false;

    // Unban from VIP group
    if (this.isConfigured(language)) {
      const vipChatId = this.getVipChatId(language);
      const vipResult = await this.unbanChatMember(telegramUserId, vipChatId);
      if (vipResult.ok) {
        this.logger.log(`Successfully unbanned user ${telegramUserId} from VIP group (${language})`);
        success = true;
      } else {
        this.logger.warn(`Failed to unban user ${telegramUserId} from VIP group: ${vipResult.description}`);
      }
    }

    // Unban from VIP Community
    if (this.isCommunityChatConfigured(language)) {
      const communityChatId = this.getVipCommunityChatId(language);
      const communityResult = await this.unbanChatMember(telegramUserId, communityChatId);
      if (communityResult.ok) {
        this.logger.log(`Successfully unbanned user ${telegramUserId} from VIP Community (${language})`);
        success = true;
      } else {
        this.logger.warn(`Failed to unban user ${telegramUserId} from VIP Community: ${communityResult.description}`);
      }
    }

    return success;
  }

  /**
   * Get chat member info to check if user is in the group
   */
  async getChatMember(telegramUserId: string, language: 'en' | 'el' = 'en'): Promise<TelegramChatMember | null> {
    if (!this.isConfigured(language)) {
      return null;
    }

    const chatId = this.getVipChatId(language);
    const url = `${this.apiBaseUrl}/getChatMember`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: parseInt(telegramUserId, 10),
        }),
      });

      const data: TelegramApiResponse = await response.json();
      
      if (data.ok && data.result) {
        return data.result as TelegramChatMember;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Get chat member failed:', error);
      return null;
    }
  }

  /**
   * Update user's Telegram ID in the database
   */
  async updateUserTelegramId(userId: string, telegramUserId: string): Promise<void> {
    // First, clear this telegram_user_id from any OTHER accounts
    // This handles the case where a user deleted their account and created a new one
    // but the old account still had the telegram_user_id (shouldn't happen, but just in case)
    await this.databaseService.query(
      'UPDATE users SET telegram_user_id = NULL WHERE telegram_user_id = ? AND id != ?',
      [telegramUserId, userId],
    );
    
    // Now set the telegram_user_id on the current user
    await this.databaseService.query(
      'UPDATE users SET telegram_user_id = ? WHERE id = ?',
      [telegramUserId, userId],
    );
    this.logger.log(`Updated Telegram ID for user ${userId}: ${telegramUserId}`);
  }

  /**
   * Get user's Telegram ID from the database
   */
  async getUserTelegramId(userId: string): Promise<string | null> {
    const user = await this.databaseService.queryOne(
      'SELECT telegram_user_id FROM users WHERE id = ?',
      [userId],
    );
    return user?.telegram_user_id || null;
  }

  /**
   * Kick a user from VIP group AND VIP Community chat by their app user ID
   * Automatically determines the correct language group based on user's preferred language
   */
  async kickUserByUserId(userId: string): Promise<boolean> {
    // Get user's telegram ID and preferred language
    const user = await this.databaseService.queryOne(
      'SELECT telegram_user_id, preferred_language FROM users WHERE id = ?',
      [userId],
    );
    
    if (!user?.telegram_user_id) {
      this.logger.warn(`User ${userId} has no Telegram ID, skipping kick`);
      return false;
    }

    const language = (user.preferred_language === 'el' ? 'el' : 'en') as 'en' | 'el';
    
    // Kick from VIP group
    const vipKickResult = await this.kickUserFromVipGroup(user.telegram_user_id, language);
    
    // Also kick from VIP Community chat
    const communityKickResult = await this.kickUserFromCommunityChat(user.telegram_user_id, language);
    
    this.logger.log(`Kicked user ${userId} from VIP: ${vipKickResult}, Community: ${communityKickResult}`);
    
    // Return true if at least one kick was successful
    return vipKickResult || communityKickResult;
  }

  /**
   * Send a direct message to a Telegram user by their telegram_user_id
   * @param telegramUserId - The Telegram user ID to send the message to
   * @param message - The message text to send
   * @param parseMode - The parse mode for the message (HTML or Markdown)
   * @param inlineKeyboard - Optional inline keyboard buttons
   */
  async sendDirectMessage(
    telegramUserId: string,
    message: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML',
    inlineKeyboard?: Array<Array<{ text: string; url: string }>>
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('Telegram bot token not configured, cannot send DM');
      return false;
    }

    const url = `${this.apiBaseUrl}/sendMessage`;

    try {
      const body: any = {
        chat_id: telegramUserId,
        text: message,
        parse_mode: parseMode,
        link_preview_options: {
          is_disabled: true,
        },
      };

      if (inlineKeyboard && inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: inlineKeyboard.map(row => 
            row.map(button => ({ text: button.text, url: button.url }))
          ),
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: TelegramApiResponse = await response.json();

      if (!data.ok) {
        this.logger.error(`Failed to send DM to ${telegramUserId}: ${data.description}`);
        return false;
      }

      this.logger.log(`DM sent to Telegram user ${telegramUserId}`);
      return true;
    } catch (error) {
      this.logger.error(`Send DM failed:`, error);
      return false;
    }
  }

  /**
   * Generate an invite link for the VIP Community chat group
   * Creates a one-time use invite link for a specific user
   * NO static fallback - if we can't create a dynamic link, return null
   * This prevents link sharing abuse
   * @param language - The language of the community group (en or el)
   * @param expireDate - Optional expiration date for the invite link
   */
  async createCommunityInviteLink(language: 'en' | 'el' = 'en', expireDate?: Date): Promise<string | null> {
    if (!this.isCommunityChatConfigured(language)) {
      this.logger.warn(`VIP Community (${language}) is not configured, cannot create invite link`);
      return null;
    }

    const chatId = this.getVipCommunityChatId(language);
    const url = `${this.apiBaseUrl}/createChatInviteLink`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          member_limit: 1, // One-time use
          expire_date: expireDate 
            ? Math.floor(expireDate.getTime() / 1000) 
            : undefined,
        }),
      });

      const data: TelegramApiResponse = await response.json();
      
      if (data.ok && data.result?.invite_link) {
        this.logger.log(`Created community invite link for ${language}: ${data.result.invite_link}`);
        return data.result.invite_link;
      }
      
      this.logger.error(`Failed to create community invite link for ${language}:`, data.description);
      return null;
    } catch (error) {
      this.logger.error('Create community invite link failed:', error);
      return null;
    }
  }

  /**
   * Check if a user has an active paid subscription
   * @param userId - The app user ID to check
   */
  async userHasActiveSubscription(userId: string): Promise<{ hasSubscription: boolean; language: 'en' | 'el' }> {
    const result = await this.databaseService.queryOne(
      `SELECT s.id, u.preferred_language 
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN packs p ON s.pack_id = p.id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.current_period_end > NOW() AND p.is_free = FALSE
       LIMIT 1`,
      [userId]
    );
    
    return {
      hasSubscription: !!result,
      language: (result?.preferred_language === 'el' ? 'el' : 'en') as 'en' | 'el',
    };
  }

  /**
   * Get VIP Community invite link based on user's language
   * Returns the static link from environment variables
   * @param language - The language of the community group (en or el)
   */
  getVipCommunityLink(language: 'en' | 'el' = 'en'): string | null {
    if (language === 'el') {
      return this.configService.get<string>('TELEGRAM_VIP_COMMUNITY_LINK_EL') || 
             this.configService.get<string>('TELEGRAM_VIP_COMMUNITY_LINK') || null;
    }
    return this.configService.get<string>('TELEGRAM_VIP_COMMUNITY_LINK') || null;
  }

  /**
   * Generate an invite link for the VIP group
   * This creates a one-time use invite link for a specific user
   * NO static fallback - if we can't create a dynamic link, return null
   * This prevents link sharing abuse
   * @param language - The language of the VIP group (en or el)
   * @param expireDate - Optional expiration date for the invite link
   */
  async createInviteLink(language: 'en' | 'el' = 'en', expireDate?: Date): Promise<string | null> {
    if (!this.isConfigured(language)) {
      this.logger.warn(`VIP group (${language}) is not configured, cannot create invite link`);
      return null;
    }

    const chatId = this.getVipChatId(language);
    const url = `${this.apiBaseUrl}/createChatInviteLink`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          member_limit: 1, // One-time use
          expire_date: expireDate 
            ? Math.floor(expireDate.getTime() / 1000) 
            : undefined,
        }),
      });

      const data: TelegramApiResponse = await response.json();
      
      if (data.ok && data.result?.invite_link) {
        this.logger.log(`Created VIP invite link for ${language}: ${data.result.invite_link}`);
        return data.result.invite_link;
      }
      
      this.logger.error(`Failed to create invite link for ${language}:`, data.description);
      return null;
    } catch (error) {
      this.logger.error('Create invite link failed:', error);
      return null;
    }
  }

  /**
   * Send a message to a specific VIP Telegram group by language
   */
  async sendMessageToVip(
    message: string, 
    language: 'en' | 'el' = 'en', 
    parseMode: 'HTML' | 'Markdown' = 'HTML',
    inlineKeyboard?: Array<Array<{ text: string; url: string }>>
  ): Promise<boolean> {
    if (!this.isConfigured(language)) {
      this.logger.warn(`Telegram VIP (${language}) is not configured, skipping message`);
      return false;
    }

    const chatId = this.getVipChatId(language);
    return this.sendMessage(chatId, message, parseMode, inlineKeyboard);
  }

  /**
   * Send a message to a specific Public Telegram channel by language
   */
  async sendMessageToPublic(
    message: string, 
    language: 'en' | 'el' = 'en', 
    parseMode: 'HTML' | 'Markdown' = 'HTML',
    inlineKeyboard?: Array<Array<{ text: string; url: string }>>
  ): Promise<boolean> {
    if (!this.isPublicConfigured(language)) {
      this.logger.warn(`Telegram Public (${language}) is not configured, skipping message`);
      return false;
    }

    const chatId = this.getPublicChatId(language);
    return this.sendMessage(chatId, message, parseMode, inlineKeyboard);
  }

  /**
   * Send a message to ALL VIP Telegram groups (both EN and EL)
   */
  async sendMessageToAllVip(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<{ en: boolean; el: boolean }> {
    const [en, el] = await Promise.all([
      this.sendMessageToVip(message, 'en', parseMode),
      this.sendMessageToVip(message, 'el', parseMode),
    ]);
    return { en, el };
  }

  /**
   * Send a message to ALL Public Telegram channels (both EN and EL)
   */
  async sendMessageToAllPublic(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<{ en: boolean; el: boolean }> {
    const [en, el] = await Promise.all([
      this.sendMessageToPublic(message, 'en', parseMode),
      this.sendMessageToPublic(message, 'el', parseMode),
    ]);
    return { en, el };
  }

  /**
   * Send a message to a specific chat with optional inline keyboard
   */
  private async sendMessage(
    chatId: string, 
    message: string, 
    parseMode: 'HTML' | 'Markdown' = 'HTML',
    inlineKeyboard?: Array<Array<{ text: string; url: string }>>
  ): Promise<boolean> {
    const url = `${this.apiBaseUrl}/sendMessage`;

    try {
      const body: any = {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        link_preview_options: {
          is_disabled: true, // Disable link preview but keep links clickable
        },
      };

      // Add inline keyboard if provided
      if (inlineKeyboard && inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: inlineKeyboard.map(row => 
            row.map(button => ({ text: button.text, url: button.url }))
          ),
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: TelegramApiResponse = await response.json();

      if (!data.ok) {
        this.logger.error(`Failed to send message to ${chatId}: ${data.description}`);
        return false;
      }

      this.logger.log(`Message sent to chat ${chatId}`);
      return true;
    } catch (error) {
      this.logger.error(`Send message failed:`, error);
      return false;
    }
  }

  /**
   * Send a bet notification to appropriate Telegram channels (both languages)
   * Routing is determined by the category's pack membership:
   * - VIP pack categories → VIP channels (both EN and EL)
   * - Free pack categories → Public channels (both EN and EL)
   * - Categories in both → Both channels
   * @param bet - The bet object with all details
   * @param category - The category object
   * @param packs - Array of packs that have access to this category (with displayOrder for diamond hierarchy)
   * @param sendToVip - Whether to send to VIP groups (both languages)
   * @param sendToPublic - Whether to send to Public channels (both languages)
   */
  async sendBetNotification(
    bet: {
      odds?: string;
      match?: any;
      analysis?: string;
    },
    category: {
      name: string;
      nameEl?: string;
      standardBet?: number;
    },
    packs: Array<{ id: string; name: string; isFree: boolean; displayOrder: number }>,
    sendToVip: boolean,
    sendToPublic: boolean,
  ): Promise<{ vipEn: boolean; vipEl: boolean; publicEn: boolean; publicEl: boolean }> {
    const result = { vipEn: false, vipEl: false, publicEn: false, publicEl: false };
    const siteUrl = this.configService.get<string>('FRONTEND_URL') || '';

    // Only add inline keyboard if we have a valid public URL (not localhost)
    const isValidUrl = siteUrl && !siteUrl.includes('localhost') && siteUrl.startsWith('https://');
    const keyboardEn = isValidUrl ? [[{ text: '🔗 Click here', url: siteUrl }]] : undefined;
    const keyboardEl = isValidUrl ? [[{ text: '🔗 Κάνε κλικ εδώ', url: siteUrl }]] : undefined;

    // Send to both VIP channels (EN and EL)
    if (sendToVip) {
      const vipMessageEn = this.formatVipMessage(category, packs, 'en');
      const vipMessageEl = this.formatVipMessage(category, packs, 'el');
      const [vipEn, vipEl] = await Promise.all([
        this.sendMessageToVip(vipMessageEn, 'en', 'HTML', keyboardEn),
        this.sendMessageToVip(vipMessageEl, 'el', 'HTML', keyboardEl),
      ]);
      result.vipEn = vipEn;
      result.vipEl = vipEl;
    }

    // Send to both Public channels (EN and EL) - only for free categories
    if (sendToPublic) {
      const publicMessageEn = this.formatPublicMessage(category, 'en');
      const publicMessageEl = this.formatPublicMessage(category, 'el');
      const [publicEn, publicEl] = await Promise.all([
        this.sendMessageToPublic(publicMessageEn, 'en', 'HTML', keyboardEn),
        this.sendMessageToPublic(publicMessageEl, 'el', 'HTML', keyboardEl),
      ]);
      result.publicEn = publicEn;
      result.publicEl = publicEl;
    }

    return result;
  }

  /**
   * Generate diamond string based on pack display order
   * Higher display_order = more diamonds (hierarchy based)
   * Free packs (display_order 1) = no diamonds
   */
  private getDiamondsForPack(displayOrder: number, isFree: boolean): string {
    if (isFree) return ''; // No diamonds for free packs
    // displayOrder starts at 1 (free), so VIP packs start at 2
    // Subtract 1 to get diamond count (Silver=1, Gold=2, Elite=3, etc.)
    const diamondCount = Math.max(0, displayOrder - 1);
    return '💎'.repeat(diamondCount);
  }

  /**
   * Format a Telegram message for Public (free) channels
   * Format: 📢 Μόλις ανέβηκε ένα <b>Live</b> Bet για <b>ΟΛΟΥΣ</b>!
   */
  private formatPublicMessage(
    category: {
      name: string;
      nameEl?: string;
      standardBet?: number;
    },
    language: 'en' | 'el' = 'en',
  ): string {
    const categoryDisplayName = language === 'el' && category.nameEl ? category.nameEl : category.name;

    if (language === 'el') {
      return `📢 Μόλις ανέβηκε ένα <b>${categoryDisplayName} Bet</b> για <b>ΟΛΟΥΣ</b>!`;
    } else {
      return `📢 A new <b>${categoryDisplayName} Bet</b> has been uploaded for <b>EVERYONE</b>!`;
    }
  }

  /**
   * Format a Telegram message for VIP channels (with diamonds)
   * Format: 💎💎\n\nΈνα νέο <b>UFC VIP</b> ανέβηκε στο <b>VIP Gold</b>!
   */
  private formatVipMessage(
    category: {
      name: string;
      nameEl?: string;
      standardBet?: number;
    },
    packs: Array<{ id: string; name: string; isFree: boolean; displayOrder: number }>,
    language: 'en' | 'el' = 'en',
  ): string {
    const lines: string[] = [];

    // Get non-free packs sorted by display_order for diamond display
    const vipPacks = packs.filter(p => !p.isFree).sort((a, b) => a.displayOrder - b.displayOrder);

    // Add diamonds for each VIP pack (one line per pack, lowest tier first)
    vipPacks.forEach(pack => {
      const diamonds = this.getDiamondsForPack(pack.displayOrder, pack.isFree);
      if (diamonds) {
        lines.push(diamonds);
      }
    });

    // Add empty line after diamonds if there were any
    if (vipPacks.length > 0) {
      lines.push('');
    }

    const categoryDisplayName = language === 'el' && category.nameEl ? category.nameEl : category.name;
    const packNamesString = vipPacks.map(p => `<b>${p.name}</b>`).join(', ');

    if (language === 'el') {
      lines.push(`Ένα νέο <b>${categoryDisplayName}</b> ανέβηκε στο ${packNamesString}!`);
    } else {
      lines.push(`A new <b>${categoryDisplayName}</b> bet has been uploaded to ${packNamesString}!`);
    }

    return lines.join('\n');
  }
}

// Telegram API response types
interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  result?: any;
}

interface TelegramChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
}
