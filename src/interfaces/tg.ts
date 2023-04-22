import { Currency, Language, TarifType } from '@prisma/client'

export type ICache = {
  reg: RegistrationCache
  tarif: TarifCache
  price: PriceCache
  code: CodeCache
  settings: SettingsCache
  context: ContextCache
}

export type KeysOfCache = keyof ICache
export type PriceCacheKey = keyof PriceCache
export type CacheItem = RegistrationCache | TarifCache | PriceCache | CodeCache

export type RegistrationCache = Record<string, IReg>
export type TarifCache = Record<string, ITarif>
export type PriceCache = Record<string, IPrice>
export type CodeCache = Record<string, ICode>
export type SettingsCache = Record<string, ISettings>
export type ContextCache = Record<string, IContext>

export interface IReg {
  name: string
  code: string
  language: Language
  step: number
  updatedAt: number
}

export interface ITarif {
  name: string
  title: string
  description: string
  image: string
  limit: number
  dailyLimit: number
  maxContext: number
  duration: number
  type: TarifType
  currency?: Currency
  step: number
  updatedAt: number
}

export type IPrice = Record<Currency, IPriceItem>

export interface IPriceItem {
  value: number
  currency: Currency
  updatedAt: number
}

export interface ICode {
  value: string
  limit: number
  step: number
  tarifId: number
  tarifName: string
  updatedAt: number
}

export interface ISettings {
  name: boolean
  promo: boolean
}

export interface IContext {
  length: boolean
  service: boolean
  random: boolean
}
