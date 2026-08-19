import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    
    this.client = new Redis({
      host,
      port,
      maxRetriesPerRequest: null, // Required for BullMQ compatibility
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis client error: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
    this.logger.log('Redis client disconnected');
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.error(`Redis get error (degraded mode): ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: string, expireInSeconds?: number): Promise<string> {
    try {
      if (expireInSeconds) {
        return await this.client.set(key, value, 'EX', expireInSeconds);
      }
      return await this.client.set(key, value);
    } catch (err) {
      this.logger.error(`Redis set error (degraded mode): ${err.message}`);
      return 'OK';
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (err) {
      this.logger.error(`Redis del error (degraded mode): ${err.message}`);
      return 0;
    }
  }

  // Set if Not Exists - useful for atomic distributed locks/state checks
  async setnx(key: string, value: string, expireInSeconds?: number): Promise<boolean> {
    try {
      let result: 'OK' | null;
      if (expireInSeconds) {
        result = await this.client.set(key, value, 'EX', expireInSeconds, 'NX');
      } else {
        result = await this.client.set(key, value, 'NX');
      }
      return result === 'OK';
    } catch (err) {
      this.logger.error(`Redis setnx error (degraded mode): ${err.message}`);
      return true; // Bypass lock in degraded mode to allow process flow
    }
  }
}
