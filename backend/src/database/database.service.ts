import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    this.pool = new Pool({
      connectionString,
      ssl: connectionString && connectionString.includes('render.com') ? { rejectUnauthorized: false } : undefined,
    });
    this.logger.log('PostgreSQL Pool initialized');

    // Run auto-migration check
    await this.initSchema();
  }

  private async initSchema() {
    try {
      this.logger.log('Verifying & Initializing database schema...');
      await this.pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

      // 1. Users
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          phone_number VARCHAR(30) NOT NULL UNIQUE,
          name VARCHAR(100),
          loyalty_points INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
      `);

      // 2. Tables
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS tables (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          table_number INTEGER NOT NULL UNIQUE,
          capacity INTEGER NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        );
      `);

      // Seed tables 1-12 if empty
      const tableCount = await this.pool.query(`SELECT count(*) FROM tables;`);
      if (parseInt(tableCount.rows[0].count, 10) === 0) {
        for (let i = 1; i <= 12; i++) {
          await this.pool.query(
            `INSERT INTO tables (table_number, capacity, status) VALUES ($1, $2, 'AVAILABLE') ON CONFLICT DO NOTHING;`,
            [i, i <= 4 ? 2 : i <= 8 ? 4 : 6],
          );
        }
      }

      // 3. Menu Categories & Items
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS menu_categories (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS menu_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          dietary_tags VARCHAR(50)[],
          stock_status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK',
          provider_prices JSONB
        );
      `);

      // 4. Reservations
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS reservations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
          party_size INTEGER NOT NULL,
          reservation_time TIMESTAMP NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
          source VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Orders & Order Items
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          order_type VARCHAR(20) NOT NULL,
          provider VARCHAR(20) DEFAULT 'DIRECT',
          status VARCHAR(20) NOT NULL DEFAULT 'CART',
          total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL
        );
      `);

      // 6. Webhook Events
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS webhook_events (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          meta_message_id VARCHAR(100) NOT NULL UNIQUE,
          event_type VARCHAR(50) NOT NULL,
          processing_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
          raw_payload JSONB NOT NULL,
          received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 7. Audit Log
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          entity_type VARCHAR(30) NOT NULL,
          entity_id UUID NOT NULL,
          action VARCHAR(50) NOT NULL,
          actor VARCHAR(50) NOT NULL,
          before_state JSONB,
          after_state JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 8. Staff Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS staff (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          username VARCHAR(50) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          role VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default staff account (admin / password123)
      const staffCheck = await this.pool.query(`SELECT count(*) FROM staff;`);
      if (parseInt(staffCheck.rows[0].count, 10) === 0) {
        const hash = await bcrypt.hash('password123', 10);
        await this.pool.query(
          `INSERT INTO staff (username, password_hash, name, role) VALUES ('admin', $1, 'Head Receptionist', 'RECEPTIONIST') ON CONFLICT DO NOTHING;`,
          [hash],
        );
        this.logger.log('Default staff account seeded: admin / password123');
      }

      this.logger.log('✅ Database schema verified & ready.');
    } catch (err) {
      this.logger.warn(`Schema initialization warning (ignorable if tables exist): ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('PostgreSQL Pool closed');
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Query executed: ${text.substring(0, 100)}... in ${duration}ms`);
      return res;
    } catch (error) {
      this.logger.error(`Database query failed: ${error.message} (Query: ${text})`);
      throw error;
    }
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
