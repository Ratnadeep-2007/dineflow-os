import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import http from 'http';
import url from 'url';
import pino from 'pino';
import QRCode from 'qrcode';
import { isMessageSeen, redis } from './session.js';
import { handleInbound } from './flow.js';

// ─── Logger setup ─────────────────────────────────────────────
const logger = pino({ level: 'info' });

let latestQr: string | null = null;
let isConnected = false;
let currentSock: any = null;

// ─── HTTP Server: Live High-Res QR + Pairing Code + Health ─────
const PORT = process.env.PORT || 8080;
http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // 1. Health check JSON endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: isConnected ? 'connected' : 'waiting_for_scan' }));
  }

  // 2. Real-time QR API (Flicker-Free Smooth Polling)
  if (pathname === '/api/qr') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    let qrDataUrl: string | null = null;
    if (latestQr && !isConnected) {
      try {
        qrDataUrl = await QRCode.toDataURL(latestQr, {
          errorCorrectionLevel: 'H',
          margin: 3,
          scale: 10,
          width: 400,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
      } catch (err) {
        logger.error({ err }, 'Error creating QR data URL');
      }
    }
    return res.end(JSON.stringify({
      isConnected,
      hasQr: !!latestQr,
      qrDataUrl,
      timestamp: Date.now(),
    }));
  }

  // 3. Pairing Code API (Enter phone number to get 8-digit WhatsApp code)
  if (pathname === '/api/pair-code') {
    const rawPhone = (parsedUrl.query.phone as string) || process.env.RESTAURANT_PHONE || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Please provide a valid phone number with country code (e.g. 918007605089)' }));
    }

    if (isConnected) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Already connected!', isConnected: true }));
    }

    try {
      if (!currentSock) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Socket is initializing. Please retry in 3 seconds.' }));
      }

      logger.info(`Requesting WhatsApp pairing code for ${cleanPhone}...`);
      const code = await currentSock.requestPairingCode(cleanPhone);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, code, phone: cleanPhone }));
    } catch (err: any) {
      logger.error({ err }, `Failed to request pairing code for ${cleanPhone}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err?.message || 'Failed to request pairing code. Make sure phone number is registered on WhatsApp.' }));
    }
  }

  // 4. Main Beautiful Interactive Web Dashboard (Flicker-Free, High-Res QR + Pairing Code UI)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Connect WhatsApp Bot — DineFlow</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0b141a;
            color: #e9edef;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            background: #111b21;
            border: 1px solid #222e35;
            border-radius: 24px;
            padding: 40px 32px;
            text-align: center;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 24px 60px rgba(0,0,0,0.6);
            transition: all 0.3s ease;
          }
          .brand {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 20px;
          }
          .brand-icon {
            font-size: 28px;
            background: #202c33;
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 14px;
          }
          .brand-title {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #fff;
          }
          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 16px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
          }
          .status-badge.waiting { background: #3b2d04; color: #fbbf24; border: 1px solid #78350f; }
          .status-badge.connected { background: #064e3b; color: #34d399; border: 1px solid #047857; }
          .pulse-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
            animation: pulse 1.5s infinite ease-in-out;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.3); }
          }
          
          /* Tabs */
          .tabs {
            display: flex;
            background: #202c33;
            border-radius: 12px;
            padding: 4px;
            margin-bottom: 24px;
            gap: 4px;
          }
          .tab-btn {
            flex: 1;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 600;
            color: #8696a0;
            background: transparent;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .tab-btn.active {
            background: #111b21;
            color: #00a884;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }

          /* QR Container */
          .qr-wrapper {
            background: #ffffff;
            border-radius: 20px;
            padding: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 320px;
            height: 320px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            position: relative;
          }
          .qr-wrapper img {
            width: 100%;
            height: 100%;
            display: block;
            image-rendering: pixelated;
          }
          .qr-loading {
            color: #111b21;
            font-size: 14px;
            font-weight: 600;
          }

          /* Instructions */
          .steps-box {
            background: #202c33;
            border-radius: 14px;
            padding: 18px 20px;
            text-align: left;
            margin-bottom: 20px;
          }
          .steps-box ol {
            padding-left: 20px;
            font-size: 13px;
            line-height: 1.7;
            color: #d1d7db;
          }
          .steps-box b { color: #fff; }

          /* Pairing Code Input */
          .pair-box {
            display: none;
            flex-direction: column;
            gap: 14px;
            margin-bottom: 20px;
          }
          .pair-input-group {
            display: flex;
            gap: 8px;
          }
          .pair-input {
            flex: 1;
            background: #202c33;
            border: 1px solid #374248;
            color: #fff;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 15px;
            outline: none;
          }
          .pair-input:focus { border-color: #00a884; }
          .pair-btn {
            background: #00a884;
            color: #111b21;
            font-weight: 700;
            border: none;
            padding: 0 20px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 14px;
            transition: opacity 0.2s;
          }
          .pair-btn:hover { opacity: 0.9; }
          .code-display {
            display: none;
            background: #0b141a;
            border: 2px dashed #00a884;
            border-radius: 16px;
            padding: 20px;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 6px;
            color: #25d366;
            margin-top: 10px;
          }

          /* Connected View */
          .connected-view {
            display: none;
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 16px;
          }

          .footer-note {
            font-size: 12px;
            color: #8696a0;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="brand">
            <div class="brand-icon">🍽️</div>
            <div class="brand-title">DineFlow WhatsApp</div>
          </div>

          <!-- Status Indicator -->
          <div id="statusBadge" class="status-badge waiting">
            <span class="pulse-dot"></span>
            <span id="statusText">Waiting for Connection...</span>
          </div>

          <!-- CONNECTED STATE -->
          <div id="connectedSection" class="connected-view">
            <div class="success-icon">🎉</div>
            <h2 style="font-size: 22px; color: #fff; margin-bottom: 8px;">WhatsApp Bot is Online!</h2>
            <p style="color: #8696a0; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
              Your WhatsApp number is actively connected and processing customer orders 24/7.
            </p>
            <div style="background: #202c33; padding: 16px; border-radius: 12px; font-size: 13px; color: #34d399; font-weight: 600;">
              ✨ Ready! Send <b>/bot/HI</b> or <b>Dinein</b> on WhatsApp to test.
            </div>
          </div>

          <!-- UNCONNECTED STATE -->
          <div id="unconnectedSection">
            <!-- Tabs -->
            <div class="tabs">
              <button class="tab-btn active" id="tabQr" onclick="switchTab('qr')">📷 QR Code Scan</button>
              <button class="tab-btn" id="tabPair" onclick="switchTab('pair')">🔢 Phone Pairing Code</button>
            </div>

            <!-- Tab 1: QR Code -->
            <div id="qrTabContent">
              <div class="qr-wrapper">
                <div id="qrLoading" class="qr-loading">Generating high-contrast QR...</div>
                <img id="qrImg" src="" style="display: none;" alt="WhatsApp QR Code" />
              </div>
              <div class="steps-box">
                <ol>
                  <li>Open <b>WhatsApp</b> on your phone</li>
                  <li>Tap <b>Menu (⋮)</b> or <b>Settings</b> → <b>Linked Devices</b></li>
                  <li>Tap <b>Link a Device</b> and point camera here</li>
                </ol>
              </div>
            </div>

            <!-- Tab 2: Pairing Code -->
            <div id="pairTabContent" class="pair-box">
              <p style="color: #8696a0; font-size: 13px; text-align: left;">
                Link without using camera! Enter your WhatsApp phone number with country code:
              </p>
              <div class="pair-input-group">
                <input id="phoneInput" class="pair-input" type="tel" placeholder="e.g. 918007605089" value="" />
                <button class="pair-btn" onclick="requestPairingCode()">Get Code</button>
              </div>
              <div id="codeDisplay" class="code-display"></div>
              <div class="steps-box" style="margin-top: 10px;">
                <ol>
                  <li>Open <b>WhatsApp</b> → <b>Linked Devices</b></li>
                  <li>Tap <b>Link a Device</b> → <b>Link with phone number instead</b></li>
                  <li>Enter the 8-digit code shown above</li>
                </ol>
              </div>
            </div>

            <div class="footer-note">⚡ Smooth auto-updates in real time with zero screen flickering.</div>
          </div>
        </div>

        <script>
          let lastQrData = '';
          let currentTab = 'qr';

          function switchTab(tab) {
            currentTab = tab;
            document.getElementById('tabQr').classList.toggle('active', tab === 'qr');
            document.getElementById('tabPair').classList.toggle('active', tab === 'pair');
            document.getElementById('qrTabContent').style.display = tab === 'qr' ? 'block' : 'none';
            document.getElementById('pairTabContent').style.display = tab === 'pair' ? 'flex' : 'none';
          }

          async function requestPairingCode() {
            const phone = document.getElementById('phoneInput').value.trim();
            if (!phone) {
              alert('Please enter your WhatsApp phone number with country code (e.g. 918007605089)');
              return;
            }
            const codeBox = document.getElementById('codeDisplay');
            codeBox.style.display = 'block';
            codeBox.innerText = 'GENERATING...';

            try {
              const res = await fetch('/api/pair-code?phone=' + encodeURIComponent(phone));
              const data = await res.json();
              if (data.code) {
                codeBox.innerText = data.code;
              } else {
                codeBox.innerText = 'ERROR: ' + (data.error || 'Failed');
              }
            } catch (err) {
              codeBox.innerText = 'ERR: ' + err.message;
            }
          }

          async function pollStatus() {
            try {
              const res = await fetch('/api/qr');
              const data = await res.json();

              if (data.isConnected) {
                document.getElementById('statusBadge').className = 'status-badge connected';
                document.getElementById('statusText').innerText = 'Bot Connected & Online';
                document.getElementById('connectedSection').style.display = 'block';
                document.getElementById('unconnectedSection').style.display = 'none';
                return;
              } else {
                document.getElementById('statusBadge').className = 'status-badge waiting';
                document.getElementById('statusText').innerText = 'Waiting for Scan / Link...';
                document.getElementById('connectedSection').style.display = 'none';
                document.getElementById('unconnectedSection').style.display = 'block';
              }

              if (data.qrDataUrl && data.qrDataUrl !== lastQrData) {
                lastQrData = data.qrDataUrl;
                const img = document.getElementById('qrImg');
                img.src = data.qrDataUrl;
                img.style.display = 'block';
                document.getElementById('qrLoading').style.display = 'none';
              }
            } catch (err) {
              console.error('Polling error:', err);
            }
          }

          // Initial poll + smooth interval every 2 seconds
          pollStatus();
          setInterval(pollStatus, 2000);
        </script>
      </body>
    </html>
  `);
}).listen(PORT, () => {
  logger.info(`Enhanced Web QR & Pairing page available on port ${PORT}`);
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

  currentSock = sock;

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
