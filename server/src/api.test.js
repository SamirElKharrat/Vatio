import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from './app.js'
import { hashPassword, sessionStore } from './auth.js'
import { sequelize } from './db.js'
import { createEmptyHousehold } from './household.js'
import { Device, FixedLoad, User } from './models.js'

const PASSWORD = 'contraseña-de-prueba'
const DATE = '2026-09-14'

// Las cuentas reales empiezan vacías; las de los tests traen una casa ya montada
const TEST_DEVICES = [
  { name: 'Lavadora', watts: 1200, defaultHours: 2, color: '#499e5f' },
  { name: 'Lavavajillas', watts: 1400, defaultHours: 1.5, color: '#009ead' },
  { name: 'Horno', watts: 2000, defaultHours: 1, color: '#c96b53' },
  { name: 'Vitrocerámica', watts: 1800, defaultHours: 0.75, color: '#bc7728' },
  { name: 'Aire acondicionado', watts: 1100, defaultHours: 3, color: '#6486d5' },
  { name: 'Secadora', watts: 2500, defaultHours: 1.5, color: '#af6db3' },
  { name: 'Termo eléctrico', watts: 1500, defaultHours: 1.5, color: '#8e8f23' },
]
const TEST_FIXED_LOADS = [
  { name: 'Nevera', watts: 45, color: '#499e5f', note: 'arranca por ciclos · media 45 W' },
  { name: 'Router y ONT', watts: 12, color: '#6486d5', note: '24 h' },
]

async function createAccount(email, role) {
  const user = await User.create({ email, role, passwordHash: await hashPassword(PASSWORD) })
  await createEmptyHousehold(user.id)
  await Device.bulkCreate(TEST_DEVICES.map((device) => ({ ...device, userId: user.id })))
  await FixedLoad.bulkCreate(TEST_FIXED_LOADS.map((load) => ({ ...load, userId: user.id })))
  return user
}

/** Cliente con su propia cookie de sesión, ya dentro de la cuenta */
async function loginAs(email) {
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD })
  expect(res.status).toBe(200)
  return agent
}

const deviceNamed = async (agent, name) => {
  const res = await agent.get('/api/devices')
  return res.body.devices.find((device) => device.name === name)
}

let admin
let ana
let luis

beforeAll(async () => {
  await createAccount('admin@test.local', 'admin')
  await createAccount('ana@test.local', 'user')
  await createAccount('luis@test.local', 'user')
  admin = await loginAs('admin@test.local')
  ana = await loginAs('ana@test.local')
  luis = await loginAs('luis@test.local')
})

afterAll(async () => {
  await sequelize.close()
  await sessionStore.close()
})

describe('estado', () => {
  it('responde con el servidor y la base de datos en marcha', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ server: true, database: true })
  })
})

describe('sesión', () => {
  it('sin sesión no deja leer nada', async () => {
    for (const path of ['/api/devices', '/api/usages?from=2026-09-14&to=2026-09-20', '/api/contract', '/api/users']) {
      const res = await request(app).get(path)
      expect(res.status, path).toBe(401)
    }
  })

  it('rechaza una contraseña incorrecta y una cuenta que no existe con el mismo mensaje', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: 'ana@test.local', password: 'otra-cosa' })
    const missing = await request(app).post('/api/auth/login').send({ email: 'nadie@test.local', password: PASSWORD })
    expect(wrong.status).toBe(401)
    expect(missing.status).toBe(401)
    expect(wrong.body.error).toBe(missing.body.error)
  })

  it('tras diez fallos con un correo lo frena, sin afectar a los demás', async () => {
    const attempt = (email, password = 'otra-cosa') => request(app).post('/api/auth/login').send({ email, password })
    for (let i = 0; i < 10; i++) expect((await attempt('fuerza@test.local')).status).toBe(401)
    const locked = await attempt('Fuerza@test.local')
    expect(locked.status).toBe(429)
    expect((await attempt('ana@test.local', PASSWORD)).status).toBe(200)
  })

  it('entra sin importar mayúsculas en el correo y devuelve la cuenta sin la contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ' Ana@Test.local ', password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email: 'ana@test.local', role: 'user', active: true })
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
  })

  it('al salir la sesión deja de valer', async () => {
    const agent = await loginAs('luis@test.local')
    expect((await agent.get('/api/auth/me')).status).toBe(200)
    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })
})


describe('usos', () => {
  it('guarda un uso y lo devuelve al pedir ese día', async () => {
    const lavadora = await deviceNamed(ana, 'Lavadora')
    const created = await ana.post('/api/usages').send({ deviceId: lavadora.id, date: DATE, start: 19, hours: 2 })
    expect(created.status).toBe(201)
    expect(created.body.usage).toMatchObject({ deviceId: lavadora.id, date: DATE, start: 19, hours: 2 })

    const list = await ana.get(`/api/usages?from=${DATE}&to=${DATE}`)
    expect(list.body.usages).toHaveLength(1)
    expect((await ana.get('/api/usages?from=2026-09-15&to=2026-09-20')).body.usages).toHaveLength(0)
  })

  it('no deja apuntar dos usos del mismo aparato en la misma franja', async () => {
    const lavadora = await deviceNamed(ana, 'Lavadora')
    const clash = await ana.post('/api/usages').send({ deviceId: lavadora.id, date: DATE, start: 20, hours: 2 })
    expect(clash.status).toBe(409)

    const after = await ana.post('/api/usages').send({ deviceId: lavadora.id, date: DATE, start: 21, hours: 1 })
    expect(after.status).toBe(201)
    const horno = await deviceNamed(ana, 'Horno')
    const other = await ana.post('/api/usages').send({ deviceId: horno.id, date: DATE, start: 20, hours: 1 })
    expect(other.status).toBe(201)
  })

  it('al mover un uso no choca consigo mismo, pero sí con otro', async () => {
    const list = await ana.get(`/api/usages?from=${DATE}&to=${DATE}`)
    const first = list.body.usages.find((usage) => usage.start === 19)
    const moved = await ana.patch(`/api/usages/${first.id}`).send({ start: 18.5 })
    expect(moved.status).toBe(200)
    expect(moved.body.usage).toMatchObject({ start: 18.5, hours: 2 })

    const clash = await ana.patch(`/api/usages/${first.id}`).send({ hours: 3 })
    expect(clash.status).toBe(409)
  })

  it('rechaza horas que no van en cuartos o que pasan de medianoche', async () => {
    const secadora = await deviceNamed(ana, 'Secadora')
    const odd = await ana.post('/api/usages').send({ deviceId: secadora.id, date: DATE, start: 10.1, hours: 1 })
    const late = await ana.post('/api/usages').send({ deviceId: secadora.id, date: DATE, start: 23, hours: 2 })
    const badDate = await ana.post('/api/usages').send({ deviceId: secadora.id, date: '14/09/2026', start: 10, hours: 1 })
    expect(odd.status).toBe(400)
    expect(late.status).toBe(400)
    expect(late.body.issues[0].path).toBe('hours')
    expect(badDate.status).toBe(400)
  })

  it('la duración habitual de un aparato va en cuartos de hora y el aviso sale en español', async () => {
    const horno = await deviceNamed(ana, 'Horno')
    const res = await ana.patch(`/api/devices/${horno.id}`).send({ defaultHours: 0.4 })
    expect(res.status).toBe(400)
    expect(res.body.issues[0].message).toBe('La duración debe ir en cuartos de hora')

    const negative = await ana.patch(`/api/devices/${horno.id}`).send({ watts: -5 })
    expect(negative.status).toBe(400)
    expect(negative.body.issues[0].message).toMatch(/demasiado pequeño/i)
  })

  it('al borrar un aparato se van sus usos', async () => {
    const horno = await deviceNamed(ana, 'Horno')
    expect((await ana.delete(`/api/devices/${horno.id}`)).status).toBe(204)
    const list = await ana.get(`/api/usages?from=${DATE}&to=${DATE}`)
    expect(list.body.usages.some((usage) => usage.deviceId === horno.id)).toBe(false)
  })
})

describe('cada cuenta ve sólo lo suyo', () => {
  it('otra cuenta no ve ni puede tocar los usos ajenos', async () => {
    const list = await ana.get(`/api/usages?from=${DATE}&to=${DATE}`)
    const usage = list.body.usages[0]

    expect((await luis.get(`/api/usages?from=${DATE}&to=${DATE}`)).body.usages).toHaveLength(0)
    expect((await luis.patch(`/api/usages/${usage.id}`).send({ start: 1 })).status).toBe(404)
    expect((await luis.delete(`/api/usages/${usage.id}`)).status).toBe(404)
    expect((await ana.get(`/api/usages?from=${DATE}&to=${DATE}`)).body.usages).toHaveLength(list.body.usages.length)
  })

  it('no se puede apuntar un uso ni crear una rutina con un aparato de otra cuenta', async () => {
    const lavadoraDeAna = await deviceNamed(ana, 'Lavadora')
    const usage = await luis.post('/api/usages').send({ deviceId: lavadoraDeAna.id, date: DATE, start: 3, hours: 1 })
    const routine = await luis
      .post('/api/routines')
      .send({ name: 'Ajena', deviceId: lavadoraDeAna.id, start: 3, hours: 1, weekdays: [0] })
    expect(usage.status).toBe(400)
    expect(routine.status).toBe(400)
    expect((await luis.patch(`/api/devices/${lavadoraDeAna.id}`).send({ watts: 1 })).status).toBe(404)
  })

  it('el administrador tampoco ve los datos de las demás cuentas', async () => {
    expect((await admin.get(`/api/usages?from=${DATE}&to=${DATE}`)).body.usages).toHaveLength(0)
  })
})

describe('rutinas', () => {
  it('se crean, se saltan un día y se pausan', async () => {
    const termo = await deviceNamed(ana, 'Termo eléctrico')
    const created = await ana
      .post('/api/routines')
      .send({ name: 'Termo por la tarde', deviceId: termo.id, start: 14, hours: 1.5, weekdays: [0, 1, 2, 3, 4, 5, 6] })
    expect(created.status).toBe(201)
    expect(created.body.routine).toMatchObject({ skippedDates: [], pausedFrom: null, note: '' })
    const id = created.body.routine.id

    const skipped = await ana.put(`/api/routines/${id}/skips/${DATE}`)
    expect(skipped.body.routine.skippedDates).toEqual([DATE])
    expect((await ana.put(`/api/routines/${id}/skips/${DATE}`)).body.routine.skippedDates).toEqual([DATE])
    expect((await ana.delete(`/api/routines/${id}/skips/${DATE}`)).body.routine.skippedDates).toEqual([])

    const paused = await ana.patch(`/api/routines/${id}`).send({ pausedFrom: '2026-09-16' })
    expect(paused.body.routine.pausedFrom).toBe('2026-09-16')
    const resumed = await ana.patch(`/api/routines/${id}`).send({ pausedFrom: null })
    expect(resumed.body.routine.pausedFrom).toBeNull()
    expect(resumed.body.routine.name).toBe('Termo por la tarde')

    expect((await luis.put(`/api/routines/${id}/skips/${DATE}`)).status).toBe(404)
  })

  it('se cambian sólo unos días: se saltan y quedan como usos apuntados', async () => {
    const vitro = await deviceNamed(ana, 'Vitrocerámica')
    const created = await ana
      .post('/api/routines')
      .send({ name: 'Vitro de lunes y martes', deviceId: vitro.id, start: 13, hours: 1, weekdays: [0, 1] })
    const id = created.body.routine.id
    const tuesday = '2026-09-15'

    const changed = await ana.post(`/api/routines/${id}/overrides`).send({ dates: [DATE, tuesday], start: 20, hours: 2 })
    expect(changed.status).toBe(201)
    expect(changed.body.routine.skippedDates).toEqual([DATE, tuesday])
    expect(changed.body.usages).toHaveLength(2)
    expect(changed.body.usages[0]).toMatchObject({ deviceId: vitro.id, date: DATE, start: 20, hours: 2 })

    // Ya está cambiado ese día, y el miércoles no toca
    expect((await ana.post(`/api/routines/${id}/overrides`).send({ dates: [DATE], start: 9, hours: 1 })).status).toBe(400)
    expect((await ana.post(`/api/routines/${id}/overrides`).send({ dates: ['2026-09-16'], start: 9, hours: 1 })).status).toBe(400)
    expect((await luis.post(`/api/routines/${id}/overrides`).send({ dates: ['2026-09-21'], start: 9, hours: 1 })).status).toBe(404)

    // Si choca con un uso apuntado, no se cambia ningún día
    await ana.post('/api/usages').send({ deviceId: vitro.id, date: '2026-09-22', start: 9, hours: 1 })
    const clash = await ana.post(`/api/routines/${id}/overrides`).send({ dates: ['2026-09-21', '2026-09-22'], start: 9, hours: 1 })
    expect(clash.status).toBe(409)
    const after = await ana.get('/api/routines')
    expect(after.body.routines.find((routine) => routine.id === id).skippedDates).toEqual([DATE, tuesday])
  })

  it('un cambio parcial no toca lo que no se envía', async () => {
    const termo = await deviceNamed(ana, 'Termo eléctrico')
    const created = await ana.post('/api/routines').send({
      name: 'Con nota',
      deviceId: termo.id,
      start: 3,
      hours: 1,
      weekdays: [0],
      note: 'No tocar el interruptor',
      pausedFrom: '2026-09-16',
    })
    const id = created.body.routine.id

    const renamed = await ana.patch(`/api/routines/${id}`).send({ name: 'Con nota, renombrada' })
    expect(renamed.body.routine).toMatchObject({ note: 'No tocar el interruptor', pausedFrom: '2026-09-16' })
    const resumed = await ana.patch(`/api/routines/${id}`).send({ pausedFrom: null })
    expect(resumed.body.routine).toMatchObject({ note: 'No tocar el interruptor', pausedFrom: null })

    const loads = await ana.get('/api/fixed-loads')
    const nevera = loads.body.fixedLoads.find((load) => load.name === 'Nevera')
    const patched = await ana.patch(`/api/fixed-loads/${nevera.id}`).send({ watts: 50 })
    expect(patched.body.fixedLoad).toMatchObject({ watts: 50, note: nevera.note })
    expect(nevera.note).not.toBe('')
  })

  it('exige al menos un día de la semana', async () => {
    const termo = await deviceNamed(ana, 'Termo eléctrico')
    const res = await ana.post('/api/routines').send({ name: 'Sin días', deviceId: termo.id, start: 1, hours: 1, weekdays: [] })
    expect(res.status).toBe(400)
  })
})

describe('contrato y facturas', () => {
  it('guarda el contrato de una factura real y lo devuelve igual', async () => {
    const contract = {
      provider: 'endesa',
      mode: 'fija',
      fixedPrice: 0.176956,
      prices: { punta: 0.176956, llano: 0.176956, valle: 0.176956 },
      power: {
        puntaLlano: { kw: 5.75, pricePerKwDay: 0.117686 },
        valle: { kw: 5.75, pricePerKwDay: 0.041554 },
      },
      discounts: [
        { label: 'Fidelidad', type: 'percent', pct: 10 },
        { label: 'Saldo', type: 'amount', amount: 5 },
      ],
      dailyFees: [{ label: 'Bono social', pricePerDay: 0.024688, inElectricityTaxBase: true, taxPct: 0 }],
      electricityTaxPct: 5.1126963,
      supplyTaxPct: 0,
    }
    expect((await ana.put('/api/contract').send(contract)).status).toBe(200)
    expect((await ana.get('/api/contract')).body.contract).toEqual(contract)
    expect((await luis.get('/api/contract')).body.contract.provider).toBeNull()
  })

  it('guarda una factura con su periodo, sus tramos y sus conceptos en orden', async () => {
    const invoice = {
      provider: 'disa',
      from: '2026-08-28',
      to: '2026-09-19',
      total: 32.95,
      kwh: 113,
      kwhByBand: { punta: 26.517, llano: 23.259, valle: 63.038 },
      lines: [
        { kind: 'power', label: 'Término potencia', amount: 13.78, taxPct: 0 },
        { kind: 'energy', label: 'Término energía', amount: 12.3, taxPct: 0 },
        { kind: 'discount', label: 'Descuento fidelización', amount: -5, taxPct: null },
        { kind: 'fee', label: 'Actuaciones en la medida', amount: 9.04, taxPct: 7 },
      ],
    }
    const created = await ana.post('/api/invoices').send(invoice)
    expect(created.status).toBe(201)
    expect(created.body.invoice).toMatchObject(invoice)
    // Sin días indicados se cuentan del 28 de agosto al 19 de septiembre, ambos incluidos
    expect(created.body.invoice.days).toBe(23)

    const edited = await ana.put(`/api/invoices/${created.body.invoice.id}`).send({ ...invoice, days: 22, total: 33 })
    expect(edited.body.invoice).toMatchObject({ days: 22, total: 33 })
    expect(edited.body.invoice.lines).toHaveLength(4)

    const backwards = await ana.post('/api/invoices').send({ ...invoice, from: '2026-09-20' })
    expect(backwards.status).toBe(400)

    expect((await ana.get('/api/invoices')).body.invoices).toHaveLength(1)
    expect((await luis.get('/api/invoices')).body.invoices).toHaveLength(0)
    expect((await luis.delete(`/api/invoices/${created.body.invoice.id}`)).status).toBe(404)
  })
})

describe('lectura del PDF de una factura', () => {
  it('exige sesión, archivo y una comercializadora conocida', async () => {
    const pdf = Buffer.from('no soy un pdf')
    expect((await request(app).post('/api/invoices/parse').field('provider', 'endesa').attach('file', pdf, 'f.pdf')).status).toBe(401)
    expect((await ana.post('/api/invoices/parse').field('provider', 'endesa')).status).toBe(400)
    expect((await ana.post('/api/invoices/parse').field('provider', 'iberdrola').attach('file', pdf, 'f.pdf')).status).toBe(400)
  })

  it('rechaza con una clave lo que no es un PDF y no guarda nada', async () => {
    const before = (await ana.get('/api/invoices')).body.invoices.length
    const res = await ana.post('/api/invoices/parse').field('provider', 'endesa').attach('file', Buffer.from('no soy un pdf'), 'factura.pdf')
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('not_a_pdf')
    expect((await ana.get('/api/invoices')).body.invoices).toHaveLength(before)
  })
})

describe('gestión de cuentas', () => {
  it('una cuenta normal no puede ver ni crear cuentas', async () => {
    expect((await ana.get('/api/users')).status).toBe(403)
    const res = await ana.post('/api/users').send({ email: 'intruso@test.local', password: PASSWORD })
    expect(res.status).toBe(403)
  })

  it('el administrador lista las cuentas sin contraseñas', async () => {
    const res = await admin.get('/api/users')
    expect(res.status).toBe(200)
    expect(res.body.users.map((user) => user.email)).toEqual([
      'admin@test.local',
      'ana@test.local',
      'luis@test.local',
    ])
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
  })

  it('crea una cuenta que ya puede entrar y empieza vacía, con el contrato a cero', async () => {
    const created = await admin.post('/api/users').send({ email: 'Nueva@Test.local', password: PASSWORD })
    expect(created.status).toBe(201)
    expect(created.body.user).toMatchObject({ email: 'nueva@test.local', role: 'user', active: true })

    const nueva = await loginAs('nueva@test.local')
    for (const [path, field] of [
      ['/api/devices', 'devices'],
      ['/api/fixed-loads', 'fixedLoads'],
      ['/api/routines', 'routines'],
      ['/api/invoices', 'invoices'],
      [`/api/usages?from=${DATE}&to=${DATE}`, 'usages'],
    ]) {
      expect((await nueva.get(path)).body[field], path).toHaveLength(0)
    }
    const { contract } = (await nueva.get('/api/contract')).body
    expect(contract).toMatchObject({ mode: 'fija', fixedPrice: 0, discounts: [], dailyFees: [] })

    const duplicate = await admin.post('/api/users').send({ email: 'nueva@test.local', password: PASSWORD })
    expect(duplicate.status).toBe(409)
    const short = await admin.post('/api/users').send({ email: 'corta@test.local', password: '1234' })
    expect(short.status).toBe(400)
  })

  it('al desactivar una cuenta se le cierra el paso, también con la sesión abierta', async () => {
    const nueva = await loginAs('nueva@test.local')
    const users = await admin.get('/api/users')
    const id = users.body.users.find((user) => user.email === 'nueva@test.local').id

    expect((await admin.patch(`/api/users/${id}`).send({ active: false })).body.user.active).toBe(false)
    expect((await nueva.get('/api/devices')).status).toBe(401)
    const login = await request(app).post('/api/auth/login').send({ email: 'nueva@test.local', password: PASSWORD })
    expect(login.status).toBe(403)

    expect((await admin.patch(`/api/users/${id}`).send({ active: true })).body.user.active).toBe(true)
    expect((await nueva.get('/api/devices')).status).toBe(200)
  })

  it('al cambiar la contraseña de una cuenta se cierran sus sesiones abiertas', async () => {
    const nueva = await loginAs('nueva@test.local')
    const users = await admin.get('/api/users')
    const id = users.body.users.find((user) => user.email === 'nueva@test.local').id

    expect((await admin.patch(`/api/users/${id}`).send({ password: 'otra-contraseña' })).status).toBe(200)
    expect((await nueva.get('/api/devices')).status).toBe(401)
    // Quien la cambia sigue dentro, y la cuenta entra con la nueva
    expect((await admin.get('/api/auth/me')).status).toBe(200)
    const login = await request(app).post('/api/auth/login').send({ email: 'nueva@test.local', password: 'otra-contraseña' })
    expect(login.status).toBe(200)
  })

  it('el administrador no puede desactivarse ni quitarse el rol', async () => {
    const me = await admin.get('/api/auth/me')
    const id = me.body.user.id
    expect((await admin.patch(`/api/users/${id}`).send({ active: false })).status).toBe(400)
    expect((await admin.patch(`/api/users/${id}`).send({ role: 'user' })).status).toBe(400)
  })
})

describe('tu cuenta', () => {
  it('cambia su nombre sin pedir la contraseña y lo devuelve al entrar', async () => {
    await createAccount('marta@test.local', 'user')
    const marta = await loginAs('marta@test.local')
    expect((await marta.get('/api/auth/me')).body.user.name).toBe('')

    const res = await marta.patch('/api/auth/me').send({ name: '  Marta Ruiz  ' })
    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Marta Ruiz')
    expect((await marta.get('/api/auth/me')).body.user.name).toBe('Marta Ruiz')
    expect((await marta.patch('/api/auth/me').send({ name: 'x'.repeat(81) })).status).toBe(400)
  })

  it('para cambiar el correo pide la contraseña actual y no deja uno ya usado', async () => {
    const marta = await loginAs('marta@test.local')
    const sinClave = await marta.patch('/api/auth/me').send({ email: 'marta2@test.local' })
    expect(sinClave.status).toBe(400)
    expect(sinClave.body.error).toBe('La contraseña actual no es correcta')
    expect((await marta.patch('/api/auth/me').send({ email: 'marta2@test.local', currentPassword: 'mala' })).status).toBe(400)
    expect((await marta.patch('/api/auth/me').send({ email: 'ana@test.local', currentPassword: PASSWORD })).status).toBe(409)
    expect((await marta.patch('/api/auth/me').send({ email: 'no-es-correo', currentPassword: PASSWORD })).status).toBe(400)

    const res = await marta.patch('/api/auth/me').send({ email: ' Marta2@Test.local ', currentPassword: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('marta2@test.local')
    // Desde ahora entra con el correo nuevo y no con el anterior
    expect((await request(app).post('/api/auth/login').send({ email: 'marta@test.local', password: PASSWORD })).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email: 'marta2@test.local', password: PASSWORD })).status).toBe(200)
  })

  it('cambia su contraseña con la actual y cierra sus otras sesiones, no ésta', async () => {
    const marta = request.agent(app)
    await marta.post('/api/auth/login').send({ email: 'marta2@test.local', password: PASSWORD })
    const otra = request.agent(app)
    await otra.post('/api/auth/login').send({ email: 'marta2@test.local', password: PASSWORD })

    expect((await marta.put('/api/auth/password').send({ currentPassword: 'mala', newPassword: 'nueva-clave-1' })).status).toBe(400)
    expect((await marta.put('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'corta' })).status).toBe(400)
    expect((await marta.put('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400)

    expect((await marta.put('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'nueva-clave-1' })).status).toBe(204)
    expect((await marta.get('/api/auth/me')).status).toBe(200)
    expect((await otra.get('/api/auth/me')).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email: 'marta2@test.local', password: 'nueva-clave-1' })).status).toBe(200)
  })

  it('sin sesión no deja cambiar nada', async () => {
    expect((await request(app).patch('/api/auth/me').send({ name: 'x' })).status).toBe(401)
    expect((await request(app).put('/api/auth/password').send({ currentPassword: 'a', newPassword: 'bbbbbbbb' })).status).toBe(401)
  })
})

describe('errores', () => {
  it('responde 404 en rutas e identificadores que no existen', async () => {
    expect((await ana.get('/api/nada')).status).toBe(404)
    expect((await ana.patch('/api/devices/no-es-un-id').send({ watts: 10 })).status).toBe(404)
  })

  it('responde 400 si el cuerpo no es JSON válido', async () => {
    const res = await ana.post('/api/devices').set('Content-Type', 'application/json').send('{mal')
    expect(res.status).toBe(400)
  })
})
