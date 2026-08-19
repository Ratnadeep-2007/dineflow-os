import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import http from 'http';
import pino from 'pino';
import QRCode from 'qrcode';
import { isMessageSeen, redis } from './session.js';
import { handleInbound } from './flow.js';

// ─── Logger setup ─────────────────────────────────────────────
const logger = pino({ level: 'info' });

let latestQr: string | null = null;
let isConnected = false;

// ─── HTTP QR Code Web Page (For Crystal-Clear Mobile Scanning) ──
const PORT = process.env.PORT || 8080;
http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: isConnected ? 'connected' : 'waiting_for_scan' }));
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });

  if (isConnected) {
    return res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DineFlow WhatsApp Gateway</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b141a; color: #e9edef; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #111b21; border: 1px solid #222e35; border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            .badge { display: inline-block; background: #00a884; color: #111b21; font-weight: bold; padding: 8px 16px; border-radius: 20px; font-size: 14px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin: 0 0 10px; color: #e9edef; }
            p { color: #8696a0; font-size: 14px; line-height: 1.5; margin: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">🟢 BOT CONNECTED</div>
            <h1>WhatsApp Bot is Online!</h1>
            <p>Your WhatsApp number is successfully authenticated and receiving orders 24/7.</p>
          </div>
        </body>
      </html>
    `);
  }

  let qrImgHtml = '<p style="color: #8696a0; padding: 40px 0;">Generating latest QR code, please wait...</p>';
  if (latestQr) {
    try {
      const dataUrl = await QRCode.toDataURL(latestQr, { width: 320, margin: 2 });
      qrImgHtml = `<img src="${dataUrl}" style="width: 280px; height: 280px; border-radius: 12px; background: white; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" alt="WhatsApp QR Code" />`;
    } catch (e) {
      qrImgHtml = `<p style="color: red;">Error generating QR: ${e}</p>`;
    }
  }

  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Scan WhatsApp QR Code — DineFlow</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b141a; color: #e9edef; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #111b21; border: 1px solid #222e35; border-radius: 20px; padding: 36px 28px; text-align: center; max-width: 440px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
          .badge { display: inline-block; background: #f59e0b; color: #111b21; font-weight: bold; padding: 6px 14px; border-radius: 20px; font-size: 13px; margin-bottom: 18px; }
          h1 { font-size: 22px; margin: 0 0 8px; color: #e9edef; font-weight: 700; }
          p.sub { color: #8696a0; font-size: 14px; margin: 0 0 24px; }
          .qr-container { display: flex; justify-content: center; margin-bottom: 24px; }
          ol { text-align: left; background: #202c33; border-radius: 12px; padding: 16px 20px 16px 36px; margin: 0; font-size: 13px; color: #d1d7db; line-height: 1.6; }
          .footer { font-size: 12px; color: #667781; margin-top: 18px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">🟡 SCAN TO ACTIVATE</div>
          <h1>Link WhatsApp Account</h1>
          <p class="sub">Open WhatsApp on your phone to link this bot.</p>
          <div class="qr-container">
            ${qrImgHtml}
          </div>
          <ol>
            <li>Open <b>WhatsApp</b> on your phone</li>
            <li>Tap <b>Menu (⋮)</b> or <b>Settings</b> → <b>Linked Devices</b></li>
            <li>Tap <b>Link a Device</b> and point your camera at the QR code</li>
          </ol>
          <div class="footer">⏳ Page auto-refreshes every 5s with the latest active QR code.</div>
        </div>
      </body>
    </html>
  `);
}).listen(PORT, () => {
  logger.info(`Web QR page available on port ${PORT}`);
});

// ─── Utility: extract JID phone number ────────────────────────
function phoneFromJid(jid: string): string {
  return jid.replace(/@.+$/, '').replace(/[^0-9]/g, '');
}

// ─── Utility: extract message body (text or button/list reply ID) ──
function extractBody(msg: any): string | null {
  const m = msg?.message;
  if (!m) return null;

  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;

  if (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const parsed = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      if (parsed?.id) return parsed.id as string;
    } catch { /* ignore malformed JSON */ }
  }

  if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return m.listResponseMessage.singleSelectReply.selectedRowId as string;
  }

  if (m.templateButtonReplyMessage?.selectedId) {
    return m.templateButtonReplyMessage.selectedId as string;
  }

  if (m.buttonsResponseMessage?.selectedButtonId) {
    return m.buttonsResponseMessage.selectedButtonId as string;
  }

  return null;
}

// ════════════════════════════════════════════════════════════════
// MAIN — Boot the Baileys WhatsApp socket
// ════════════════════════════════════════════════════════════════
async function startBot() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Using WA version v${version.join('.')} — latest: ${isLatest}`);

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    version,
    logger: logger.child({ module: 'baileys' }) as any,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger as any),
    },
    syncFullHistory: false,
    markOnlineOnConnect: true,
    browser: ['DineFlow Bot', 'Chrome', '120.0.0'],
    shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQr = qr;
      isConnected = false;
      const { default: qrcode } = await import('qrcode-terminal');
      logger.info('Scan the QR code below (or open https://dineflow-whatsapp-bot.onrender.com/):');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn(`Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => startBot(), 3000);
      } else {
        logger.error('Logged out from WhatsApp. Delete ./auth_info and restart to re-pair.');
        process.exit(1);
      }
    }

    if (connection === 'open') {
      isConnected = true;
      latestQr = null;
      logger.info('✅ WhatsApp bot connected and ready!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        if (!msg.key.remoteJid) continue;
        if (msg.key.remoteJid.endsWith('@g.us')) continue;

        const jid = msg.key.remoteJid;
        const phone = phoneFromJid(jid);
        const msgId = msg.key.id ?? 'unknown';

        const alreadySeen = await isMessageSeen(msgId);
        if (alreadySeen) {
          logger.debug(`[Idempotency] Skipping duplicate message ${msgId}`);
          continue;
        }

        const body = extractBody(msg);
        if (!body) {
          logger.debug(`[Message] No parseable body from ${phone}, ignoring`);
          continue;
        }

        logger.info(`[Inbound] ${phone}: "${body}"`);
        await handleInbound(sock, jid, body, phone);

      } catch (err) {
        logger.error({ err }, `[Error] Failed to process message from ${msg.key.remoteJid}`);
      }
    }
  });
}

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await redis.quit();
  process.exit(0);
});

startBot().catch((err) => {
  logger.error({ err }, 'Fatal error starting bot');
  process.exit(1);
});
