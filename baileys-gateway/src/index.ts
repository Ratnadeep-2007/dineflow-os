import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessageKey,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { isMessageSeen, redis } from './session.js';
import { handleInbound } from './flow.js';

// ─── Logger setup (pretty-print in dev) ───────────────────────
const logger = pino({ level: 'info' });

// ─── Utility: extract JID phone number ────────────────────────
function phoneFromJid(jid: string): string {
  return jid.replace(/@.+$/, '').replace(/[^0-9]/g, '');
}

// ─── Utility: extract message body (text or button/list reply ID) ──
function extractBody(msg: any): string | null {
  const m = msg?.message;
  if (!m) return null;

  // Plain text
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;

  // Interactive button reply (native flow)
  if (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const parsed = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      if (parsed?.id) return parsed.id as string;
    } catch { /* ignore malformed JSON */ }
  }

  // List picker reply
  if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return m.listResponseMessage.singleSelectReply.selectedRowId as string;
  }

  // Template button reply
  if (m.templateButtonReplyMessage?.selectedId) {
    return m.templateButtonReplyMessage.selectedId as string;
  }

  // Button reply message (older WA format)
  if (m.buttonsResponseMessage?.selectedButtonId) {
    return m.buttonsResponseMessage.selectedButtonId as string;
  }

  return null;
}

// ════════════════════════════════════════════════════════════════
// MAIN — Boot the Baileys WhatsApp socket
// ════════════════════════════════════════════════════════════════
async function startBot() {
  // Fetch latest supported WA Web version from Baileys CDN
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Using WA version v${version.join('.')} — latest: ${isLatest}`);

  // Load multi-file auth state (stores session keys to ./auth_info/)
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    version,
    logger: logger.child({ module: 'baileys' }) as any,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger as any),
    },
    // Reduce unnecessary message history sync on first connect
    syncFullHistory: false,
    // Mark messages as read automatically (optional)
    markOnlineOnConnect: true,
    // Browser identity sent to WA servers
    browser: ['DineFlow Bot', 'Chrome', '120.0.0'],
    // Ignore status broadcast messages
    shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
  });

  // ── Persist credentials whenever they update ───────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Handle connection events ───────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Print QR to terminal for initial pairing
      const { default: qrcode } = await import('qrcode-terminal');
      logger.info('Scan the QR code below to log in:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn(`Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => startBot(), 3000); // retry after 3s
      } else {
        logger.error('Logged out from WhatsApp. Delete ./auth_info and restart to re-pair.');
        process.exit(1);
      }
    }

    if (connection === 'open') {
      logger.info('✅ WhatsApp bot connected and ready!');
    }
  });

  // ── Handle incoming messages ───────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Only process new messages, not historical
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        // Skip self-sent, status broadcast, and group messages
        if (msg.key.fromMe) continue;
        if (!msg.key.remoteJid) continue;
        if (msg.key.remoteJid.endsWith('@g.us')) continue; // skip groups

        const jid = msg.key.remoteJid;
        const phone = phoneFromJid(jid);
        const msgId = msg.key.id ?? 'unknown';

        // ── Idempotency check: skip duplicates ────────────────
        const alreadySeen = await isMessageSeen(msgId);
        if (alreadySeen) {
          logger.debug(`[Idempotency] Skipping duplicate message ${msgId}`);
          continue;
        }

        // ── Extract text or button reply ID ───────────────────
        const body = extractBody(msg);
        if (!body) {
          logger.debug(`[Message] No parseable body from ${phone}, ignoring`);
          continue;
        }

        logger.info(`[Inbound] ${phone}: "${body}"`);

        // ── Route through state machine ────────────────────────
        await handleInbound(sock, jid, body, phone);

      } catch (err) {
        logger.error({ err }, `[Error] Failed to process message from ${msg.key.remoteJid}`);
      }
    }
  });
}

// ─── Graceful shutdown ─────────────────────────────────────────
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await redis.quit();
  process.exit(0);
});

// ─── Boot ──────────────────────────────────────────────────────
startBot().catch((err) => {
  logger.error({ err }, 'Fatal error starting bot');
  process.exit(1);
});
