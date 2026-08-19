exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createTable('staff', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    username: { type: 'varchar(50)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    name: { type: 'varchar(100)', notNull: true },
    role: { type: 'varchar(20)', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  pgm.addConstraint('staff', 'chk_staff_role', {
    check: "role IN ('RECEPTIONIST', 'ADMIN')"
  });

  pgm.createIndex('staff', 'username');
};

exports.down = pgm => {
  pgm.dropTable('staff');
};
