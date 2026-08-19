import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly sessionWindowSeconds = 86400; // 24 hours

  constructor(private readonly redisService: RedisService) {}

  // Track customer last message timestamp in Redis (architecture.md Section 6)
  async recordInboundMessage(phone: string): Promise<void> {
    const key = `user:session_window:${phone}`;
    const now = Date.now().toString();
    await this.redisService.set(key, now, this.sessionWindowSeconds);
    this.logger.log(`Recorded inbound message window for customer: ${phone}`);
  }

  // Sends WhatsApp message - enforcing the 24h Meta policy window (architecture.md Section 6)
  async sendWhatsAppMessage(
    phone: string,
    text: string,
    templateName?: string,
    templateArgs?: string[]
  ): Promise<boolean> {
    const key = `user:session_window:${phone}`;
    const lastInboundStr = await this.redisService.get(key);
    const lastInbound = lastInboundStr ? parseInt(lastInboundStr, 10) : 0;
    const now = Date.now();

    const isWithin24h = (now - lastInbound) < (this.sessionWindowSeconds * 1000);

    if (isWithin24h) {
      // 1. Free-form messaging is allowed within 24h
      this.logger.log(`[OUTBOUND WHATSAPP] Sending free-form message to ${phone}: "${text}"`);
      // Stub: in production, call Meta Cloud API send-message endpoint here
      return true;
    } else {
      // 2. Outside 24h window - must route through a pre-approved template message
      if (!templateName) {
        // per architecture.md Section 6, log a warning and block free-form to avoid Meta policy violations
        this.logger.warn(
          `[META SECURITY BLOCK] Blocked sending free-form message to ${phone} outside 24h window. Text: "${text}".`
        );
        this.logger.warn(`TODO: Register pre-approved template for this scenario.`);
        return false;
      }

      this.logger.log(
        `[OUTBOUND WHATSAPP - TEMPLATE] Sending Meta template "${templateName}" to ${phone} with args: [${templateArgs?.join(', ')}]`
      );
      // Stub: in production, call Meta Cloud API send-template endpoint here
      return true;
    }
  }
}
