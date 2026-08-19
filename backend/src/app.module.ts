import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { WebhookModule } from './webhook/webhook.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { ValidatorModule } from './validator/validator.module';
import { NotificationModule } from './notification/notification.module';
import { WebsocketModule } from './websocket/websocket.module';
import { WhatsappFlowModule } from './whatsapp-flow/whatsapp-flow.module';
import { PaymentWebhookModule } from './payment-webhook/payment-webhook.module';
import { TicketQueueModule } from './ticket-queue/ticket-queue.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    WebhookModule,
    AuthModule,
    AiModule,
    ValidatorModule,
    NotificationModule,
    WebsocketModule,
    WhatsappFlowModule,
    PaymentWebhookModule,
    TicketQueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
