import { Language } from '@prisma/client'
import { ICache, IRandomModel, KeysOfCache, ModeValues } from '../interfaces/cache.js'
import { FullUser } from '../interfaces/db.js'
import DBService from './db.js'
import { isFullUser } from '../const/utils.js'
import { hour } from '../const/const.js'

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
        if (primaryKey !== 'user') {
          delete this.cache[primaryKey as KeysOfCache][chatId]
        }
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
  private createCacheReg(chatId: number) {
    this.cache.reg[chatId] = {
      name: '',
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
      this.cache.user[chatId] = { user: safeUser, updatedAt: Date.now() }
    }
  }

  private createCacheMode(chatId: number, mode: ModeValues) {
    this.cache.mode[chatId].mode = mode
    this.cache.mode[chatId].updatedAt = Date.now()
  }

  /* UTILS */
  private async userGuard(chatId: number) {
    if (!this.cache.user[chatId]) {
      await this.createCacheUser(chatId)
      return
    }
  }

  /* GETTERS */
  async getUser(chatId: number) {
    await this.userGuard(chatId)
    return this.cache.user[chatId]
  }

  async getLanguage(chatId: number) {
    await this.userGuard(chatId)
    return this.cache.user[chatId].user.settings?.language!
  }

  getUnsafeUser(chatId: number) {
    if (this.cache.user[chatId]) {
      return this.cache.user[chatId]
    }
    return null
  }

  getReg(chatId: number) {
    if (!this.cache.reg[chatId]) {
      this.createCacheReg(chatId)
    }
    return this.cache.reg[chatId]
  }

  getSettings(chatId: number) {
    if (!this.cache.settings[chatId]) {
      this.createCacheSettings(chatId)
    }
    return this.cache.settings[chatId]
  }
  getUnsafeSettings(chatId: number) {
    return this.cache.settings[chatId]
  }

  getContext(chatId: number) {
    if (!this.cache.context[chatId]) {
      this.createCacheContext(chatId)
    }
    return this.cache.context[chatId]
  }
  getUnsafeContext(chatId: number) {
    return this.cache.context[chatId]
  }

  getTarif(chatId: number) {
    if (!this.cache.tarif[chatId]) {
      this.createCacheTarif(chatId)
    }
    return this.cache.tarif[chatId]
  }
  getUnsafeTaruf(chatId: number) {
    return this.cache.tarif[chatId]
  }

  getPrice(chatId: number) {
    if (!this.cache.price[chatId]) {
      this.createCachePrice(chatId)
    }
    return this.cache.price[chatId]
  }
  getUnsafePrice(chatId: number) {
    return this.cache.price[chatId]
  }

  getCode(chatId: number) {
    if (!this.cache.code[chatId]) {
      this.createCacheCode(chatId)
    }
    return this.cache.code[chatId]
  }
  getUnsafeCode(chatId: number) {
    return this.cache.code[chatId]
  }

  getAll() {
    return this.cache
  }
  /* SETTERS */
  async updateUser(chatId: number) {
    await this.createCacheUser(chatId)
  }

  /* CLEAR */
  clearTarif(chatId: number) {
    delete this.cache.tarif[chatId]
  }
  clearPrice(chatId: number) {
    delete this.cache.price[chatId]
  }
  clearReg(chatd: number) {
    delete this.cache.reg[chatd]
  }
  clearCode(chatId: number) {
    delete this.cache.code[chatId]
  }
  clearSettings(chatId: number) {
    delete this.cache.settings[chatId]
  }
  clearAll(chatId: number) {
    this.clearAllCacheById(chatId)
  }
}

export default new CacheService(hour)
