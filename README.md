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
