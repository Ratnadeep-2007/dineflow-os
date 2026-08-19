# Checkpoint & Memory Ledger: WhatsApp AI Ordering & Reservation System

This document serves as a comprehensive system ledger and context memory checkpoint. Use it to restore context in future sessions.

---

## 🏗️ 1. Project Overview & Architecture
An automated WhatsApp conversational AI ordering and reservation system integrated with a real-time host/receptionist management dashboard.

*   **Backend:** NestJS (TypeScript), PostgreSQL (node-pg-migrate), Redis (ioredis), BullMQ (Queue processing), and `@google/generative-ai` (Gemini-1.5-Flash NLU).
*   **Frontend:** React (Vite, TypeScript, Socket.io-client, Lucide icons) styled with a stark, premium Swiss-SaaS black/white/red design system.

---

## 📊 2. Current State of Development

### Phase 1 — Database Schema (Completed)
*   PostgreSQL running on `localhost:5432` (Docker container: `hospitality_postgres`).
*   Database `wp_automation` migrated with 10 tables: `users`, `tables`, `menu_categories`, `menu_items`, `reservations`, `orders`, `order_items`, `webhook_events`, `audit_log`, and `staff`.

### Phase 2 & 4 — Webhook Ingest, WebSockets & State Machine (Completed)
*   **Webhook Ingest (`POST /webhook`):** Constant-time HMAC signature checks (`crypto.timingSafeEqual` vs `META_APP_SECRET`) and database-backed message idempotency check.
*   **BullMQ processing:** Offloads incoming messages to background queue workers (`webhook-processing`).
*   **Dashboard Auth:** Short-lived JWTs (15m) with Redis JTI whitelisting/revocation on logout.
*   **WebSockets (`ReservationsGateway`):** Broadcasts real-time events (`booking.created`, `booking.updated`). Subscribes to receptionist actions (`booking.confirm`, `booking.edit`, and `booking.create` walk-ins).
*   **WhatsApp State Machine (`WhatsappFlowService`):** Orchestrates conversation transitions (`WELCOME` ➔ `DINE_IN` ➔ `RESERVE_PARTY_SIZE` ➔ `RESERVE_DATE_TIME` ➔ `AWAITING_APPROVAL`). Maps inputs to Gemini and validation layers.

### Phase 3 — AI NLU & Validator (Completed)
*   **NLU Parsing (`AiService`):** Extracts parameters via Gemini-1.5-flash with strict XML delimiters to block prompt-injection attempts. Rates limits API queries to 10 per minute per phone number.
*   **Deterministic Validator (`ProposalValidatorService`):** Enforces a `0.70` confidence threshold, validates party size bounds (1-20), checks reservation hours (11:00 AM - 11:00 PM), and queries database menu items to verify stock status (`IN_STOCK`).

### Phase 5 — Receptionist Dashboard (Interactive SaaS Edition)
*   Vite React TypeScript dashboard running on `http://localhost:5173`.
*   **Design Language:** Stark premium light Swiss theme (white foundation, black structural lines, red accents).
*   **Interactive Features Implemented:**
    *   **Header Live Micro Metrics Bar:** Displays live Occupancy %, Waitlist Action Counter, and Seat Pax Ratio.
    *   **Floor Map Table Capacity Filters:** Filter tables by `ALL`, `2 PAX`, `4 PAX`, or `6+ PAX`.
    *   **Table Status Action Popover:** Click any table to mark as `OCCUPIED`, `RESERVED`, or `AVAILABLE` (vacates table & completes reservation).
    *   **Smart Walk-In AI Recommendation:** Recommends optimal available table as guest count is typed.
    *   **Toast Notification Engine:** Bottom-right animated popups for real-time state changes.

### Phase 6 & 7 — Hardening & Operational Resilience (Completed)
*   **Input Sanitization:** Custom `sanitizeText` helper sanitizes inputs before DB inserts.
*   **Database Down Masking:** Registered global `AllExceptionsFilter` to mask SQL connection logs.
*   **Redis Down degradation:** Graceful fallback bounds for Redis operations.
*   **Payment Webhook:** Built `/payment/webhook` updating status to `PAID` and notifying kitchen.

---

## 🧩 3. Active MCP Server Configuration
The **Stitch MCP** server is active in global settings:
*   **Config File:** `C:\Users\ratna\.gemini\antigravity-cli\settings.json`
*   **Endpoint:** `https://stitch.googleapis.com/mcp`
*   **Auth Header:** `X-Goog-Api-Key: YOUR_API_KEY`
*   **Stitch Project ID:** `projects/9866523690300314028` ("Antigravity Reservation Dashboard")
*   **Generated Screen ID:** `37645d661b1d4d48bfa443dd6aa0a224` ("Reception Dashboard")

---

## 🛠️ 4. Environment Config & Credentials
Configure these locally inside `backend/.env` (which is excluded from Git):
```ini
PORT=3000
DATABASE_URL=postgres://postgres:password123@localhost:5432/wp_automation
REDIS_HOST=localhost
REDIS_PORT=6379
META_APP_SECRET=meta_app_secret_placeholder
JWT_SECRET=super_secret_jwt_key_for_wp_automation
JWT_EXPIRES_IN=15m
GEMINI_API_KEY=gemini_api_key_placeholder
```

---

## ⚡ 5. Quick Command Reference

*   **Boot Environment:** Double-click [`start.bat`](file:///E:/webstack/wp_automation/start.bat) at the workspace root to boot up PostgreSQL/Redis Docker containers and start dev servers.
*   **Run Backend API Server:**
    ```bash
    cd backend && npm run start:dev
    ```
*   **Run React Dashboard:**
    ```bash
    cd frontend && npm run dev
    ```
*   **Execute Test Suite:**
    ```bash
    cd backend && npm run test        # Runs AI validator unit tests
    cd backend && npm run test:e2e    # Runs webhook idempotency & db tests
    ```
