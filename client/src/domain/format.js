export const eur = (amount) => amount.toFixed(2).replace('.', ',') + ' €'

export const kwh = (amount, decimals = 2) => amount.toFixed(decimals).replace('.', ',') + ' kWh'
