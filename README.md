# Vatios

Vatios nació de una pregunta muy simple: ¿cuánto me cuesta de verdad poner la lavadora a las siete de la tarde?
Las facturas de la luz dan un total y poco más, así que hice una web para apuntar cuándo se usa cada aparato
de casa y ver lo que cuesta según la hora, con los tramos punta, llano y valle del peaje 2.0TD.

Lo que se puede hacer:

- Apuntar los usos del día sobre una barra de 24 horas, arrastrando bloques en cuartos de hora. Hay vista de
  día, de semana y de mes.
- Guardar rutinas (el termo que salta todos los días a las 14:00, el lavavajillas de noche…) y saltarlas o
  cambiarlas un día concreto sin tocar el resto.
- Tener en cuenta lo que está siempre enchufado: nevera, router, aparatos en standby.
- Meter el contrato con sus precios, potencias, descuentos y cargos diarios, y sacar una estimación de la
  factura del periodo.
- Subir el PDF de la factura (por ahora de Endesa y DISA) para que lea los datos sola y compararla con lo
  apuntado. Si el PDF tiene contraseña, la pide; la contraseña no se guarda y el PDF tampoco.
- Comparar el contrato actual con otra oferta usando el consumo real.

Cada cuenta tiene sus propios datos. No hay registro abierto: las cuentas las crea el administrador desde la
pestaña Cuentas.

## Con qué está hecha

El cliente es React con Vite, Tailwind y TanStack Query. El servidor es Express con Sequelize sobre PostgreSQL,
y la sesión también se guarda en PostgreSQL. Los PDF se leen con pdfjs en el servidor. Los tests van con Vitest.

```
client/   la web (React)
server/   la API, las migraciones y los lectores de facturas
```

## Ejecutarla en local

Hace falta Node 22 o más reciente y un PostgreSQL al que te puedas conectar. Yo uso uno instalado en el equipo
con un usuario `vatios` dueño de dos bases: `vatios_dev` para trabajar y `vatios_test` para los tests (los
tests la vacían entera cada vez, así que no pongas ahí nada que quieras conservar).

```sql
CREATE ROLE vatios LOGIN PASSWORD 'la-que-quieras';
CREATE DATABASE vatios_dev OWNER vatios;
CREATE DATABASE vatios_test OWNER vatios;
```

Después copia `server/.env.example` a `server/.env` y rellénalo. Las variables `ADMIN_*` y `USER_*` son las dos
cuentas con las que arranca la app; las contraseñas necesitan al menos 8 caracteres. Para `SESSION_SECRET` vale
cualquier cadena larga y aleatoria, por ejemplo la que sale de
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Con eso:

```
npm install
npm run db:setup
npm run dev
```

`db:setup` crea las tablas y las dos cuentas, cada una con unos aparatos de ejemplo, un contrato orientativo y
una semana ya apuntada para que no se vea vacía. Se puede volver a lanzar sin miedo: las cuentas que ya existen
no las toca.

La web queda en http://localhost:5173 y la API en http://localhost:3001 (Vite le pasa las llamadas a `/api`).

Si prefieres probarla sin el modo desarrollo, `npm start` construye la web y la sirve el propio servidor en
http://localhost:3001. Así también se puede abrir desde el móvil en la misma wifi, entrando por la IP del
ordenador (algo como http://192.168.1.20:3001). Por debajo de 640 px de ancho cambia a las pantallas de móvil.

Otros comandos útiles:

```
npm test               tests del cliente y del servidor
npm run lint           revisión del código del cliente
npm run db:migrate -w server        aplica las migraciones pendientes
npm run db:migrate -w server down   deshace la última
```

En Windows, los tests van bien desde PowerShell o CMD. Desde Git Bash fallan al arrancar por cómo resuelve las
rutas, aunque el código esté bien.

## Publicarla

Está preparada para tener la web en Vercel, la API en Render y la base de datos en Supabase:

- **Supabase**: crea el proyecto y copia la cadena de conexión del *Session pooler* (puerto 5432). La conexión
  directa sólo va por IPv6 y Render no llega a ella. No le añadas `?sslmode=…`: el cifrado se activa con
  `DATABASE_SSL=true`. Las tablas llevan RLS activado para que la API pública de Supabase no enseñe nada.
- **Render**: `render.yaml` describe el servicio. Al crearlo como Blueprint sólo pide `DATABASE_URL`; las
  migraciones se aplican solas en cada arranque.
- **Cuentas iniciales**: como el plan gratuito de Render no tiene consola, se crean desde tu equipo una vez,
  apuntando `server/.env` a Supabase (con `DATABASE_SSL=true`) y lanzando `npm run db:setup`.
- **Vercel**: importa el repositorio con `client` como carpeta raíz. `client/vercel.json` pasa las llamadas a
  `/api` hasta Render, así el navegador ve un único dominio y la cookie de sesión funciona sin más. Si tu
  servicio de Render no se llama `vatios-api`, cambia ahí la dirección.

En el plan gratuito, Render apaga el servidor tras 15 minutos sin visitas y tarda casi un minuto en volver.
Para evitarlo basta un monitor gratuito (UptimeRobot, cron-job.org…) que llame a `/api/health` cada 10 minutos.
Como esa ruta también consulta la base de datos, de paso evita que Supabase pause el proyecto por inactividad.
