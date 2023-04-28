import { Language } from '@prisma/client'
import { ICache, IRandomModel, KeysOfCache, ModeValues } from '../interfaces/cache.js'
import { FullUser } from '../interfaces/db.js'
import DBService from './db.js'
import { isFullUser } from '../const/utils.js'

class CacheService {
  private readonly cacheExpires

  private cache: ICache = {
    reg: {},
    tarif: {},
    price: {},
    code: {},
    settings: {},
    context: {},
    user: {},
    mode: {},
  }

  private clearAllCacheById(chatId: number) {
    for (const primaryKey in this.cache) {
      if (primaryKey in this.cache) {
        delete this.cache[primaryKey as KeysOfCache][chatId]
      }
    }
  }

  private clearCache() {
    for (const primaryKey in this.cache) {
      if (primaryKey in this.cache) {
        const field = this.cache[primaryKey as KeysOfCache]

        for (const chatId in field) {
          if (
            chatId in this.cache[primaryKey as KeysOfCache] &&
            this.cache[primaryKey as KeysOfCache][chatId].updatedAt + this.cacheExpires < Date.now()
          ) {
            delete this.cache[primaryKey as KeysOfCache][chatId]
          }
        }
      }
    }
  }

  constructor(cacheExpires: number) {
    this.cacheExpires = cacheExpires
    setInterval(() => {
      this.clearCache()
    }, this.cacheExpires)
  }

  /* CACHE CREATORS */
  private createCacheReg(chatId: number, name: string) {
    this.cache.reg[chatId] = {
      name,
      code: '',
      language: Language.ru,
      step: 1,
      updatedAt: Date.now(),
    }
  }

  private createCacheTarif(chatId: number) {
    this.createCachePrice(chatId)

    this.cache.tarif[chatId] = {
      name: '',
      title: '',
      description: '',
      image: '',
      limit: 0,
      dailyLimit: 0,
      maxContext: 10,
      type: 'limit',
      duration: 0,
      step: 1,
      updatedAt: Date.now(),
    }
  }

  private createCachePrice(chatId: number) {
    this.cache.price[chatId] = { prices: [], updatedAt: Date.now() }
  }

  private createCacheCode(chatId: number) {
    this.cache.code[chatId] = {
      value: '',
      limit: 1,
      tarifName: '',
      tarifId: 0,
      step: 1,
      updatedAt: Date.now(),
    }
  }

  private createCacheSettings(chatId: number) {
    this.cache.settings[chatId] = {
      name: false,
      promo: false,
      randomModel: { step: 1 } as IRandomModel,
      updatedAt: Date.now(),
    }
  }

  private createCacheContext(chatId: number) {
    this.cache.context[chatId] = {
      length: false,
      service: false,
      random: false,
      useServiceInfo: false,
      updatedAt: Date.now(),
    }
  }

  private async createCacheUser(chatId: number, user?: FullUser | null | undefined) {
    let safeUser = user

    if (!user) {
      safeUser = await DBService.getByChatIdUnsafe(chatId)
    }

    if (isFullUser(safeUser)) {
      this.cache.user[chatId] = { user: safeUser, isExist: true, updatedAt: Date.now() }
    } else {
      this.cache.user[chatId] = { user: {} as FullUser, isExist: false, updatedAt: Date.now() }
    }
  }

  private createCacheMode(chatId: number, mode: ModeValues) {
    this.cache.mode[chatId].mode = mode
    this.cache.mode[chatId].updatedAt = Date.now()
  }

  /* UTILS */
  private userGuard(chatId: number) {
    if (!this.cache.user[chatId]) {
      this.createCacheUser(chatId)
      return
    } else if (this.cache.user[chatId].isExist) {
      return
    } else if (isFullUser(this.cache.user[chatId].user)) {
      return
    } else {
      this.createCacheUser(chatId)
    }
  }

  /* GETTERS */
  getUser(chatId: number) {
    this.userGuard(chatId)

    return this.cache.user[chatId].user
  }

  getUnsafeUser(chatId: number) {
    this.userGuard(chatId)

    const isExists = this.cache.user[chatId].isExist

    if (isExists) {
      return this.cache.user[chatId].user
    } else {
      return null
    }
  }

  getLanguage(chatId: number) {
    this.userGuard(chatId)
    this.cache.user[chatId]
    return this.cache.user[chatId].user.settings?.language!
  }

  getTarif(chatId: number) {
    if (!this.cache.tarif[chatId]) {
      this.createCacheTarif(chatId)
    }
    return this.cache.tarif[chatId]
  }
  /* SETTERS */
  updateUser(userOrChatId: FullUser | number) {
    if (typeof userOrChatId === 'number') {
      this.userGuard(userOrChatId)
    }
  }
  /* REMOVERS */
}

export default new CacheService(30000)
