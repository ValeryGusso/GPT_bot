import { Currency, PrismaClient } from '@prisma/client'
import { CreateTarifArguments, CreatePriceArguments, FullUser } from '../interfaces/db.js'
import { ICode, IReg } from '../interfaces/tg.js'
import { info } from 'console'

class DBService {
  private readonly prisma
  constructor() {
    this.prisma = new PrismaClient()
  }

  async getByChatId(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { chatId: id },
      include: {
        settings: true,
        context: { include: { value: true } },
        token: true,
        activity: { include: { tarif: true } },
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

    const code = await this.prisma.code.findUnique({
      where: { value: userInfo.code === 'welcome_tarif' ? 'welcome_tarif' : userInfo.code },
    })

    if (code?.tarifId) {
      tarifId = code.tarifId
    }

    const tarif = await this.prisma.tarif.findUnique({ where: { id: tarifId } })

    if (!tarif) {
      throw new Error(`Tarif ${tarifId} does not exist!`)
    }

    const user = await this.prisma.user.create({ data: { chatId: id, name: userInfo.name } })
    await this.prisma.token.create({ data: { userId: user.id } })
    await this.prisma.context.create({ data: { userId: user.id } })
    await this.prisma.settings.create({ data: { userId: user.id, language: userInfo.language } })
    await this.prisma.activity.create({
      data: {
        expiresIn: new Date(Date.now() + tarif.duration),
        userId: user.id,
        tarifId: tarif?.id,
      },
    })
    return true
  }

  async createTarif(
    {
      name,
      title,
      description,
      image,
      limit,
      dailyLimit,
      type,
      maxContext,
      duration,
    }: CreateTarifArguments,
    id: number,
  ) {
    const tarif = this.prisma.tarif.create({
      data: {
        name,
        title,
        description,
        image,
        limit: limit || 0,
        dailyLimit: dailyLimit || 0,
        type,
        maxContext,
        duration,
        userId: id,
      },
    })

    return tarif
  }

  async createPrice(price: number, currency: Currency) {
    const item = await this.prisma.price.create({ data: { value: price, currency } })

    return item
  }
  async createPrices(arr: CreatePriceArguments[]) {
    await this.prisma.price.createMany({ data: arr })

    return true
  }

  async createCode(code: ICode) {
    // await this.prisma.code.create({
    //   data: { value: code.value, limit: code.limit, tarifId: code.tarifId },
    // })
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
}

export default new DBService()
