import type { WASocket } from '@whiskeysockets/baileys';
import { getSession, saveSession, clearSession } from './session.js';
import { STATES, BTN } from './constants.js';
import {
  sendWelcome,
  sendDineInMenu,
  sendTakeawayMenu,
  sendDeliveryPlatforms,
  sendDeliveryDeeplink,
} from './messages.js';

function generateMenuToken(phone: string): string {
  return Buffer.from(`${phone}:${Date.now()}`).toString('base64url');
}

// ════════════════════════════════════════════════════════════════
// MAIN ROUTER — called for every inbound WhatsApp message
// ════════════════════════════════════════════════════════════════
export async function handleInbound(
  sock: WASocket,
  jid: string,
  body: string,
  phone: string,
): Promise<void> {
  const session = await getSession(phone);
  
  // Clean input: lowercase, trim whitespace, strip punctuation
  const rawInput = body.trim().toLowerCase();
  const cleanInput = rawInput.replace(/[^\w\s]/gi, '').trim();

  console.log(`[Router 📥] Phone: ${phone} | Raw: "${rawInput}" | Clean: "${cleanInput}" | State: ${session.state}`);

  // ── 1. EXACT "DINEIN" TRIGGER ───────────────────────────────
  if (
    cleanInput === 'dinein' ||
    cleanInput === 'dine in' ||
    rawInput === '/dinein' ||
    rawInput === '/dine_in' ||
    rawInput === BTN.DINE_IN
  ) {
    session.orderType = 'DINE_IN';
    session.menuToken = generateMenuToken(phone);
    session.state = STATES.DINE_IN_MENU;
    await saveSession(phone, session);
    await sendDineInMenu(sock, jid, session.menuToken, phone);
    return;
  }

  // ── 2. EXACT "/BOT" ACTIVATION TRIGGER (Replaced "HI") ───────
  // ONLY triggers if user explicitly types "/bot" or "bot"
  if (
    rawInput === '/bot' ||
    cleanInput === 'bot' ||
    rawInput === '/start' ||
    rawInput === BTN.RESET
  ) {
    await clearSession(phone);
    const fresh = await getSession(phone);
    fresh.state = STATES.AWAITING_ORDER_TYPE;
    await saveSession(phone, fresh);
    await sendWelcome(sock, jid);
    return;
  }

  // ── 3. IF IDLE AND NOT /BOT OR DINEIN → STAY COMPLETELY SILENT ─
  if (session.state === STATES.IDLE) {
    console.log(`[Router 🤫] Ignoring unprompted message "${rawInput}" from ${phone} in IDLE state.`);
    return; // Do NOT respond to Hi, Hello, or any chatter
  }

  // ── 4. IF IN AWAITING_ORDER_TYPE STATE (user previously sent /bot) ─
  if (session.state === STATES.AWAITING_ORDER_TYPE) {
    if (cleanInput === '1' || cleanInput === 'dine in' || cleanInput === 'dinein') {
      session.orderType = 'DINE_IN';
      session.menuToken = generateMenuToken(phone);
      session.state = STATES.DINE_IN_MENU;
      await saveSession(phone, session);
      await sendDineInMenu(sock, jid, session.menuToken, phone);
      return;
    }

    if (cleanInput === '2' || cleanInput === 'takeaway' || cleanInput === 'take away') {
      session.orderType = 'TAKEAWAY';
      session.menuToken = generateMenuToken(phone);
      session.state = STATES.TAKEAWAY_MENU;
      await saveSession(phone, session);
      await sendTakeawayMenu(sock, jid, session.menuToken, phone);
      return;
    }

    if (cleanInput === '3' || cleanInput === 'delivery') {
      session.orderType = 'DELIVERY';
      session.state = STATES.DELIVERY_PLATFORM;
      await saveSession(phone, session);
      await sendDeliveryPlatforms(sock, jid);
      return;
    }

    // Ignore other text while awaiting choice
    return;
  }

  // ── 5. IF IN DELIVERY_PLATFORM STATE ─────────────────────────
  if (session.state === STATES.DELIVERY_PLATFORM) {
    if (cleanInput === '1' || cleanInput === 'zomato' || rawInput === BTN.ZOMATO) {
      await sendDeliveryDeeplink(sock, jid, 'ZOMATO');
      await clearSession(phone);
      return;
    }
    if (cleanInput === '2' || cleanInput === 'swiggy' || rawInput === BTN.SWIGGY) {
      await sendDeliveryDeeplink(sock, jid, 'SWIGGY');
      await clearSession(phone);
      return;
    }
    if (cleanInput === '3' || cleanInput === 'dineout' || rawInput === BTN.DINEOUT) {
      await sendDeliveryDeeplink(sock, jid, 'DINEOUT');
      await clearSession(phone);
      return;
    }

    return;
  }

  // ── 6. IF IN DINE_IN_MENU STATE ─────────────────────────────
  if (session.state === STATES.DINE_IN_MENU) {
    if (cleanInput === '2' || cleanInput === 'takeaway') {
      session.orderType = 'TAKEAWAY';
      session.menuToken = generateMenuToken(phone);
      session.state = STATES.TAKEAWAY_MENU;
      await saveSession(phone, session);
      await sendTakeawayMenu(sock, jid, session.menuToken, phone);
      return;
    }
    if (cleanInput === '3' || cleanInput === 'delivery') {
      session.orderType = 'DELIVERY';
      session.state = STATES.DELIVERY_PLATFORM;
      await saveSession(phone, session);
      await sendDeliveryPlatforms(sock, jid);
      return;
    }
    return;
  }

  // ── 7. IF IN TAKEAWAY_MENU STATE ────────────────────────────
  if (session.state === STATES.TAKEAWAY_MENU) {
    if (cleanInput === '1' || cleanInput === 'dinein' || cleanInput === 'dine in') {
      session.orderType = 'DINE_IN';
      session.menuToken = generateMenuToken(phone);
      session.state = STATES.DINE_IN_MENU;
      await saveSession(phone, session);
      await sendDineInMenu(sock, jid, session.menuToken, phone);
      return;
    }
    if (cleanInput === '3' || cleanInput === 'delivery') {
      session.orderType = 'DELIVERY';
      session.state = STATES.DELIVERY_PLATFORM;
      await saveSession(phone, session);
      await sendDeliveryPlatforms(sock, jid);
      return;
    }
    return;
  }
}
