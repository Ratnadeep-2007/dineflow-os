exports.shorthands = undefined;

exports.up = pgm => {
  // Enable uuid-ossp extension for UUID generation
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  // 1. USERS Table
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    phone_number: { type: 'varchar(30)', notNull: true, unique: true },
    name: { type: 'varchar(100)' },
    loyalty_points: { type: 'integer', default: 0 },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });
  pgm.createIndex('users', 'phone_number'); // Speed up queries searching by customer phone number

  // 2. TABLES Table
  pgm.createTable('tables', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    table_number: { type: 'integer', notNull: true, unique: true },
    capacity: { type: 'integer', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'AVAILABLE' }
  });
  pgm.addConstraint('tables', 'chk_tables_status', {
    check: "status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED')"
  });

  // 3. MENU_CATEGORIES Table
  pgm.createTable('menu_categories', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    name: { type: 'varchar(100)', notNull: true, unique: true },
    description: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  // 4. MENU_ITEMS Table
  pgm.createTable('menu_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    category_id: { type: 'uuid', notNull: true, references: 'menu_categories(id)', onDelete: 'RESTRICT' },
    name: { type: 'varchar(100)', notNull: true },
    description: { type: 'text' },
    price: { type: 'decimal(10,2)', notNull: true },
    // Postgres array type used for tags, avoiding join-table overhead for simple query matching
    dietary_tags: { type: 'varchar(50)[]' }, 
    stock_status: { type: 'varchar(20)', notNull: true, default: 'IN_STOCK' },
    // JSONB allows storing dynamic provider overrides, e.g. {"SWIGGY": 450.00, "ZOMATO": 470.00}
    provider_prices: { type: 'jsonb' } 
  });
  pgm.addConstraint('menu_items', 'chk_menu_items_stock', {
    check: "stock_status IN ('IN_STOCK', 'OUT_OF_STOCK')"
  });
  pgm.createIndex('menu_items', 'category_id');

  // 5. RESERVATIONS Table
  pgm.createTable('reservations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    table_id: { type: 'uuid', references: 'tables(id)', onDelete: 'SET NULL' },
    party_size: { type: 'integer', notNull: true },
    reservation_time: { type: 'timestamp', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'PENDING' },
    source: { type: 'varchar(20)', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });
  pgm.addConstraint('reservations', 'chk_reservations_status', {
    check: "status IN ('PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED')"
  });
  pgm.addConstraint('reservations', 'chk_reservations_source', {
    check: "source IN ('WHATSAPP', 'WALK_IN')"
  });
  pgm.createIndex('reservations', 'user_id');
  pgm.createIndex('reservations', 'table_id');
  pgm.createIndex('reservations', 'status');

  // 6. ORDERS Table
  pgm.createTable('orders', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    reservation_id: { type: 'uuid', references: 'reservations(id)', onDelete: 'SET NULL' },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    order_type: { type: 'varchar(20)', notNull: true },
    provider: { type: 'varchar(20)', default: 'DIRECT' },
    status: { type: 'varchar(20)', notNull: true, default: 'CART' },
    total_amount: { type: 'decimal(10,2)', notNull: true, default: 0.00 },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });
  pgm.addConstraint('orders', 'chk_orders_type', {
    check: "order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'BROWSING')"
  });
  pgm.addConstraint('orders', 'chk_orders_provider', {
    check: "provider IN ('DIRECT', 'SWIGGY', 'ZOMATO')"
  });
  pgm.addConstraint('orders', 'chk_orders_status', {
    check: "status IN ('CART', 'PLACED', 'KITCHEN', 'COMPLETED', 'CANCELLED')"
  });
  pgm.createIndex('orders', 'reservation_id');
  pgm.createIndex('orders', 'user_id');
  pgm.createIndex('orders', 'status');

  // 7. ORDER_ITEMS Table
  pgm.createTable('order_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders(id)', onDelete: 'CASCADE' },
    menu_item_id: { type: 'uuid', notNull: true, references: 'menu_items(id)', onDelete: 'RESTRICT' },
    quantity: { type: 'integer', notNull: true },
    unit_price: { type: 'decimal(10,2)', notNull: true }
  });
  pgm.createIndex('order_items', 'order_id');
  pgm.createIndex('order_items', 'menu_item_id');

  // 8. WEBHOOK_EVENTS Table (Idempotency Ledger per architecture.md Section 3)
  pgm.createTable('webhook_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    meta_message_id: { type: 'varchar(100)', notNull: true, unique: true },
    event_type: { type: 'varchar(50)', notNull: true },
    processing_status: { type: 'varchar(20)', notNull: true, default: 'RECEIVED' },
    raw_payload: { type: 'jsonb', notNull: true },
    received_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });
  pgm.addConstraint('webhook_events', 'chk_webhook_processing_status', {
    check: "processing_status IN ('RECEIVED', 'PROCESSED', 'FAILED')"
  });
  pgm.createIndex('webhook_events', 'meta_message_id');

  // 9. AUDIT_LOG Table (DPDP Act Accountability Trail per security.md Section 4)
  pgm.createTable('audit_log', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    entity_type: { type: 'varchar(30)', notNull: true },
    entity_id: { type: 'uuid', notNull: true },
    action: { type: 'varchar(50)', notNull: true },
    actor: { type: 'varchar(50)', notNull: true },
    before_state: { type: 'jsonb' },
    after_state: { type: 'jsonb' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });
  pgm.addConstraint('audit_log', 'chk_audit_log_entity_type', {
    check: "entity_type IN ('RESERVATION', 'ORDER')"
  });
  pgm.createIndex('audit_log', ['entity_type', 'entity_id']);
};

exports.down = pgm => {
  pgm.dropTable('audit_log');
  pgm.dropTable('webhook_events');
  pgm.dropTable('order_items');
  pgm.dropTable('orders');
  pgm.dropTable('reservations');
  pgm.dropTable('menu_items');
  pgm.dropTable('menu_categories');
  pgm.dropTable('tables');
  pgm.dropTable('users');
  pgm.dropExtension('uuid-ossp');
};
