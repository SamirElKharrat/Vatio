# Planning · Vatios

La versión completa y legible del plan está publicada como página:
https://claude.ai/code/artifact/d1cf3cb9-0cca-46bb-a147-4bb3246de3aa

Diseño de referencia (prototipo «App de consumo eléctrico», pantalla 3a para web y 2b–2g para móvil):
https://claude.ai/code/artifact/a3e6d2b4-d565-4b8b-a7f3-9155ff65a56d

Este archivo es el resumen de trabajo dentro del repositorio.

## Decidido

- Servidor con Node.js, Express y Sequelize.
- PostgreSQL (hay un PostgreSQL 18 instalado y escuchando en el puerto 5432 de este equipo).
- Varias cuentas, cada una con sus datos. Por ahora una de administrador y una normal, sin registro abierto.
- Administrador con gestión simple: lista, crea y desactiva cuentas. No ve los datos de las demás.
- Facturas: cada persona sube la suya. Primero elige la comercializadora (Endesa o DISA) y después pone el PDF.
- La app se conecta con su propio usuario de PostgreSQL (`vatios`), dueño de las bases `vatios_dev` y `vatios_test`. La cadena de conexión está en `server/.env`.
- Por ahora la web funciona en local. Publicarla en internet queda fuera de este plan.

## Stack

- **Cliente:** Vite + React 19 (JavaScript), Tailwind CSS v4, Radix Dialog, TanStack Query, React Router, date-fns.
- **Servidor:** Node.js (JavaScript) + Express, Sequelize + PostgreSQL, express-session + bcrypt (sesión en PostgreSQL), zod, pdfjs-dist + multer.
- **Tests:** Vitest + supertest.

## Fases

| # | Fase | Hecho cuando |
|---|---|---|
| 0 | Proyecto base (`client` + `server`, tokens, git, base `vatios_dev`) | `npm run dev` levanta ambos, el servidor conecta con PostgreSQL y la página muestra el fondo, la tipografía y el acento del diseño |
| 1 | Lógica de cálculo, incluida la fórmula de la factura | Los tests pasan y la fórmula da 70,40 € con los datos de Endesa y 32,95 € con los de DISA |
| 2 | Servidor y base de datos (modelos, API, cuentas con rol) | Cada cuenta guarda y recupera sólo sus datos; sin sesión no hay acceso; la cuenta normal no gestiona cuentas |
| 3 | Marco, componentes base, conexión con la API y pantalla «Cuentas» | Se inicia sesión y se navega entre las cuatro pestañas con el marco de la pantalla 3a |
| 4 | Consumo · Día | Se crea, mueve, alarga, edita y borra un uso, y sigue ahí al recargar |
| 5 | Consumo · Semana y Mes | Un uso apuntado en Día aparece en Semana y Mes con los mismos importes |
| 6 | Aparatos, fijos y rutinas | Cambiar los vatios de un aparato recalcula todas las vistas |
| 7 | Tarifa y factura, a mano | Con los datos de Endesa escritos a mano, la estimación coincide con el total facturado |
| 8 | Leer el PDF de la factura (se elige Endesa o DISA y se sube el PDF) | Las dos facturas rellenan contrato y factura sin escribir nada más |
| 9 | Móvil | Todas las pestañas se usan a 390 px de ancho sin desplazamiento horizontal |
| 10 | Remate | La revisión no deja fallos abiertos y la web arranca en local con un solo comando |

Las cuentas iniciales (administrador y normal) se crean al preparar la base de datos, con las
contraseñas definidas en `.env`. Ni `.env` ni los PDF de las facturas se suben a git.

## Lo leído en las facturas

Las dos son de viviendas distintas en Tenerife, con peaje 2.0TD y el mismo precio a todas las horas.

**Endesa · 04/08/2026 – 03/09/2026 (30 días) · total 70,40 €**

- Energía: 265,147 kWh × 0,176956 €/kWh. Por tramo: punta 57,229 · llano 49,365 · valle 158,552 kWh.
- Potencia 5,75 kW; punta-llano a 0,117686 y valle a 0,041554 €/kW día.
- Descuentos del 3 %, 10 % y 10 % sobre 39,01 € (la primera línea de consumo).
- Bono social 0,024688 €/día; alquiler del contador 0,026630 €/día.
- Impuesto eléctrico 5,1126963 % sobre 66,16 €; IGIC 0 % para la luz y 7 % para el alquiler.
- A pagar 65,40 € tras «PARA TI» −5,00 €.

**DISA · 28/08/2026 – 19/09/2026 (23 días) · total 32,95 €**

- Energía: 113 kWh × 0,109000 €/kWh. Por tramo: P1 26,517 · P2 23,259 · P3 63,038 kWh.
- Potencia 3 kW en P1 y en P3, ambas a 0,099909 €/kW día (6,89 € + 6,89 €).
- Descuento de fidelización −5,00 € (en euros, no en porcentaje).
- Cargo puntual «Actuaciones en la medida» 9,04 €.
- Bono social 0,44 €; alquiler del contador 0,61 €.
- Impuesto eléctrico 5,11269632 % sobre 21,52 €; IGIC 0 % sobre 22,62 € y 7 % sobre 9,65 €.
- El PDF está cifrado y se abre con el NIF del titular.

Consecuencias para la app:

- Arranca en precio fijo; el aviso «si fuera valle» pasa al comparador de ofertas.
- El contrato guarda dos potencias con dos precios, descuentos, cargos diarios e impuestos.
- La factura guarda fecha de inicio y de fin, kWh por tramo y una lista de conceptos
  (descuentos en % o en euros, cargos puntuales, base de cada impuesto).
- El importador pide la contraseña del PDF cuando hace falta y no la guarda.
- El servidor lee el PDF y lo descarta; sólo se guardan los datos.

Notas para los lectores de PDF:

- Endesa: las líneas de totales salen mezcladas con los puntos de relleno («2...7.,47 €»).
  Apoyarse en las líneas de detalle, que traen la operación completa
  («5,750 kW x 0,117686 Eur/kW x 30 días»).
- DISA: conceptos e importes salen en columnas separadas y desordenadas. Hay que emparejarlos
  por su posición en la página (pdfjs da las coordenadas de cada texto), no por el orden de lectura.

## Pendiente

Fases 0 a 8 hechas el 2026-10-03 y fases 9 y 10 el 2026-10-12. El plan está completo.

Lo que la revisión deja apuntado y no se ha hecho, porque sólo importa si la web se publica en
internet (fuera de este plan): límite de intentos de entrada, cabeceras de seguridad y HTTPS con la
cookie de sesión marcada como segura.

Notas de la fase 1:

- La lógica está en `client/src/domain`, con 39 tests. Las facturas de Endesa y DISA se reproducen al céntimo.
- Los festivos que cuentan como valle son los nacionales de fecha fija (más el 6 de enero), así que
  no hace falta una lista por año. Están en `tariff.js`.
- Los datos de ejemplo del prototipo están en `client/src/domain/fixtures/prototype.js` y servirán
  para los datos iniciales de la fase 2.

Notas de la fase 2:

- API en `server/src/routes`, con 25 tests que corren contra la base `vatios_test`.
- `npm run db:setup` aplica las migraciones y crea las dos cuentas iniciales con los correos y
  contraseñas de `server/.env`. Se puede repetir: no toca las cuentas que ya existen.
- Una cuenta nueva arranca con contrato de precio fijo, siete aparatos y cuatro consumos fijos.
  Las dos cuentas iniciales llevan además la semana de ejemplo del prototipo.
- Se usa `bcryptjs` en lugar de `bcrypt`: mismo algoritmo, sin compilar nada en Windows.
- Rutas: `/api/auth` (login, logout, me), `/api/devices`, `/api/fixed-loads`, `/api/usages?from&to`,
  `/api/routines` (con `/:id/skips/:date`), `/api/contract`, `/api/invoices` y `/api/users` (sólo administrador).

Notas de la fase 3:

- Marco en `client/src/components/layout`, componentes base en `client/src/components/ui`,
  llamadas a la API en `client/src/api` (TanStack Query) y rutas en `client/src/App.jsx`.
- Direcciones: `/login`, `/consumo/:span/:date` (span = dia, semana o mes), `/aparatos`, `/fijos`,
  `/tarifa` y `/cuentas` (sólo administrador).
- Las cuatro pestañas usan `PendingView` mientras no tengan pantalla: enseña un resumen de lo que
  ya llega del servidor. Cada fase sustituye la suya.
- La tarjeta «Mes en curso» enseña lo apuntado hasta hoy con los fijos. La diferencia con la
  factura llega en la fase 7.

Notas de la fase 4:

- La vista Día está en `client/src/features/consumo`: `DayView.jsx` (rejilla), `useBlockDrag.js`
  (arrastre con pointer events), `UsageEditor.jsx` y `UsagePopover.jsx`.
- Mover o alargar un bloque actualiza la pantalla al momento y guarda al soltar; si el servidor lo
  rechaza, el bloque vuelve a su sitio y sale un aviso.
- La columna del aparato mide 240 px en lugar de los 182 del diseño, para que quepa «Aire acondicionado».
- Con precio fijo no se muestra la cifra «Si fuera valle» ni el fondo por tramos de las filas.
- «Editar rutina» lleva a la pestaña Fijos y rutinas; el editor de rutinas llega en la fase 6.
- Para probar en Chrome headless en este equipo no vale esperar a que la red quede en reposo:
  el antivirus inyecta peticiones propias en la página.

Notas de la fase 5:

- `WeekView.jsx` y `MonthView.jsx` en `client/src/features/consumo`. La pestaña pide a la API la
  semana o el mes de la fecha de la dirección.
- Las flechas de la barra superior saltan de semana en semana, o de mes en mes en la vista Mes.
  Junto al título de cada vista aparece «Ir a hoy / esta semana / este mes» cuando no es el actual.
- La semana pinta sólo los usos (como el prototipo); el mes suma también los consumos fijos.
- En el mes, los días que aún no han llegado cuentan los fijos y las rutinas y se dibujan con
  borde punteado. La tarjeta «Mes en curso» de la barra lateral sigue contando sólo hasta hoy.
- La estimación de la factura del mes usa la fórmula completa de la fase 1 (potencia, cargos e impuestos).

Notas de la fase 6:

- `client/src/features/aparatos` (tabla y diálogo de alta y edición) y `client/src/features/fijos`
  (consumos fijos, tarjetas de rutina y editor de rutinas).
- Los vatios se editan en la propia fila: la pantalla se recalcula con cada tecla y el guardado
  espera medio segundo a que se deje de escribir (`useInlineUpdate` en `client/src/api/hooks.js`).
- En Aparatos, «Usos», «kWh» y «Coste semana» son de la semana en curso y «Mes» es el mes en curso
  real (el prototipo multiplicaba la semana por 4,345).
- Borrar un aparato borra también sus usos y sus rutinas; el diálogo lo avisa y pide confirmación.
- «Editar rutina» desde la vista Día abre `/fijos?rutina=<id>` con el editor ya abierto.
- Corregido en el servidor: un cambio parcial (PATCH) sobre una rutina o un consumo fijo borraba la
  nota y quitaba la pausa. Los valores por defecto de zod ahora sólo se aplican al crear.
- «Cambiar este día» / «Cambiar esta semana» (bloque de rutina en la vista Día): `POST
  /api/routines/:id/overrides` salta la rutina en esas fechas y apunta en su lugar usos normales con las
  horas nuevas, todo en una transacción. Sin columnas nuevas: después se editan como cualquier uso.
- En las tarjetas de rutina pausadas o saltadas sólo se apaga el contenido; los botones quedan a la vista.

Notas de la fase 7:

- `client/src/features/tarifa`: `InvoiceSection.jsx` (facturado frente a apuntado), `InvoiceEditor.jsx`
  (factura a mano), `ContractSection.jsx` (contrato) y `OfferCompare.jsx` (comparador).
- «Apuntado» es la factura que saldría con el contrato y los kWh apuntados en el periodo de la factura,
  con potencia, cargos e impuestos incluidos; así se compara con el total facturado en igualdad.
- Bajo las tres tarjetas, la app comprueba el contrato: con sus precios y el consumo de la factura
  tiene que salir el total facturado. Con la factura de Endesa cuadra (70,40 €) si los descuentos se
  escriben en euros (8,97 €), porque Endesa sólo los aplicó a una parte del consumo.
- La factura guarda los días facturados (migración 002): Endesa factura 30 días del 4 de agosto al
  3 de septiembre, aunque contando los dos extremos salen 31.
- El comparador calcula la oferta con los mismos cargos e impuestos del contrato y sin descuentos,
  sobre el consumo medido de la última factura o sobre el mes apuntado. La oferta se recuerda en el
  navegador (localStorage), no en el servidor.
- Los cambios del contrato se aplican sobre el contrato más reciente de la caché (`useUpdateContract`),
  no sobre el de la última pintada, para que dos cambios seguidos no se pisen.
- Pendiente para la fase 10: el build avisa de que el JavaScript pasa de 500 kB; se arregla cargando
  cada pestaña bajo demanda.

Notas de la fase 8:

- Lectores en `server/src/invoices`: `pdfText.js` (texto del PDF por renglones, con la posición de
  cada trozo), `endesa.js`, `disa.js` e `index.js` (elige el lector y traduce los fallos).
- `POST /api/invoices/parse` recibe el PDF, la comercializadora y, si hace falta, la contraseña.
  Devuelve lo leído sin guardar nada; el PDF se procesa en memoria y se descarta.
- Fallos con clave para la pantalla: `password_needed`, `password_incorrect`, `provider_is_<otra>`,
  `not_a_pdf` y `unknown_format`.
- En el cliente, `features/tarifa/ImportDialog.jsx`: elegir comercializadora, subir, revisar y
  «Usar estos datos», que guarda la factura con sus conceptos y, si se marca, sustituye el contrato.
- Los descuentos de Endesa se guardan en euros cuando sólo se aplican a parte del consumo.
- Los cargos que no se repiten (en DISA, «Actuaciones en la medida») van como concepto `oneoff` de la
  factura y no entran en el contrato; la comprobación del contrato los suma aparte.
- Tests de los lectores con renglones reales sin datos personales (`server/src/invoices/fixtures`).
  Si los PDF están en la carpeta del proyecto se prueban además de principio a fin; el de DISA con
  la contraseña en la variable `DISA_PDF_PASSWORD` al lanzar los tests.

Notas de la fase 9:

- El corte de móvil es el `sm` de Tailwind (menos de 640 px). Lo que sólo cambia de tamaño va con clases
  `max-sm:`; lo que cambia de estructura pregunta a `useIsMobile` (`client/src/lib/useIsMobile.js`).
- Marco: en el móvil la barra lateral se sustituye por pestañas fijas al pie
  (`components/layout/BottomNav.jsx`, con los nombres cortos de `nav.js`) y la barra superior se queda en
  «Vatios», «Salir» y, en Consumo, Día / Semana / Mes con las flechas. En la vista Día las flechas saltan
  de día en día, porque las letras de los días no caben.
- Los diálogos (`Modal`) suben desde abajo como hoja, con un alto máximo del 92 % de la pantalla.
- Día (`features/consumo/DayMobile.jsx`, pantalla 2b): tarjeta con kWh y coste, los usos sobre una pista
  de 24 horas, la semana en barras, el total del mes y la lista de usos; tocar un uso abre lo mismo que
  tocar su bloque en el escritorio. No hay arrastre: las horas se cambian en la hoja.
- Apuntar un uso (pantalla 2c): rejilla de horas y botones de menos y más de cuarto en cuarto de hora,
  para la hora de inicio y para la duración. La rejilla va en 8 columnas y no en 12, para que cada hora
  se pueda tocar con el dedo. Al elegir aparato en un uso nuevo se pone su duración habitual.
- Semana: el día y sus cifras en un renglón y las 24 celdas debajo. Aparatos (pantalla 2d): una ficha por
  aparato, con los vatios editables en la propia ficha.
- Fijos y rutinas, Tarifa y factura, Mes y Cuentas ya cabían; sólo se corrigió un desborde de Fijos por
  debajo de 380 px.
- Comprobado con capturas a 390, 360 y 320 px: ninguna pestaña ni diálogo se desplaza a lo ancho.
  Entre 640 y 1024 px, Día, Semana y Aparatos siguen con su desplazamiento lateral propio.

Notas de la fase 10:

- `npm start` construye cliente y servidor y lo sirve todo en http://localhost:3001: si existe
  `client/dist`, el servidor entrega la web además de la API (`server/src/app.js`). `npm run dev` sigue
  siendo el arranque de desarrollo.
- Aparatos, Fijos y rutinas, Tarifa y factura y Cuentas se descargan al abrirlas (`client/src/App.jsx`).
  El paquete inicial baja de 534 a 474 kB y el build ya no avisa.
- Arreglos de la revisión:
  - Si falla el borrado de un uso, el aviso sale en la vista del día. Antes el uso reaparecía sin
    explicación, porque el error se quedaba en el diálogo que ya se había cerrado.
  - Al cambiar la contraseña de una cuenta se cierran sus sesiones abiertas (menos la de quien la cambia).
  - Los mensajes de validación que no están escritos a mano salen en español (`z.locales.es`).
  - La duración habitual de un aparato se valida en cuartos de hora, como los usos.
  - Dos altas simultáneas con el mismo correo responden 409 y no 500; un formulario de subida mal
    formado responde 400 y no 500.
- Revisado sin cambios: cada ruta filtra por la cuenta que ha entrado, las cuentas desactivadas
  pierden el acceso en la siguiente petición y el PDF de la factura no se guarda.
