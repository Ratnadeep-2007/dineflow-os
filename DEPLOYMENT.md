# 🚀 DineFlow AI — Production Deployment Guide

This guide provides step-by-step instructions for deploying the **DineFlow AI** full-stack platform (Backend API, Receptionist Dashboard, WhatsApp Gateway, Telegram Gateway, PostgreSQL, Redis, and Database Migrations) on any Linux VPS (Ubuntu, Debian, AWS EC2, DigitalOcean Droplet, Linode, Hetzner, etc.) or Windows Server using **Docker Compose**.

---

## 🏗️ Architecture Stack

| Service | Container Name | Description | Port(s) |
|---|---|---|---|
| **Frontend** | `dineflow-frontend` | React SPA + Nginx Reverse Proxy & Static Asset Caching | `80`, `5173` |
| **Backend** | `dineflow-backend` | NestJS API, WebSockets Gateway, BullMQ Worker, Gemini AI Engine | `3000` |
| **WhatsApp Gateway** | `dineflow-baileys-gateway` | WhatsApp Baileys Bot with persistent session store | Internal |
| **Telegram Gateway** | `dineflow-telegram-gateway` | Telegram Bot Gateway | Internal |
| **PostgreSQL** | `dineflow-postgres` | Relational Database (10 core tables & constraints) | `5432` |
| **Redis** | `dineflow-redis` | In-memory cache, conversation state store, and queue engine | `6379` |
| **DB Migrate** | `dineflow-db-migrate` | Schema migration runner (runs on startup) | None |

---

## ⚡ Quickstart (One-Click Deploy)

### 1. Clone Repository onto your Server
```bash
git clone <YOUR_GIT_REPO_URL> wp_automation
cd wp_automation
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
nano .env   # or your preferred text editor
```

Configure the following:
* **`GEMINI_API_KEY`**: Your Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/).
* **`POSTGRES_PASSWORD`**: Set a strong database password.
* **`JWT_SECRET`**: Set a random secret string (min 32 characters).
* **`TELEGRAM_BOT_TOKEN`**: (Optional) Bot token from [@BotFather](https://t.me/BotFather).
* **`MENU_DASHBOARD_URL`**: Public URL of your digital menu (e.g. `https://yourdomain.com/menu`).

### 3. Run Deployment Script
On Linux VPS:
```bash
chmod +x deploy.sh
./deploy.sh
```

Or execute directly with Docker Compose:
```bash
# 1. Build and start database + redis
docker compose up -d postgres redis

# 2. Run migrations
docker compose run --rm db-migrate

# 3. Start all services in background
docker compose up -d --build
```

---

## 📱 WhatsApp Bot Pairing (Baileys)

The WhatsApp gateway stores its authentication keys inside a persistent Docker volume (`baileys_auth`), meaning **you only need to pair once**.

To scan the QR code:
```bash
docker logs -f dineflow-baileys-gateway
```
1. Open WhatsApp on your phone.
2. Tap **Linked Devices** > **Link a Device**.
3. Point your camera at the QR code in the terminal.
4. Once paired, the gateway will show `[Baileys] Socket Connected`.

To stop viewing logs, press `Ctrl + C` (the bot stays running in background).

---

## 🤖 Telegram Bot Configuration

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Create a bot using `/newbot` and copy the API token.
3. Paste the token into `.env` under `TELEGRAM_BOT_TOKEN`.
4. Restart the telegram container:
   ```bash
   docker compose restart telegram-gateway
   ```

---

## 🔒 Domain & SSL Setup (HTTPS with Let's Encrypt / Certbot)

For production with a custom domain (e.g., `app.yourrestaurant.com`), you can put Nginx or Caddy on the host as a reverse proxy:

### Option A: Using Certbot & Host Nginx
1. Point your domain's DNS `A` record to your VPS IP address.
2. Create an Nginx site config `/etc/nginx/sites-available/dineflow`:
   ```nginx
   server {
       server_name app.yourrestaurant.com;

       location / {
           proxy_pass http://127.0.0.1:80;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. Enable the site and obtain SSL:
   ```bash
   ln -s /etc/nginx/sites-available/dineflow /etc/nginx/sites-enabled/
   certbot --nginx -d app.yourrestaurant.com
   ```

### Option B: Cloudflare Proxied SSL
If using Cloudflare:
1. Proxy your `A` record through Cloudflare (Orange cloud icon).
2. Set SSL/TLS Encryption mode to **Full**.
3. Direct requests to your VPS IP on port 80.

---

## 🛠️ Management & Maintenance Commands

### View Logs in Real-Time
```bash
# All logs
docker compose logs -f

# Specific service logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f baileys-gateway
docker compose logs -f telegram-gateway
```

### Restarting or Updating Services
```bash
# Pull latest code and re-deploy
git pull
docker compose build
docker compose up -d

# Restart a specific service
docker compose restart backend
```

### Database Backup & Restore
```bash
# Backup database to a .sql file
docker exec -t dineflow-postgres pg_dump -U postgres wp_automation > backup_$(date +%F).sql

# Restore database from a .sql file
cat backup_2026-08-17.sql | docker exec -i dineflow-postgres psql -U postgres -d wp_automation
```

### Stopping the Stack
```bash
# Stop containers (preserves all data)
docker compose down

# Stop and wipe volumes (⚠️ WARNING: Deletes DB data and WhatsApp auth)
docker compose down -v
```

---

## 🩺 Healthcheck & Troubleshooting

1. **Dashboard says "Disconnected from WebSocket"**:
   - Verify backend is running: `docker compose ps`
   - Check backend logs: `docker compose logs backend`
2. **AI response not triggering**:
   - Verify `GEMINI_API_KEY` in `.env`.
   - Inspect backend logs for quota or NLU validation logs.
3. **WhatsApp disconnected**:
   - Check `docker logs dineflow-baileys-gateway`. If re-auth is needed, delete `auth_info` volume:
     `docker volume rm wp_automation_baileys_auth` and rerun `./deploy.sh`.
