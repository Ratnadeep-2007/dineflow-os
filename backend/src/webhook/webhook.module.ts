import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';

@Module({
  imports: [ConfigModule, QueueModule],
  controllers: [WebhookController],
  providers: [WebhookGuard],
})
export class WebhookModule {}
