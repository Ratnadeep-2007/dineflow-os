import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
