import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import { CB } from './constants.js';

// ─── Helpers ──────────────────────────────────────────────────
const getMenuUrl = (token: string, mode: string) =>
  `${process.env.MENU_DASHBOARD_URL ?? 'http://localhost:5173/menu'}?token=${token}&src=telegram&mode=${mode}`;

// ─── 1. Welcome / Order type ──────────────────────────────────
export async function sendWelcome(ctx: Context, name: string) {
  await ctx.replyWithHTML(
    `👋 Welcome to <b>DINEFLOW</b>, ${name}!\n\n` +
    `🍽️ <i>Your smart digital restaurant assistant.</i>\n\n` +
    `Please choose how you would like to order:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🍽️  Dine In (Table Order)', CB.ORDER_DINE_IN)],
      [Markup.button.callback('🛍️  Take Away (Pickup)', CB.ORDER_TAKEAWAY)],
      [Markup.button.callback('🛵  Delivery Partners', CB.ORDER_DELIVERY)],
    ]),
  );
}

// ─── 2a. Dine In — Digital Menu Link ──────────────────────────
export async function sendDineInMenu(ctx: Context, token: string) {
  const url = getMenuUrl(token, 'dine_in');

  await ctx.replyWithHTML(
    `🍽️ <b>Dine In Selected!</b>\n\n` +
    `Please tap below to open our digital ordering kiosk to browse dishes, customize toppings & submit your order:\n\n` +
    `🔗 <a href="${url}"><b>Open Digital Menu →</b></a>\n\n` +
    `<i>Once submitted on the screen, your order ticket will be received by our kitchen immediately!</i>`,
    Markup.inlineKeyboard([
      [Markup.button.url('🍽️  Open Digital Menu', url)],
    ]),
  );
}

// ─── 2b. Takeaway — Digital Menu Link ─────────────────────────
export async function sendTakeawayMenu(ctx: Context, token: string) {
  const url = getMenuUrl(token, 'takeaway');

  await ctx.replyWithHTML(
    `🛍️ <b>Take Away Selected!</b>\n\n` +
    `Please tap below to open our digital ordering kiosk to pick your dishes & place your order:\n\n` +
    `🔗 <a href="${url}"><b>Browse Takeaway Menu →</b></a>\n\n` +
    `<i>Our kitchen will start preparing your order as soon as you submit on the screen!</i>`,
    Markup.inlineKeyboard([
      [Markup.button.url('🛍️  Open Takeaway Menu', url)],
    ]),
  );
}

// ─── 2c. Delivery — platform picker ──────────────────────────
export async function sendDeliveryPlatforms(ctx: Context) {
  await ctx.replyWithHTML(
    `🛵 <b>Delivery Selected!</b>\n\n` +
    `Choose your preferred delivery partner.\n` +
    `You'll be redirected to place and track your order:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔴  Order on Zomato',  CB.PLATFORM_ZOMATO)],
      [Markup.button.callback('🟠  Order on Swiggy',  CB.PLATFORM_SWIGGY)],
      [Markup.button.callback('🟢  Order on Dineout', CB.PLATFORM_DINEOUT)],
    ]),
  );
}

// ─── Delivery deeplink ────────────────────────────────────────
export async function sendDeliveryLink(
  ctx: Context,
  platform: 'ZOMATO' | 'SWIGGY' | 'DINEOUT',
) {
  const links: Record<string, string> = {
    ZOMATO:  process.env.ZOMATO_URL  ?? 'https://www.zomato.com',
    SWIGGY:  process.env.SWIGGY_URL  ?? 'https://www.swiggy.com',
    DINEOUT: process.env.DINEOUT_URL ?? 'https://www.dineout.co.in',
  };
  const labels: Record<string, string> = {
    ZOMATO:  '🔴 Zomato',
    SWIGGY:  '🟠 Swiggy',
    DINEOUT: '🟢 Dineout',
  };

  await ctx.replyWithHTML(
    `✅ Redirecting you to <b>${labels[platform]}</b>!\n\n` +
    `Tap the link below to complete your order, payment & tracking:\n` +
    `🔗 ${links[platform]}\n\n` +
    `<i>Your order is managed directly on the platform.</i>`,
    Markup.inlineKeyboard([
      [Markup.button.url(`Open ${labels[platform]}`, links[platform])],
    ]),
  );
}

// ─── Fallback ────────────────────────────────────────────────
export async function sendInvalidInput(ctx: Context) {
  await ctx.reply(
    `❓ I didn't understand that.\n\nUse the buttons above, or type /start to begin again.`,
  );
}
