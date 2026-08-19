import { Module, Global } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { NotificationService } from './notification.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
