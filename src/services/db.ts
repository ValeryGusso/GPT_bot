import { Currency, Language, MessageRole, PrismaClient, RandomModels } from '@prisma/client'
import { CreateTarifArguments, CreatePriceArguments, FullUser, FullTarif, IAccess } from '../interfaces/db.js'
import { ICode, IRandomModel, IReg } from '../interfaces/tg.js'
import { tarifRelations, userRelations } from '../const/relations.js'

class DBService {
  private readonly prisma
  constructor() {
    this.prisma = new PrismaClient()
    this.prisma.$connect()
  }

  /* GET */
  async getByChatId(chatId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { chatId },
      include: {
        activity: { include: { tarif: true } },
        settings: true,
        context: { include: { context: true } },
        token: true,
      },
    })

    return user
  }

  async getByChatIdUnsafe(chatId: number) {
    const user = await this.prisma.user.findUnique({
      where: { chatId },
      include: userRelations,
    })

    return user
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

  async getAllPrices(tarifId: number) {
    return await this.prisma.price.findMany({ where: { tarifId } })
  }

  /* CREATE */
  async createUser(chatId: number, userInfo: IReg) {
    const code = await this.prisma.code.findUniqueOrThrow({ where: { value: userInfo.code } })

    if (!code?.tarifId) {
      throw new Error('Invalide code')
    }

    const tarif = await this.prisma.tarif.findUniqueOrThrow({ where: { id: code.tarifId } })

    const user = await this.prisma.user.create({ data: { chatId, name: userInfo.name } })
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

    if (code.value !== 'welcome') {
      await this.prisma.code.update({ where: { id: code.id }, data: { limit: { decrement: 1 } } })
    }

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
        totalLimit: limit,
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
    /* REMOVE FIRST MESSAGE WHEN CONTEXT LIMIT IS OVER */
    if (user.context?.context.length! >= user.activity?.tarif.maxContext!) {
      const idList: number[] = []

      user.context?.context.forEach((el) => {
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
    await this.prisma.message.create({
      data: {
        role,
        content,
        contextId: user.context?.id!,
      },
    })
  }

  /* UPDATE */
  async clearContext(userOrId: FullUser | number) {
    if (typeof userOrId === 'number') {
      await this.prisma.message.deleteMany({ where: { context: { user: { chatId: userOrId } } } })
      return true
    } else {
      await this.prisma.message.deleteMany({ where: { context: { userId: userOrId.id } } })
      return true
    }
  }

  async changeName(name: string, user: FullUser) {
    await this.prisma.user.update({ where: { id: user.id }, data: { name } })
  }

  async changeContext(value: number, userId: number) {
    await this.prisma.context.update({ where: { userId }, data: { length: value } })
  }

  async changeRandomModel(models: IRandomModel, userId: number) {
    await this.prisma.settings.update({
      where: { userId },
      data: {
        randomModel: models.model || 'temperature',
        temperature: models.model === 'temperature' ? models.value : models.model === 'both' ? models.temperature : 0.7,
        topP: models.model === 'topP' ? models.value : models.model === 'both' ? models.topP : 0.7,
      },
    })
  }

  async changeQuery(query: string, user: FullUser) {
    await this.prisma.context.update({ where: { userId: user.id }, data: { serviceInfo: query } })
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

  async updateActivity(userId: number, usage: number) {
    const activity = await this.prisma.activity.update({
      where: { userId },
      data: {
        totalUsage: { increment: usage },
        dailyUsage: { increment: usage },
      },
    })
    return activity
  }

  /* TOGGLE */
  async contextToggle(userId: number, action: string) {
    await this.prisma.context.update({
      where: { userId },
      data: { useContext: action === 'on' },
    })
  }

  async languageToggle(userId: number, lang: Language) {
    await this.prisma.settings.update({
      where: { userId },
      data: {
        language: lang,
      },
    })
  }

  async serviceInfoToggle(userId: number, action: string) {
    await this.prisma.context.update({
      where: { userId },
      data: { useServiceInfo: action === 'on' },
    })
  }

  /* UTILS */
  async validateAccess(user: FullUser) {
    const access: IAccess = {
      daily: true,
      total: true,
      validTarif: true,
    }

    if (user.activity?.tarif.name === 'unlim') {
      return access
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
    if (user.activity?.totalUsage! > user.activity?.tarif?.totalLimit!) {
      access.total = false
    }

    return access
  }

  async validateCode(code: string) {
    const candidat = await this.prisma.code.findUnique({ where: { value: code } })
    return !!candidat
  }
}

export default new DBService()
