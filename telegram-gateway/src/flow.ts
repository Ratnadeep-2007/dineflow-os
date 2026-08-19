import type { Context } from 'telegraf';
import { getSession, saveSession, clearSession } from './session.js';
import { STATES, CB } from './constants.js';
import {
  sendWelcome,
  sendDineInMenu,
  sendTakeawayMenu,
  sendDeliveryPlatforms,
  sendDeliveryLink,
} from './messages.js';

function generateMenuToken(telegramId: number): string {
  return Buffer.from(`tg:${telegramId}:${Date.now()}`).toString('base64url');
}

function getUserId(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

function getUserName(ctx: Context): string {
  return ctx.from?.first_name ?? 'Guest';
}

// ══════════════════════════════════════════════════════════════
// TEXT MESSAGE HANDLER — /start, greetings, order types
// ══════════════════════════════════════════════════════════════
export async function handleText(ctx: Context) {
  const telegramId = getUserId(ctx);
  const name = getUserName(ctx);
  const text = (ctx.message as any)?.text?.trim() ?? '';
  const lower = text.toLowerCase();

  const session = await getSession(telegramId, name);

  // Dine In direct trigger
  if (['1', 'dine in', 'dinein', 'dine'].includes(lower)) {
    session.orderType = 'DINE_IN';
    session.menuToken = generateMenuToken(telegramId);
    session.state = STATES.DINE_IN_MENU;
    await saveSession(session);
    await sendDineInMenu(ctx, session.menuToken);
    return;
  }

  // Takeaway trigger
  if (['2', 'takeaway', 'take away', 'pickup'].includes(lower)) {
    session.orderType = 'TAKEAWAY';
    session.menuToken = generateMenuToken(telegramId);
    session.state = STATES.TAKEAWAY_MENU;
    await saveSession(session);
    await sendTakeawayMenu(ctx, session.menuToken);
    return;
  }

  // Delivery trigger
  if (['3', 'delivery', 'deliv'].includes(lower)) {
    session.orderType = 'DELIVERY';
    session.state = STATES.DELIVERY_PLATFORM;
    await saveSession(session);
    await sendDeliveryPlatforms(ctx);
    return;
  }

  // Default: welcome keyboard
  session.state = STATES.AWAITING_ORDER_TYPE;
  await saveSession(session);
  await sendWelcome(ctx, name);
}

// ══════════════════════════════════════════════════════════════
// CALLBACK QUERY HANDLER — inline buttons
// ══════════════════════════════════════════════════════════════
export async function handleCallback(ctx: Context) {
  const telegramId = getUserId(ctx);
  const name = getUserName(ctx);
  const data = (ctx as any).callbackQuery?.data as string ?? '';

  await ctx.answerCbQuery().catch(() => {});

  const session = await getSession(telegramId, name);

  if (data === CB.ORDER_DINE_IN) {
    session.orderType = 'DINE_IN';
    session.menuToken = generateMenuToken(telegramId);
    session.state = STATES.DINE_IN_MENU;
    await saveSession(session);
    await sendDineInMenu(ctx, session.menuToken);
    return;
  }

  if (data === CB.ORDER_TAKEAWAY) {
    session.orderType = 'TAKEAWAY';
    session.menuToken = generateMenuToken(telegramId);
    session.state = STATES.TAKEAWAY_MENU;
    await saveSession(session);
    await sendTakeawayMenu(ctx, session.menuToken);
    return;
  }

  if (data === CB.ORDER_DELIVERY) {
    session.orderType = 'DELIVERY';
    session.state = STATES.DELIVERY_PLATFORM;
    await saveSession(session);
    await sendDeliveryPlatforms(ctx);
    return;
  }

  if (data === CB.PLATFORM_ZOMATO) {
    await sendDeliveryLink(ctx, 'ZOMATO');
    await clearSession(telegramId);
    return;
  }
  if (data === CB.PLATFORM_SWIGGY) {
    await sendDeliveryLink(ctx, 'SWIGGY');
    await clearSession(telegramId);
    return;
  }
  if (data === CB.PLATFORM_DINEOUT) {
    await sendDeliveryLink(ctx, 'DINEOUT');
    await clearSession(telegramId);
    return;
  }
}
