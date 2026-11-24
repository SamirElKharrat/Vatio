// Orden de los aparatos elegido por la persona. Los que ya existen se quedan en el orden en que se
// dieron de alta (el que se veía hasta ahora); los nuevos van al final.
//
// Los que se dieron de alta a la vez (los de una cuenta recién creada) se desempatan por su sitio
// en la tabla (ctid), que es el orden en que se guardaron y el que enseñaba la app; por id saldrían
// barajados, porque los id son aleatorios.
export async function up({ context: db }) {
  await db.sequelize.query(`
    ALTER TABLE devices ADD COLUMN position integer NOT NULL DEFAULT 0;
    UPDATE devices d SET position = o.n
      FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, ctid) - 1 AS n FROM devices) o
      WHERE o.id = d.id;
    CREATE INDEX devices_user_position ON devices (user_id, position);
  `)
}

export async function down({ context: db }) {
  await db.sequelize.query('DROP INDEX devices_user_position; ALTER TABLE devices DROP COLUMN position')
}
