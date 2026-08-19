# Database Migrations

This folder sets up and manages PostgreSQL migrations for the WhatsApp AI Ordering & Reservation System using `node-pg-migrate`.

## Setup

1. Make sure you have Node.js and npm installed.
2. In this directory, run:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Update `DATABASE_URL` in `.env` with your PostgreSQL database credentials.

## Commands

* **Run Migrations (Up):**
  ```bash
  npm run migrate:up
  ```
* **Rollback Migrations (Down):**
  ```bash
  npm run migrate:down
  ```
* **Create New Migration:**
  ```bash
  npm run migrate:create <name>
  ```

---
*Reference: Database Schema detailed in [architecture.md](../docs/architecture.md) Section 3.*
