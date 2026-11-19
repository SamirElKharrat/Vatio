// Registro de descuentos por mes: los que se apuntan a mano (una promoción, un cupón) y los que trae
// cada factura subida. Los del contrato, que se aplican todos los meses, siguen en `contracts.discounts`.
export async function up({ context: db }) {
  await db.sequelize.query(`
    CREATE TABLE discount_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
      month date NOT NULL CHECK (extract(day FROM month) = 1),
      label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
      type text NOT NULL CHECK (type IN ('amount', 'percent')),
      value double precision NOT NULL CHECK (value >= 0),
      source text NOT NULL CHECK (source IN ('manual', 'factura')),
      invoice_id uuid REFERENCES invoices ON DELETE CASCADE,
      note text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((source = 'factura') = (invoice_id IS NOT NULL)),
      CHECK (type = 'amount' OR value <= 100)
    );
    CREATE INDEX discount_entries_user_month ON discount_entries (user_id, month);
    -- Las facturas que ya estaban subidas aportan sus descuentos, en el mes en que termina su periodo
    INSERT INTO discount_entries (user_id, month, label, type, value, source, invoice_id)
      SELECT i.user_id, date_trunc('month', i.period_to)::date, left(l.label, 80), 'amount', abs(l.amount), 'factura', i.id
      FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
      WHERE l.kind = 'discount' AND l.amount <> 0 AND char_length(l.label) > 0;
    -- Igual que las demás tablas (migración 003): la API REST de Supabase no la ve
    ALTER TABLE discount_entries ENABLE ROW LEVEL SECURITY;
  `)
}

export async function down({ context: db }) {
  await db.sequelize.query('DROP TABLE discount_entries')
}
