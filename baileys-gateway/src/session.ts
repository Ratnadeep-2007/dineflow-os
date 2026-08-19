import Redis from 'ioredis';
import { UserSession, SESSION_TTL_SECONDS, STATES } from './constants.js';

let isRedisConnected = false;

// Memory fallback store if Redis is not running
const memoryStore = new Map<string, { session: UserSession; expiresAt: number }>();
const memorySeen = new Set<string>();

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) return null; // stop reconnect spam if Redis is down
    return Math.min(times * 500, 2000);
  },
});

redis.on('connect', () => {
  isRedisConnected = true;
  console.log('[Redis] Connected successfully');
});

redis.on('error', (err) => {
  isRedisConnected = false;
  // silent fallback to in-memory session cache
});

// Connect non-blocking
redis.connect().catch(() => {
  isRedisConnected = false;
  console.log('[Baileys] Redis not detected, using in-memory session cache (Active)');
});

const key = (phone: string) => `baily:session:${phone}`;

// ── Get or create a session ────────────────────────────────────
export async function getSession(phone: string): Promise<UserSession> {
  if (isRedisConnected) {
    try {
      const raw = await redis.get(key(phone));
      if (raw) return JSON.parse(raw) as UserSession;
    } catch {
      // fallback to memory
    }
  }

  // Check in-memory store
  const cached = memoryStore.get(phone);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }

  const fresh: UserSession = {
    state: STATES.IDLE,
    cart: [],
    createdAt: Date.now(),
  };
  await saveSession(phone, fresh);
  return fresh;
}

// ── Persist session with rolling TTL ──────────────────────────
export async function saveSession(phone: string, session: UserSession): Promise<void> {
  // Always update memory store
  memoryStore.set(phone, {
    session,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  });

  if (isRedisConnected) {
    try {
      await redis.setex(key(phone), SESSION_TTL_SECONDS, JSON.stringify(session));
    } catch {
      // ignore
    }
  }
}

// ── Wipe session (on completion or reset) ─────────────────────
export async function clearSession(phone: string): Promise<void> {
  memoryStore.delete(phone);
  if (isRedisConnected) {
    try {
      await redis.del(key(phone));
    } catch {
      // ignore
    }
  }
}

// ── Idempotency check ─────────────────────────────────────────
export async function isMessageSeen(msgId: string): Promise<boolean> {
  if (isRedisConnected) {
    try {
      const dedupKey = `baily:seen:${msgId}`;
      const result = await redis.set(dedupKey, '1', 'EX', 3600, 'NX');
      return result === null;
    } catch {
      // fallback
    }
  }

  if (memorySeen.has(msgId)) {
    return true;
  }
  memorySeen.add(msgId);
  // Keep memory set lean
  if (memorySeen.size > 2000) {
    const firstKey = memorySeen.values().next().value;
    if (firstKey) memorySeen.delete(firstKey);
  }
  return false;
}

export { redis };
