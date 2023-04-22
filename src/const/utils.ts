import { FullUser } from '../interfaces/db.js'

export function timestampToDate(ts: bigint) {
  // const year = Math.floor(Number(ts) / 365 / 24 / 60 / 60 / 1000)
  // const month = Math.floor(Number(ts) / 30 / 24 / 60 / 60 / 1000)
  // const day = Math.floor(Number(ts) / 24 / 60 / 60 / 1000)

  return `Предоставляет доступ на ${Math.floor(Number(ts) / 24 / 60 / 60 / 1000)} дней`
}

export function getQueryId(str: string) {
  return parseInt(str.replace(/^.*_(\d+)$/i, '$1'))
}

export function getQueryName(str: string) {
  return str.replace(/^.*_(.*)_\d+$/i, '$1')
}

export function getToggleId(str: string) {
  return parseInt(str.replace(/^.*_(\d+)_\w+$/i, '$1'))
}

export function getToggleValue(str: string) {
  return str.replace(/^.*_(\w+)$/i, '$1')
}

export function getContextValue(str: string) {
  return parseInt(str.replace(/^.*_(\d+)$/i, '$1'))
}

export function getContextId(str: string) {
  return parseInt(str.replace(/^.*_(\d+)_\d+$/i, '$1'))
}

export function getRandomModelName(str: string) {
  return str.replace(/^.*_(\w+)_.+_\d+$/i, '$1') /* as RandomModel */
}

export function getRandomModelValue(str: string) {
  return parseFloat(str.split('_')[4])
}

export function isFullUser(user: FullUser | null | undefined): user is FullUser {
  return !!user?.id
}
