import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';

@Processor('webhook-processing')
export class WebhookProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessingProcessor.name);

  constructor(private databaseService: DatabaseService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { metaMessageId, payload } = job.data;
    this.logger.log(`Processing webhook job: ${job.id} for message ID: ${metaMessageId}`);

    try {
      // Stub: Here we will later run the NLU parsing, validation, and order management
      // For Phase 2, we just mark the event as PROCESSED in the database
      await this.databaseService.query(
        `UPDATE webhook_events 
         SET processing_status = 'PROCESSED' 
         WHERE meta_message_id = $1`,
        [metaMessageId]
      );

      this.logger.log(`Successfully processed message ID: ${metaMessageId}`);
      return { success: true, metaMessageId };
    } catch (error) {
      this.logger.error(`Failed to process message ID: ${metaMessageId}. Error: ${error.message}`);
      
      // Update status to FAILED in the database
      await this.databaseService.query(
        `UPDATE webhook_events 
         SET processing_status = 'FAILED' 
         WHERE meta_message_id = $1`,
        [metaMessageId]
      );
      
      throw error;
    }
  }
}
