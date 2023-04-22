import { Currency, Language, MessageRole, PrismaClient } from '@prisma/client'
import {
  CreateTarifArguments,
  CreatePriceArguments,
  FullUser,
  FullTarif,
  IAccess,
} from '../interfaces/db.js'
import { ICode, IReg } from '../interfaces/tg.js'
import { tarifRelations, userRelations } from '../const/relations.js'
import { where } from 'sequelize'

class DBService {
  private readonly prisma
  constructor() {
    this.prisma = new PrismaClient()
    this.prisma.$connect()
  }

  async getByChatId(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { chatId: id },
      include: userRelations,
    })

    if (!user) {
      return null
    } else {
      return user
    }
  }

  async getAllTarifs() {
    const tarifs = await this.prisma.tarif.findMany({
      include: tarifRelations,
    })
    return tarifs as FullTarif[]
  }

  async getTaridById(id: number) {
    const tarif = await this.prisma.tarif.findUnique({
      where: { id },
      include: tarifRelations,
    })
    return tarif as FullTarif
  }
  async createUser(id: number, userInfo: IReg) {
    const code = await this.prisma.code.findUnique({ where: { value: userInfo.code } })

    if (!code?.tarifId) {
      throw new Error('Invalide code')
    }

    const tarif = await this.prisma.tarif.findUnique({ where: { id: code.tarifId } })

    if (!tarif) {
      throw new Error(`Tarif does not exist!`)
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

  async createMessage(role: MessageRole, content: string, user: FullUser) {
    /* REMOVE FIRST MESSGAGE WHEN CONFEXT LIMIT IS OVER */
    if (user.context?.length! >= user.activity?.tarif.maxContext!) {
      const idList: number[] = []

      user.context?.value.forEach((el) => {
        idList.push(el.id)
      })

      const firstId = Math.min(...idList)

      await this.prisma.message.delete({
        where: {
          id: firstId,
        },
      })
    }

    /* ADD NEW MESSAGE */
    const message = await this.prisma.message.create({
      data: {
        role,
        content,
        contextId: user.context?.id!,
      },
    })

    return message
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

  async clearContext(userOrId: FullUser | number) {
    if (typeof userOrId === 'number') {
      await this.prisma.message.deleteMany({ where: { context: { user: { chatId: userOrId } } } })
      return true
    } else {
      await this.prisma.message.deleteMany({ where: { context: { userId: userOrId.id } } })
      return true
    }
  }

  async contextToggle(id: number, action: string) {
    await this.prisma.context.update({
      where: { userId: id },
      data: { useContext: action === 'on' },
    })
  }

  async languageToggle(id: number, lang: Language) {
    await this.prisma.settings.update({
      where: { userId: id },
      data: {
        language: lang,
      },
    })
  }

  async changeName(name: string, user: FullUser) {
    await this.prisma.user.update({ where: { id: user.id }, data: { name } })
  }

  async changeContext(value: number, userId: number) {
    await this.prisma.context.update({ where: { userId }, data: { length: value } })
  }

  async changeRandomModel(model: string, value: number, userId: number) {
    await this.prisma.settings.update({
      where: { userId },
      data: {
        randomModel: model,
        temperature: value,
        topP: value,
      },
    })
  }

  async changeTopPAndTemperature(value: number, userId: number) {
    const settings = await this.prisma.settings.update({
      where: { userId },
      data: { temperature: value, topP: value },
    })
    return settings
  }

  async activateCode(userId: number, value: string) {
    const code = await this.prisma.code.findUnique({ where: { value: value } })

    if (!code?.tarifId) {
      throw new Error('Промокод недействителен')
    }

    await this.prisma.activity.update({
      where: { userId },
      data: { tarif: { connect: { id: code.tarifId } } },
    })
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

  async validateAccess(user: FullUser) {
    const access: IAccess = {
      daily: true,
      total: true,
      validTarif: true,
    }

    const day = user.activity?.updatedAt.getDay()
    const curDay = new Date(Date.now()).getDay()

    if (day !== curDay) {
      await this.prisma.activity.update({
        where: { userId: user.id },
        data: {
          dailyUsage: 0,
        },
      })
    }

    if (Date.now() > +new Date(user.activity?.expiresIn.getTime()!)) {
      access.validTarif = false
    }
    if (user.activity?.dailyUsage! > user.activity?.tarif?.dailyLimit!) {
      access.daily = false
    }
    if (user.activity?.usage! > user.activity?.tarif?.limit!) {
      access.total = false
    }

    return access
  }
}

export default new DBService()
