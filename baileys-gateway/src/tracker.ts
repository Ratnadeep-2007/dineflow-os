import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default daily limit (can be overridden via MAX_DAILY_MESSAGES in .env)
export const MAX_DAILY_LIMIT = parseInt(process.env.MAX_DAILY_MESSAGES ?? '300', 10);

const DATA_DIR = path.resolve(__dirname, '../data');
const STATS_FILE = path.join(DATA_DIR, 'message_tracker.json');

export interface DailyStats {
  date: string;              // Format: YYYY-MM-DD
  totalSent: number;         // Count of messages sent today
  maxDailyLimit: number;     // Configured limit (e.g. 300)
  remaining: number;         // Remaining messages today
  lastSentTimestamp: string; // ISO string
  history?: Array<{ date: string; totalSent: number }>;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ensures data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Reads stats from disk or initializes a fresh record for today
 */
export function getTrackerStats(): DailyStats {
  ensureDataDir();
  const today = getTodayDateString();

  const defaultStats: DailyStats = {
    date: today,
    totalSent: 0,
    maxDailyLimit: MAX_DAILY_LIMIT,
    remaining: MAX_DAILY_LIMIT,
    lastSentTimestamp: new Date().toISOString(),
    history: [],
  };

  if (!fs.existsSync(STATS_FILE)) {
    saveTrackerStats(defaultStats);
    return defaultStats;
  }

  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    const stats: DailyStats = JSON.parse(raw);

    // If date changed to a new day, archive yesterday and reset today's counter
    if (stats.date !== today) {
      const history = stats.history || [];
      history.push({ date: stats.date, totalSent: stats.totalSent });

      // Keep up to 30 days of history
      if (history.length > 30) history.shift();

      const newStats: DailyStats = {
        date: today,
        totalSent: 0,
        maxDailyLimit: MAX_DAILY_LIMIT,
        remaining: MAX_DAILY_LIMIT,
        lastSentTimestamp: new Date().toISOString(),
        history,
      };

      saveTrackerStats(newStats);
      return newStats;
    }

    // Ensure limit and remaining stay accurate
    stats.maxDailyLimit = MAX_DAILY_LIMIT;
    stats.remaining = Math.max(0, MAX_DAILY_LIMIT - stats.totalSent);
    return stats;
  } catch (err) {
    console.error('[Tracker] Error reading stats file, resetting for today:', err);
    saveTrackerStats(defaultStats);
    return defaultStats;
  }
}

/**
 * Writes updated stats to disk
 */
export function saveTrackerStats(stats: DailyStats): void {
  ensureDataDir();
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Tracker] Error writing stats file:', err);
  }
}

/**
 * Checks if a message can be sent without exceeding the daily cap of 300
 */
export function canSendMessage(): { allowed: boolean; currentCount: number; remaining: number; maxLimit: number } {
  const stats = getTrackerStats();
  const allowed = stats.totalSent < stats.maxDailyLimit;
  return {
    allowed,
    currentCount: stats.totalSent,
    remaining: stats.remaining,
    maxLimit: stats.maxDailyLimit,
  };
}

/**
 * Increments the daily sent counter and saves to disk
 */
export function recordMessageSent(recipient?: string): { allowed: boolean; currentCount: number; remaining: number } {
  const stats = getTrackerStats();

  if (stats.totalSent >= stats.maxDailyLimit) {
    console.warn(`[Tracker ⚠️] DAILY MESSAGE LIMIT REACHED (${stats.totalSent}/${stats.maxDailyLimit})! Message blocked.`);
    return {
      allowed: false,
      currentCount: stats.totalSent,
      remaining: 0,
    };
  }

  stats.totalSent += 1;
  stats.remaining = Math.max(0, stats.maxDailyLimit - stats.totalSent);
  stats.lastSentTimestamp = new Date().toISOString();

  saveTrackerStats(stats);

  console.log(
    `[Tracker 📊] Message sent ${recipient ? `to ${recipient}` : ''} | Today: ${stats.totalSent}/${stats.maxDailyLimit} (Remaining: ${stats.remaining})`
  );

  return {
    allowed: true,
    currentCount: stats.totalSent,
    remaining: stats.remaining,
  };
}
