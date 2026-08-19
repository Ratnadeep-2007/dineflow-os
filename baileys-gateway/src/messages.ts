import type { WASocket } from '@whiskeysockets/baileys';
import { recordMessageSent, canSendMessage } from './tracker.js';

// ─── Core Text Sender (Enforces 300 messages/day limit) ─────────
export async function sendText(
  sock: WASocket,
  jid: string,
  text: string,
): Promise<boolean> {
  const check = canSendMessage();
  if (!check.allowed) {
    console.error(
      `[QUOTA EXCEEDED 🛑] Daily limit of ${check.maxLimit} messages reached for today (${check.currentCount}/${check.maxLimit}). Skipping outbound message to ${jid} to protect account.`,
    );
    return false;
  }

  await sock.sendMessage(jid, { text });
  recordMessageSent(jid);
  return true;
}

// ── STEP 1: Welcome + Order Type selection ─────────────────────
export async function sendWelcome(sock: WASocket, jid: string): Promise<void> {
  await sendText(
    sock,
    jid,
    `👋 *Welcome to DINEFLOW!*\n\n` +
    `🍽️ _Your smart digital restaurant assistant._\n\n` +
    `How would you like to place your order today?\n\n` +
    `*1️⃣* 🍽️ *Dine In* (Table order & reservations)\n` +
    `*2️⃣* 🛍️ *Take Away* (Pickup order)\n` +
    `*3️⃣* 🛵 *Delivery* (Zomato / Swiggy / Dineout)\n\n` +
    `👉 _Reply with *1*, *2*, or *3*_`,
  );
}

// ── STEP 2a: Dine In → Clickable Menu Link Only ────────────────
export async function sendDineInMenu(
  sock: WASocket,
  jid: string,
  menuToken: string,
  phone: string,
): Promise<void> {
  const baseUrl = process.env.MENU_DASHBOARD_URL ?? 'https://dineflow-kiosk.vercel.app/menu';
  const menuUrl = `${baseUrl}?mode=dine_in&phone=${phone}`;

  await sendText(
    sock,
    jid,
    `🍽️ *Dine In Selected!*\n\n` +
    `Tap the link below to open our digital menu kiosk:\n\n` +
    `${menuUrl}\n\n` +
    `_Once submitted, our kitchen & host will receive your order immediately!_`,
  );
}

// ── STEP 2b: Take Away → Clickable Menu Link Only ──────────────
export async function sendTakeawayMenu(
  sock: WASocket,
  jid: string,
  menuToken: string,
  phone: string,
): Promise<void> {
  const baseUrl = process.env.MENU_DASHBOARD_URL ?? 'https://dineflow-kiosk.vercel.app/menu';
  const menuUrl = `${baseUrl}?mode=takeaway&phone=${phone}`;

  await sendText(
    sock,
    jid,
    `🛍️ *Take Away Selected!*\n\n` +
    `Tap the link below to open our digital takeaway menu:\n\n` +
    `${menuUrl}\n\n` +
    `_Once submitted, our kitchen will start preparing your order right away!_`,
  );
}

// ── STEP 2c: Delivery → Platform selection ─────────────────────
export async function sendDeliveryPlatforms(sock: WASocket, jid: string): Promise<void> {
  await sendText(
    sock,
    jid,
    `🛵 *Delivery Selected!*\n\n` +
    `Please choose your preferred delivery partner:\n\n` +
    `*1️⃣* 🔴 *Zomato*\n` +
    `*2️⃣* 🟠 *Swiggy*\n` +
    `*3️⃣* 🟢 *Dineout*\n\n` +
    `👉 _Reply with *1*, *2*, or *3*_`,
  );
}

// ── Delivery deeplink redirect ─────────────────────────────────
export async function sendDeliveryDeeplink(
  sock: WASocket,
  jid: string,
  platform: 'ZOMATO' | 'SWIGGY' | 'DINEOUT',
): Promise<void> {
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

  await sendText(
    sock,
    jid,
    `✅ *Redirecting you to ${labels[platform]}!*\n\n` +
    `Tap the link below to complete your order, payment & delivery tracking:\n\n` +
    `${links[platform]}\n\n` +
    `_Your order is managed directly on the platform._`,
  );
}

// ── Order placed notification (broadcast from backend) ─────────
export async function sendOrderConfirmed(sock: WASocket, jid: string, orderRef: string): Promise<void> {
  await sendText(
    sock,
    jid,
    `🎉 *Order Confirmed!*\n\n` +
    `Order reference: *#${orderRef}*\n\n` +
    `Thank you for ordering with *DineFlow*! 🍽️\n\n` +
    `_Type *Hi* or *Dinein* anytime to start a new order._`,
  );
}

// ── Invalid input fallback ────────────────────────────────────
export async function sendInvalidInput(sock: WASocket, jid: string): Promise<void> {
  await sendText(
    sock,
    jid,
    `❓ I didn't recognize that.\n\n` +
    `Reply with *1* for Dine In, *2* for Takeaway, *3* for Delivery, or type *Hi* to start over.`,
  );
}

// ── Reset message ─────────────────────────────────────────────
export async function sendResetMessage(sock: WASocket, jid: string): Promise<void> {
  await sendText(sock, jid, `🔄 Starting fresh!`);
}
