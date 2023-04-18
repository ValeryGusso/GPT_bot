import { CallbackQuery, Message } from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import TgService from '../services/tg.js'
import GPTController from './gpt.js'
import DBService from '../services/db.js'
import { ICache, PriceCache, PriceCacheKey } from '../interfaces/tg.js'
import { CreatePriceArguments, FullUser } from '../interfaces/db.js'
import { Currency, Language, TarifType } from '@prisma/client'

dotenv.config()

class TgController {
  private cache: ICache = { reg: {}, tarif: {}, price: {} as PriceCache, code: {} }
  private clearCache() {
    setInterval(() => {
      for (const key in this.cache) {
        const curTime = Date.now()
        const max = 60 * 60 * 1000
        if (this.cache.reg[key] !== undefined) {
          if (curTime - this.cache.reg[key].updatedAt > max) {
          }
        }
      }
    }, 60 * 60 * 1000)
  }

  private createCacheUser(id: number, name?: string) {
    this.cache.reg[id] = {
      name: name || 'Незнакомец',
      code: '',
      language: Language.ru,
      step: 1,
      updatedAt: Date.now(),
    }
  }

  private createCacheTarif(id: number) {
    this.cache.tarif[id] = {
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

  private createCachePrice(currency: Currency) {
    this.cache.price[currency] = {
      currency,
      value: 0,
      updatedAt: Date.now(),
    }
  }

  private createCacheCode(id: number) {
    this.cache.code[id] = {
      value: '',
      limit: 1,
      tarifName: '',
      tarifId: 0,
      step: 0,
      updatedAt: Date.now(),
    }
  }

  private checkAuthAndRegistration(
    id: number,
    text: string,
    user: FullUser | null,
    name: string = 'Незнакомец',
  ): user is FullUser {
    if (text !== '/start' && !user && !this.cache.reg[id]) {
      TgService.welcome(id)
      return false
    }

    if (text === '/start' && !user) {
      this.createCacheUser(id, name)

      TgService.start(id, this.cache.reg[id])
      return false
    }

    if (text === '/start' && user) {
      TgService.greeting(id, user)
    }

    if (this.cache.reg[id]) {
      switch (this.cache.reg[id].step) {
        case 1:
          TgService.start(
            id,
            this.cache.reg[id],
            'Это немного не то, что я хотел бы получить от тебя в ответ. Давай всё таки определимся с языком',
          )
          return false
        case 2:
          this.cache.reg[id].name = text
          this.cache.reg[id].step++
          TgService.start(id, this.cache.reg[id])
          return false
        case 3:
          this.cache.reg[id].code = text
          this.cache.reg[id].step++
          TgService.start(id, this.cache.reg[id])
          return false
        case 4:
          TgService.start(
            id,
            this.cache.reg[id],
            'Это немного не то, что я хотел бы получить от тебя в ответ. Давай всё таки сверим данные и завершим регистрацию',
          )
          return false
      }
      return false
    }

    return true
  }

  private tarif(id: number, text: string) {
    const incrementRegistrationStep = () => {
      this.cache.tarif[id].updatedAt = Date.now()
      this.cache.tarif[id].step++
      TgService.createTarif(id, this.cache.tarif[id], this.cache.price)
    }

    switch (this.cache.tarif[id].step) {
      case 1:
        this.cache.tarif[id].name = text
        incrementRegistrationStep()
        break
      case 2:
        this.cache.tarif[id].title = text
        incrementRegistrationStep()
        break
      case 3:
        this.cache.tarif[id].description = text
        incrementRegistrationStep()
        break
      case 4:
        this.cache.tarif[id].image = text
        incrementRegistrationStep()
        break
      case 5:
        this.cache.tarif[id].limit = parseInt(text)
        incrementRegistrationStep()
        break
      case 6:
        this.cache.tarif[id].dailyLimit = parseInt(text)
        incrementRegistrationStep()
        break
      case 7:
        this.cache.tarif[id].maxContext = parseInt(text)
        incrementRegistrationStep()
        break
      case 8:
        this.cache.tarif[id].duration = parseInt(text)
        incrementRegistrationStep()
        break
      case 11:
        this.cache.price[this.cache.tarif[id].currency!].value = parseInt(text)
        incrementRegistrationStep()
        break
    }
  }

  private async code(id: number, text?: string) {
    const incementStep = async () => {
      await TgService.createCode(id, this.cache.code[id])
      this.cache.code[id].step++
    }

    if (!this.cache.code[id]) {
      this.createCacheCode(id)
      await incementStep()
      return
    }

    switch (this.cache.code[id].step) {
      case 1:
        this.cache.code[id].value = text || 'No name'
        await incementStep()
        break
      case 2:
        this.cache.code[id].limit = parseInt(text || '1')
        await incementStep()
        break
      // case 3:
      //   await incementStep()
      //   break
    }
  }

  async message(msg: Message) {
    try {
      /* PREVALIDATION */
      const { text } = msg

      if (!text) {
        TgService.sendError(msg.chat.id, 'Не указан текст сообщения!')
        return
      }

      /* CHEC UTH AND REGISTRATION */
      const user = await DBService.getByChatId(msg.chat.id)

      const checkAuth = this.checkAuthAndRegistration(msg.chat.id, text, user, msg.from?.first_name)

      if (!checkAuth) {
        return
      }

      /* RESET CONTEXT */
      if (text === '/reset') {
        GPTController.resetContext(msg.chat.id)
        return
      }

      /* CREATE CODE */
      if (text === '/code' && user.isAdmin) {
        // if (text === '/code') {
        this.code(msg.chat.id, text)
        return
      }

      if (this.cache.code[msg.chat.id]) {
        this.code(msg.chat.id, text)
        return
      }

      /* CREATE TARIF */
      if (text === '/tarif' && user.isAdmin) {
        // if (text === '/tarif') {
        if (this.cache.tarif[msg.chat.id]) {
          this.tarif(msg.chat.id, text)
          return
        } else {
          this.createCacheTarif(msg.chat.id)
          TgService.createTarif(msg.chat.id, this.cache.tarif[msg.chat.id], this.cache.price)
          return
        }
      }

      if (this.cache.tarif[msg.chat.id]) {
        this.tarif(msg.chat.id, text)
      }

      /* SKIPP ALL ACTIONS, SEND QUESTION TO GPT */
      // TgService.sendQuestion(msg.chat.id, text, user)
    } catch (err: any) {
      TgService.sendError(
        msg.chat.id,
        'Упс... что-то пошло не так, попробуй ещё раз.' + '\n' + err.message,
      )
    }
  }

  async callback(cb: CallbackQuery) {
    const incrementRegistrationStep = () => {
      this.cache.reg[cb.from.id].updatedAt = Date.now()
      this.cache.reg[cb.from.id].step++
      TgService.start(cb.from.id, this.cache.reg[cb.from.id])
    }

    const incrementTarifStep = () => {
      this.cache.tarif[cb.from.id].updatedAt = Date.now()
      this.cache.tarif[cb.from.id].step++
      TgService.createTarif(cb.from.id, this.cache.tarif[cb.from.id], this.cache.price)
    }

    const createTarif = async () => {
      const prices: CreatePriceArguments[] = []

      for (const key in this.cache.price) {
        prices.push({
          value: this.cache.price[key as PriceCacheKey].value,
          currency: this.cache.price[key as PriceCacheKey].currency,
        })
      }
      const pricesId: number[] = []

      for (let i = 0; i < prices.length; ) {
        const item = await DBService.createPrice(prices[i].value, prices[i].currency)
        pricesId.push(item.id)
        i++
      }

      const { name, title, description, image, limit, dailyLimit, type, maxContext, duration } =
        this.cache.tarif[cb.from.id]

      const tarif = await DBService.createTarif(
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
        },
        cb.from.id,
      )

      for (let i = 0; i < pricesId.length; ) {
        await DBService.addPrice(pricesId[i], tarif.id)
        i++
      }

      return true
    }

    switch (cb.data) {
      /* REGISTRATION */
      case 'reg_skip_name':
        incrementRegistrationStep()
        break
      case 'reg_welcome_tarif':
        this.cache.reg[cb.from.id].code = 'welcome_tarif'
        incrementRegistrationStep()
        break
      case 'reg_confirm':
        incrementRegistrationStep()
        delete this.cache.reg[cb.from.id]
        break
      case 'reg_reset':
      case 'welcome_start':
        this.createCacheUser(cb.from.id, cb.from?.first_name)
        TgService.start(cb.from.id, this.cache.reg[cb.from.id])
        break
      case 'welcome_info':
        TgService.info(cb.from.id)
        break
      case 'reg_start':
        TgService.info(cb.from.id)
        break

      /* TARIF */
      case 'tarif_add_price':
        this.cache.tarif[cb.from.id].updatedAt = Date.now()
        this.cache.tarif[cb.from.id].step = 10
        TgService.createTarif(cb.from.id, this.cache.tarif[cb.from.id], this.cache.price)
        break
      case 'tarif_continue':
        const success = await createTarif()
        if (success) {
          incrementTarifStep()
        }
        break

      // CODE
      case 'code_reset':
      case 'code_add_new':
        delete this.cache.code[cb.from.id]
        this.code(cb.from.id)
        break
      case 'code_confirm':
        DBService.createCode(this.cache.code[cb.from.id])
        break
      case 'code_back':
        break
    }

    /* REGISTRATION LANG */
    if (cb.data?.startsWith('reg_lang_')) {
      this.cache.reg[cb.from.id].language = cb.data.replace('reg_lang_', '') as Language
      incrementRegistrationStep()
    }

    /* TARIF TYPE */
    if (cb.data?.startsWith('tarif_type_')) {
      const type = cb.data.replace('tarif_type_', '') as TarifType
      this.cache.tarif[cb.from.id].type = type
      incrementTarifStep()
    }

    /* TARIF ID AND NAME */
    if (cb.data?.startsWith('code_tarif_')) {
      this.cache.code[cb.from.id].tarifName = cb.data.replace(/^.*_(.*)_\d+$/, '$1')
      this.cache.code[cb.from.id].tarifId = parseInt(cb.data.replace(/^.*_(\d+)$/, '$1'))
      this.cache.code[cb.from.id].step++
      TgService.createCode(cb.from.id, this.cache.code[cb.from.id])
    }

    /* CURRENCY */
    if (cb.data?.startsWith('tarif_currency_')) {
      const currency = cb.data.replace('tarif_currency_', '') as Currency
      this.createCachePrice(currency)
      this.cache.price[currency].currency = currency
      this.cache.tarif[cb.from.id].currency = currency
      incrementTarifStep()
    }
  }
}

export default new TgController()
