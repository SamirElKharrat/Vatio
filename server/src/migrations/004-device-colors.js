// El color deja de ser un matiz (0-359, con claridad y saturación fijas) y pasa a guardarse en hexadecimal,
// para poder elegir cualquier tono. Los colores que ya había se convierten al mismo color que se veía.

const toSrgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)

// Copia congelada de la conversión de client/src/lib/palette.js para el tono que usaba la app (oklch 0.63 0.125)
function hueToHex(h) {
  const l = 0.63
  const c = 0.125
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255).toString(16).padStart(2, '0')).join('')
}

const TABLES = ['devices', 'fixed_loads']

export async function up({ context: db }) {
  const q = db.sequelize
  for (const table of TABLES) {
    await q.query(`ALTER TABLE ${table} ADD COLUMN color text`)
    const [rows] = await q.query(`SELECT DISTINCT hue FROM ${table}`)
    for (const { hue } of rows) {
      await q.query(`UPDATE ${table} SET color = :color WHERE hue = :hue`, { replacements: { color: hueToHex(hue), hue } })
    }
    await q.query(`
      ALTER TABLE ${table} ALTER COLUMN color SET NOT NULL;
      ALTER TABLE ${table} ADD CONSTRAINT ${table}_color_check CHECK (color ~ '^#[0-9a-f]{6}$');
      ALTER TABLE ${table} DROP COLUMN hue;
    `)
  }
}

// Al volver atrás se pierde el color exacto: todos pasan al primer matiz
export async function down({ context: db }) {
  for (const table of TABLES) {
    await db.sequelize.query(`
      ALTER TABLE ${table} ADD COLUMN hue integer NOT NULL DEFAULT 150 CHECK (hue >= 0 AND hue < 360);
      ALTER TABLE ${table} ALTER COLUMN hue DROP DEFAULT;
      ALTER TABLE ${table} DROP COLUMN color;
    `)
  }
}
