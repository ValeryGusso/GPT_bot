import { Currency, Languague, TarifType } from '@prisma/client'

export type ICache = {
  reg: RegistrationCache
  tarif: TarifCache
  price: PriceCache
  code: CodeCache
}

export type RegistrationCache = Record<string, IReg>
export type TarifCache = Record<string, ITarif>
export type PriceCache = Record<Currency, IPrice>
export type CodeCache = Record<string, ICode>

export type PriceCacheKey = keyof PriceCache

export interface IReg {
  name: string
  code: string
  lang: Languague
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

export interface IPrice {
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
