export async function up({ context: db }) {
  await db.sequelize.query(`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
      name text NOT NULL,
      watts integer NOT NULL CHECK (watts > 0),
      default_hours double precision NOT NULL CHECK (default_hours > 0 AND default_hours <= 24),
      hue integer NOT NULL CHECK (hue >= 0 AND hue < 360),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX devices_user_id ON devices (user_id);

    CREATE TABLE usages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
      device_id uuid NOT NULL REFERENCES devices ON DELETE CASCADE,
      date date NOT NULL,
      start double precision NOT NULL CHECK (start >= 0 AND start < 24),
      hours double precision NOT NULL CHECK (hours > 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (start + hours <= 24)
    );
    CREATE INDEX usages_user_date ON usages (user_id, date);

    CREATE TABLE fixed_loads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
      name text NOT NULL,
      watts integer NOT NULL CHECK (watts > 0),
      hue integer NOT NULL CHECK (hue >= 0 AND hue < 360),
      note text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX fixed_loads_user_id ON fixed_loads (user_id);

    CREATE TABLE routines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
      name text NOT NULL,
      device_id uuid NOT NULL REFERENCES devices ON DELETE CASCADE,
      start double precision NOT NULL CHECK (start >= 0 AND start < 24),
      hours double precision NOT NULL CHECK (hours > 0),
      weekdays integer[] NOT NULL,
      note text NOT NULL DEFAULT '',
      paused_from date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (start + hours <= 24)
    );
    CREATE INDEX routines_user_id ON routines (user_id);

    CREATE TABLE routine_skips (
      routine_id uuid NOT NULL REFERENCES routines ON DELETE CASCADE,
      date date NOT NULL,
      PRIMARY KEY (routine_id, date)
    );

    CREATE TABLE contracts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE REFERENCES users ON DELETE CASCADE,
      provider text,
      mode text NOT NULL CHECK (mode IN ('fija', 'tramos')),
      fixed_price double precision NOT NULL,
      price_punta double precision NOT NULL,
      price_llano double precision NOT NULL,
      price_valle double precision NOT NULL,
      power_kw_punta_llano double precision NOT NULL,
      power_kw_valle double precision NOT NULL,
      power_price_punta_llano double precision NOT NULL,
      power_price_valle double precision NOT NULL,
      discounts jsonb NOT NULL DEFAULT '[]',
      daily_fees jsonb NOT NULL DEFAULT '[]',
      electricity_tax_pct double precision NOT NULL,
      supply_tax_pct double precision NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
      provider text,
      period_from date NOT NULL,
      period_to date NOT NULL,
      total double precision NOT NULL,
      kwh double precision NOT NULL,
      kwh_punta double precision,
      kwh_llano double precision,
      kwh_valle double precision,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (period_to >= period_from)
    );
    CREATE INDEX invoices_user_period ON invoices (user_id, period_from);

    CREATE TABLE invoice_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid NOT NULL REFERENCES invoices ON DELETE CASCADE,
      position integer NOT NULL,
      kind text NOT NULL,
      label text NOT NULL,
      amount double precision NOT NULL,
      tax_pct double precision
    );
    CREATE INDEX invoice_lines_invoice_id ON invoice_lines (invoice_id);

    -- Sesiones de express-session (connect-pg-simple)
    CREATE TABLE session (
      sid varchar PRIMARY KEY,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    );
    CREATE INDEX session_expire ON session (expire);
  `)
}

export async function down({ context: db }) {
  await db.sequelize.query(`
    DROP TABLE IF EXISTS session, invoice_lines, invoices, contracts, routine_skips,
      routines, fixed_loads, usages, devices, users CASCADE;
  `)
}
