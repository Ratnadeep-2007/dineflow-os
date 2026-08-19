import { Module } from '@nestjs/common';
import { TicketQueueController } from './ticket-queue.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [WebsocketModule, DatabaseModule, NotificationModule],
  controllers: [TicketQueueController],
})
export class TicketQueueModule {}
