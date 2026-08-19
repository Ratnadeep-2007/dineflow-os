import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ValidatorModule } from '../validator/validator.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { RedisModule } from '../redis/redis.module';
import { WhatsappFlowService } from './whatsapp-flow.service';

@Module({
  imports: [
    AiModule,
    ValidatorModule,
    WebsocketModule,
    RedisModule,
  ],
  providers: [WhatsappFlowService],
  exports: [WhatsappFlowService],
})
export class WhatsappFlowModule {}
