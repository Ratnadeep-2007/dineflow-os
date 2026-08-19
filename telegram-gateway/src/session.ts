import Redis from 'ioredis';
import { UserSession, SESSION_TTL, STATES } from './constants.js';

let isRedisConnected = false;
const memoryStore = new Map<string, { session: UserSession; expiresAt: number }>();

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 500, 2000);
  },
});

redis.on('connect', () => {
  isRedisConnected = true;
});

redis.on('error', () => {
  isRedisConnected = false;
});

redis.connect().catch(() => {
  isRedisConnected = false;
});

const key = (telegramId: number) => `dineai:tg:session:${telegramId}`;

export async function getSession(
  telegramId: number,
  firstName?: string,
): Promise<UserSession> {
  const idStr = String(telegramId);
  if (isRedisConnected) {
    try {
      const raw = await redis.get(key(telegramId));
      if (raw) return JSON.parse(raw) as UserSession;
    } catch {
      // fallback
    }
  }

  const cached = memoryStore.get(idStr);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }

  const fresh: UserSession = {
    state: STATES.IDLE,
    cart: [],
    createdAt: Date.now(),
    firstName,
    telegramId,
  };
  await saveSession(fresh);
  return fresh;
}

export async function saveSession(session: UserSession): Promise<void> {
  const idStr = String(session.telegramId);
  memoryStore.set(idStr, {
    session,
    expiresAt: Date.now() + SESSION_TTL * 1000,
  });

  if (isRedisConnected) {
    try {
      await redis.setex(
        key(session.telegramId),
        SESSION_TTL,
        JSON.stringify(session),
      );
    } catch {
      // ignore
    }
  }
}

export async function clearSession(telegramId: number): Promise<void> {
  const idStr = String(telegramId);
  memoryStore.delete(idStr);
  if (isRedisConnected) {
    try {
      await redis.del(key(telegramId));
    } catch {
      // ignore
    }
  }
}
