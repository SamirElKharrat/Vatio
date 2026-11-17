export const MONDAY = '2026-09-14'
export const TUESDAY = '2026-09-15'
export const SATURDAY = '2026-09-19'

export const devices = [
  { id: 'lav', name: 'Lavadora', watts: 1200, defaultHours: 2, color: '#499e5f' },
  { id: 'lvj', name: 'Lavavajillas', watts: 1400, defaultHours: 1.5, color: '#009ead' },
  { id: 'hor', name: 'Horno', watts: 2000, defaultHours: 1, color: '#c96b53' },
  { id: 'vit', name: 'Vitrocerámica', watts: 1800, defaultHours: 0.75, color: '#bc7728' },
  { id: 'aire', name: 'Aire acondicionado', watts: 1100, defaultHours: 3, color: '#6486d5' },
  { id: 'sec', name: 'Secadora', watts: 2500, defaultHours: 1.5, color: '#af6db3' },
  { id: 'ter', name: 'Termo eléctrico', watts: 1500, defaultHours: 1.5, color: '#8e8f23' },
]

export const fixedLoads = [
  { id: 'nev', name: 'Nevera', watts: 45, color: '#499e5f', note: 'arranca por ciclos · media 45 W' },
  { id: 'con', name: 'Congelador', watts: 35, color: '#009ead', note: 'siempre encendido' },
  { id: 'rou', name: 'Router y ONT', watts: 12, color: '#6486d5', note: '24 h' },
  { id: 'stb', name: 'TV, consola y standby', watts: 22, color: '#c96b53', note: 'en reposo' },
]

export const routines = [
  {
    id: 'r1',
    name: 'Termo · enchufe inteligente',
    deviceId: 'ter',
    start: 14,
    hours: 1.5,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    note: 'Programado en el enchufe: no tocar el interruptor de la pared.',
    skippedDates: [],
    pausedFrom: null,
  },
  {
    id: 'r2',
    name: 'Lavavajillas de noche',
    deviceId: 'lvj',
    start: 22,
    hours: 1.5,
    weekdays: [0, 2, 4],
    note: 'Modo eco, se deja cargado después de cenar.',
    skippedDates: [],
    pausedFrom: null,
  },
  {
    id: 'r3',
    name: 'Lavadora del finde',
    deviceId: 'lav',
    start: 10,
    hours: 2,
    weekdays: [5, 6],
    note: '',
    skippedDates: [],
    pausedFrom: null,
  },
]

export const usages = [
  { id: '1', deviceId: 'ter', date: MONDAY, start: 6, hours: 1.5 },
  { id: '2', deviceId: 'vit', date: MONDAY, start: 14, hours: 0.75 },
  { id: '3', deviceId: 'aire', date: MONDAY, start: 16, hours: 2.5 },
  { id: '4', deviceId: 'lav', date: MONDAY, start: 19, hours: 2 },
  { id: '5', deviceId: 'hor', date: MONDAY, start: 20, hours: 1 },
  { id: '6', deviceId: 'lvj', date: MONDAY, start: 22.5, hours: 1.5 },
  { id: '7', deviceId: 'ter', date: TUESDAY, start: 5.5, hours: 1.5 },
  { id: '8', deviceId: 'lav', date: TUESDAY, start: 9, hours: 2 },
  { id: '9', deviceId: 'sec', date: TUESDAY, start: 11.5, hours: 1.5 },
  { id: '10', deviceId: 'vit', date: TUESDAY, start: 13.5, hours: 1 },
  { id: '11', deviceId: 'lvj', date: TUESDAY, start: 15.5, hours: 1.5 },
  { id: '12', deviceId: 'hor', date: SATURDAY, start: 12, hours: 1.5 },
  { id: '13', deviceId: 'lav', date: SATURDAY, start: 10, hours: 2 },
  { id: '14', deviceId: 'aire', date: SATURDAY, start: 15, hours: 4 },
]

/** El prototipo arranca por tramos y sólo conoce energía y un término de potencia */
export const contract = {
  mode: 'tramos',
  fixedPrice: 0.1489,
  prices: { valle: 0.095, llano: 0.161, punta: 0.259 },
  power: {
    puntaLlano: { kw: 4.6, pricePerKwDay: 0.0817 },
    valle: { kw: 4.6, pricePerKwDay: 0 },
  },
  discounts: [],
  dailyFees: [],
  electricityTaxPct: 0,
  supplyTaxPct: 0,
}

export const home = { contract, devices, fixedLoads, routines, usages }
