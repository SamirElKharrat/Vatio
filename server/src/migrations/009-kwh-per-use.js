// Modo «kWh por uso»: aparatos como la lavadora o el microondas no gastan sus vatios todo el rato, así
// que pueden decir cuánto gasta cada uso. Cada uso puede llevar los suyos (un programa eco) y un
// comentario opcional con el ciclo. Vacíos, todo se calcula con los vatios, como hasta ahora.
export async function up({ context: db }) {
  await db.sequelize.query(`
    ALTER TABLE devices ADD COLUMN kwh_per_use double precision CHECK (kwh_per_use > 0 AND kwh_per_use <= 100);
    ALTER TABLE usages ADD COLUMN kwh double precision CHECK (kwh > 0 AND kwh <= 100);
    ALTER TABLE usages ADD COLUMN note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 120);
  `)
}

export async function down({ context: db }) {
  await db.sequelize.query(`
    ALTER TABLE usages DROP COLUMN note;
    ALTER TABLE usages DROP COLUMN kwh;
    ALTER TABLE devices DROP COLUMN kwh_per_use;
  `)
}
