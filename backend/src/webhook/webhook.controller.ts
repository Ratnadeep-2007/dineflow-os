import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebhookGuard } from './webhook.guard';
import { DatabaseService } from '../database/database.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @InjectQueue('webhook-processing') private readonly webhookQueue: Queue,
    private readonly databaseService: DatabaseService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookGuard)
  async handleWebhook(@Body() body: any) {
    this.logger.log('Received webhook payload');

    // Extract meta_message_id (idempotency key) and event type
    // Handles both raw Meta structure and flat mock payload for ease of testing
    const metaMessageId = this.getMetaMessageId(body);
    const eventType = this.getEventType(body);

    if (!metaMessageId) {
      this.logger.warn('Webhook payload is missing meta_message_id / message ID');
      // Still return 200 to Meta to avoid endless retries for bad payloads
      return { status: 'ignored', reason: 'Missing message ID' };
    }

    // 1. Idempotency check against database
    // per architecture.md Section 4, check-then-insert on meta_message_id before processing
    const duplicateCheck = await this.databaseService.query(
      `SELECT processing_status FROM webhook_events WHERE meta_message_id = $1`,
      [metaMessageId]
    );

    if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
      this.logger.log(`Duplicate webhook message detected (ID: ${metaMessageId}). Returning 200 fast.`);
      return { status: 'duplicate', metaMessageId };
    }

    // 2. Insert new event as RECEIVED in transaction or simple query
    try {
      await this.databaseService.query(
        `INSERT INTO webhook_events (meta_message_id, event_type, processing_status, raw_payload)
         VALUES ($1, $2, 'RECEIVED', $3)`,
        [metaMessageId, eventType, JSON.stringify(body)]
      );
      this.logger.log(`Logged webhook event: ${metaMessageId}`);
    } catch (dbError) {
      // In case of race conditions where unique constraint fires
      if (dbError.code === '23505') { // Postgres Unique Violation code
        this.logger.warn(`Race condition duplicate check fired on unique constraint for: ${metaMessageId}`);
        return { status: 'duplicate', metaMessageId };
      }
      throw dbError;
    }

    // 3. Defer processing to BullMQ queue
    // per architecture.md Section 4, return 200 fast, process asynchronously
    await this.webhookQueue.add('process-webhook', {
      metaMessageId,
      payload: body,
    });

    this.logger.log(`Enqueued job for webhook: ${metaMessageId}`);
    return { status: 'enqueued', metaMessageId };
  }

  // Extract unique message ID from WhatsApp Payload format or fallback flat field
  private getMetaMessageId(body: any): string | null {
    try {
      if (body.metaMessageId) return body.metaMessageId;
      return body.entry[0].changes[0].value.messages[0].id;
    } catch {
      return null;
    }
  }

  // Extract event type from WhatsApp payload or fallback
  private getEventType(body: any): string {
    try {
      if (body.eventType) return body.eventType;
      if (body.entry[0].changes[0].field) {
        return body.entry[0].changes[0].field;
      }
      return 'whatsapp_message';
    } catch {
      return 'unknown';
    }
  }
}
