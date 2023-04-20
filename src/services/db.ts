import { Currency, PrismaClient } from '@prisma/client'
import { CreateTarifArguments, CreatePriceArguments, FullUser } from '../interfaces/db.js'
import { ICode, IReg } from '../interfaces/tg.js'

class DBService {
  private readonly prisma
  constructor() {
    this.prisma = new PrismaClient()
    this.prisma.$connect()
  }

  async getByChatId(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { chatId: id },
      include: {
        activity: { include: { tarif: true } },
        settings: true,
        context: { include: { value: true } },
        token: true,
      },
      // rejectOnNotFound: false,
    })

    if (!user) {
      return null
    } else {
      return user
    }
  }

  async getAllTarifs() {
    const tarifs = await this.prisma.tarif.findMany()
    return tarifs
  }

  async createUser(id: number, userInfo: IReg) {
    let tarifId = 1

    if (userInfo.code === 'welcome') {
      const code = await this.prisma.code.findUnique({
        where: { value: userInfo.code },
      })

      if (code?.tarifId) {
        tarifId = code.tarifId
      }
    }

    const tarif =
      userInfo.code === 'welcome'
        ? await this.prisma.tarif.findUnique({ where: { id: tarifId } })
        : await this.prisma.tarif.findUnique({ where: { name: userInfo.code } })

    if (!tarif) {
      throw new Error(`Tarif ${tarifId} does not exist!`)
    }

    const user = await this.prisma.user.create({ data: { chatId: id, name: userInfo.name } })
    await this.prisma.token.create({ data: { userId: user.id } })
    await this.prisma.context.create({ data: { userId: user.id } })
    await this.prisma.settings.create({ data: { userId: user.id, language: userInfo.language } })
    await this.prisma.activity.create({
      data: {
        expiresIn: new Date(Date.now() + Number(tarif.duration)),
        userId: user.id,
        tarifId: tarif?.id,
      },
    })
    return true
  }

  async createTarif({
    name,
    title,
    description,
    image,
    limit,
    dailyLimit,
    type,
    maxContext,
    duration,
  }: CreateTarifArguments) {
    const tarif = await this.prisma.tarif.create({
      data: {
        name,
        title,
        description,
        image,
        limit: limit,
        dailyLimit,
        type,
        maxContext,
        duration,
      },
    })

    return tarif
  }

  async createPrice(price: number, currency: Currency, tarifId: number) {
    const item = await this.prisma.price.create({ data: { value: price, currency, tarifId } })

    return item
  }

  async createPrices(arr: CreatePriceArguments[]) {
    await this.prisma.price.createMany({ data: arr })

    return true
  }

  async createCode(code: ICode) {
    await this.prisma.code.create({
      data: { value: code.value, limit: code.limit, tarifId: code.tarifId },
    })
  }

  async addPrice(priceId: number, tarifId: number) {
    await this.prisma.tarif.update({
      where: {
        id: tarifId,
      },
      data: {
        price: {
          connect: {
            id: priceId,
          },
        },
      },
    })

    return true
  }

  async addMessage(messageId: number, contentId: number) {
    await this.prisma.context.update({
      where: {
        id: contentId,
      },
      data: {
        value: {
          connect: {
            id: messageId,
          },
        },
      },
    })

    return true
  }

  async addTarif(activityId: number, tarifId: number) {
    await this.prisma.tarif.update({
      where: {
        id: tarifId,
      },
      data: {
        activity: {
          connect: {
            id: activityId,
          },
        },
      },
    })

    return true
  }

  async updateActivity(id: number, usage: number) {
    const activity = await this.prisma.activity.update({
      where: { userId: id },
      data: {
        usage: { increment: usage },
        dailyUsage: { increment: usage },
      },
    })
    return activity
  }
}

export default new DBService()
