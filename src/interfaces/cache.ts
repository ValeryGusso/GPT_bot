import { Currency, Language, RandomModels, TarifType } from '@prisma/client'
import { FullUser } from './db.js'

type ItemWithUpdate = {
  updatedAt: number
}

export type ICache = {
  reg: RegistrationCache
  tarif: TarifCache
  price: PriceCache
  code: CodeCache
  settings: SettingsCache
  context: ContextCache
  user: ContextUser
  mode: ModeCache
}

export type KeysOfCache = keyof ICache

export type RegistrationCache = Record<string, IReg>
export type TarifCache = Record<string, ITarif>
export type PriceCache = Record<string, IPrice>
export type CodeCache = Record<string, ICode>
export type SettingsCache = Record<string, ISettings>
export type ContextCache = Record<string, IContext>
export type ContextUser = Record<string, IUser>
export type ModeCache = Record<string, IMode>

export type PriceCacheKey = keyof PriceCache
export type CacheItem = RegistrationCache | TarifCache | PriceCache | CodeCache

export interface IReg extends ItemWithUpdate {
  name: string
  code: string
  language: Language
  step: number
}

export interface ITarif extends ItemWithUpdate {
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
}

export interface IPrice extends ItemWithUpdate {
  prices: IPriceItem[]
}

export interface IPriceItem extends ItemWithUpdate {
  value: number
  currency: Currency
}

export interface ICode extends ItemWithUpdate {
  value: string
  limit: number
  step: number
  tarifId: number
  tarifName: string
}

export interface ISettings extends ItemWithUpdate {
  name: boolean
  promo: boolean
  randomModel: IRandomModel
}

type IModels = Record<RandomModels, number>

export interface IRandomModel extends IModels {
  model?: RandomModels
  value?: number
  step: number
}

export interface IContext extends ItemWithUpdate {
  length: boolean
  service: boolean
  random: boolean
  useServiceInfo: boolean
}

export interface IUser extends ItemWithUpdate {
  user: FullUser
}

export interface IMode extends ItemWithUpdate {
  mode: ModeValues
}

export type ModeValues = 'chat' | 'image'
