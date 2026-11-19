// Un consumo fijo pasa a ser «este aparato está enchufado las 24 h»: guarda a qué aparato se refiere
// y su nota. El nombre, los vatios y el color salen del aparato.
//
// Cada consumo fijo que ya existía se convierte en un aparato nuevo con su mismo nombre, vatios y color
// (y 24 h de duración habitual), y queda enlazado a él. No se reutiliza un aparato con el mismo nombre:
// los vatios de un fijo son la media del día y los de un aparato los de la etiqueta, y mezclarlos
// cambiaría las cuentas.
//
// Las columnas antiguas (name, watts, color) se quedan, sin uso y sin obligar a rellenarlas, hasta
// comprobar que todo va bien; se borrarán en otra migración.

export async function up({ context: db }) {
  const q = db.sequelize
  await q.transaction(async (transaction) => {
    await q.query(
      `
      ALTER TABLE fixed_loads ADD COLUMN device_id uuid;
      UPDATE fixed_loads SET device_id = gen_random_uuid();
      INSERT INTO devices (id, user_id, name, watts, default_hours, color, created_at, updated_at)
        SELECT device_id, user_id, name, watts, 24, color, created_at, now() FROM fixed_loads;
      ALTER TABLE fixed_loads
        ALTER COLUMN device_id SET NOT NULL,
        ADD CONSTRAINT fixed_loads_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices ON DELETE CASCADE,
        ADD CONSTRAINT fixed_loads_device_id_key UNIQUE (device_id),
        ALTER COLUMN name DROP NOT NULL,
        ALTER COLUMN watts DROP NOT NULL,
        ALTER COLUMN color DROP NOT NULL;
      `,
      { transaction },
    )
  })
}

export async function down({ context: db }) {
  const q = db.sequelize
  await q.transaction(async (transaction) => {
    await q.query(
      `
      UPDATE fixed_loads f SET name = d.name, watts = d.watts, color = d.color FROM devices d WHERE d.id = f.device_id;
      ALTER TABLE fixed_loads
        ALTER COLUMN name SET NOT NULL,
        ALTER COLUMN watts SET NOT NULL,
        ALTER COLUMN color SET NOT NULL,
        DROP COLUMN device_id;
      `,
      { transaction },
    )
  })
}
