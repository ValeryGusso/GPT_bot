import { Currency, Prisma, TarifType } from '@prisma/client'

export interface CreateTarifArguments {
  name: string
  title: string
  description: string
  image: string
  limit: number
  dailyLimit: number
  maxContext: number
  duration: number
  type: TarifType
}

export interface CreatePriceArguments {
  value: number
  currency: Currency
}

export type FullUser = Prisma.UserGetPayload<{
  include: {
    activity: { include: { tarif: true } }
    settings: true
    context: { include: { context: true } }
    token: true
  }
}>

export type FullTarif = Prisma.TarifGetPayload<{
  include: {
    price: true
    code: true
    activity: true
  }
}>

export interface IAccess {
  daily: boolean
  total: boolean
  validTarif: boolean
}
