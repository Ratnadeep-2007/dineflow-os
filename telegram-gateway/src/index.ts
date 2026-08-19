import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { redis } from './session.js';
import { handleText, handleCallback } from './flow.js';

// ─── Validate env ─────────────────────────────────────────────
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token || token === 'your_bot_token_here') {
  console.error(
    '❌  TELEGRAM_BOT_TOKEN is not set!\n' +
    '   1. Open Telegram and talk to @BotFather\n' +
    '   2. Send /newbot, follow prompts\n' +
    '   3. Copy the token into telegram-gateway/.env',
  );
  process.exit(1);
}

// ─── Create bot ───────────────────────────────────────────────
const bot = new Telegraf(token);

// ─── Commands ─────────────────────────────────────────────────
bot.command('start', handleText);
bot.command('reset', handleText);
bot.command('checkout', handleText);

bot.command('help', async (ctx) => {
  await ctx.replyWithHTML(
    `<b>🍽️ DINE AI — Help</b>\n\n` +
    `<b>Commands:</b>\n` +
    `/start — Start a new order\n` +
    `/checkout — View cart & confirm order\n` +
    `/reset — Cancel and start over\n\n` +
    `<b>How it works:</b>\n` +
    `1. Choose order type (Dine In / Takeaway / Delivery)\n` +
    `2. Browse the menu via buttons or our digital menu link\n` +
    `3. For Dine In: tell us your party size\n` +
    `4. Confirm your order — we'll take it from there! 🎉`,
  );
});

bot.command('menu', async (ctx) => {
  await ctx.replyWithHTML(
    `🍽️ <b>Full Menu</b>\n\n` +
    `Browse our interactive digital menu:\n` +
    `🔗 <a href="${process.env.MENU_DASHBOARD_URL ?? 'http://localhost:5173/menu'}">Open Menu →</a>\n\n` +
    `Or use /start to place an order right here!`,
  );
});

// ─── All inline button presses ────────────────────────────────
bot.on('callback_query', handleCallback);

// ─── All free-text messages ───────────────────────────────────
bot.on('text', handleText);

// ─── Error handler ────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error(`[Bot] Error for ${ctx.updateType}:`, err);
  ctx.reply('⚠️ Something went wrong. Please try again or type /start.').catch(() => {});
});

// ─── Launch ───────────────────────────────────────────────────
async function start() {
  console.log('🚀 Starting DINE AI Telegram Bot...');

  // Connect Redis
  await redis.connect().catch((e) => {
    console.warn('[Redis] Could not connect:', e.message);
  });

  // Start bot with long-polling (no webhook needed for local dev)
  await bot.launch();

  const botInfo = await bot.telegram.getMe();
  console.log(`\n✅ DINE AI Bot is live!`);
  console.log(`📱 Username: @${botInfo.username}`);
  console.log(`🔗 Chat link: https://t.me/${botInfo.username}`);
  console.log(`\nShare this link with your customers! 👆\n`);
}

// ─── Graceful shutdown ────────────────────────────────────────
process.once('SIGINT',  () => { bot.stop('SIGINT');  redis.quit(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); redis.quit(); });

start().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
