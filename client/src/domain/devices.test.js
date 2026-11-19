import { describe, expect, it } from 'vitest'
import { fixedLoadsWithDevices, loggableDevices } from './devices'

const devices = [
  { id: 'nevera', name: 'Nevera', watts: 45, color: '#499e5f' },
  { id: 'horno', name: 'Horno', watts: 2000, color: '#c96b53' },
]
const fixedLoads = [
  { id: 'f1', deviceId: 'nevera', name: 'Nevera (copia vieja)', watts: 30, color: '#000000', note: 'media' },
  { id: 'f2', deviceId: 'borrado', name: 'Router', watts: 12, color: '#6486d5', note: '' },
]

describe('consumos fijos y aparatos', () => {
  it('cada fijo toma el nombre, los vatios y el color actuales de su aparato', () => {
    expect(fixedLoadsWithDevices(fixedLoads, devices)).toEqual([
      { id: 'f1', deviceId: 'nevera', name: 'Nevera', watts: 45, color: '#499e5f', note: 'media' },
    ])
  })

  it('al apuntar sólo se ofrecen los aparatos que no son fijos', () => {
    expect(loggableDevices({ devices, fixedLoads }).map((device) => device.id)).toEqual(['horno'])
  })
})
