import { Currency, Prisma, TarifType } from '@prisma/client'

export interface CreateTarifArguments {
  name: string
  title: string
  description: string
  image: string
  limit?: number
  dailyLimit?: number
  type: TarifType
  maxContext: number
  duration?: number
}

export interface CreatePriceArguments {
  value: number
  currency: Currency
}

export type FullUser = Prisma.UserGetPayload<{
  include: {
    settings: true
    context: { include: { value: true } }
    token: true
    activity: { include: { tarif: true } }
  }
}>
