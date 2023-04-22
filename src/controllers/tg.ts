import { CallbackQuery, Message } from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import TgService from '../services/tg.js'
import DBService from '../services/db.js'
import { ICache, IPrice, KeysOfCache } from '../interfaces/tg.js'
import { CreatePriceArguments, FullUser } from '../interfaces/db.js'
import { Currency, Language, TarifType } from '@prisma/client'
import { allCurrencys } from '../const/const.js'
import {
  getContextId,
  getContextValue,
  getQueryId,
  getQueryName,
  getRandomModelName,
  getRandomModelValue,
  getToggleId,
  getToggleValue,
} from '../const/utils.js'

dotenv.config()

class TgController {
  private cache: ICache = {
    reg: {},
    tarif: {},
    price: {},
    code: {},
    settings: {},
    context: {},
  }
  private readonly cacheExpires = 60 * 60 * 1000
  private clearAllCacheById(chatId: number) {
    const keys: KeysOfCache[] = ['reg', 'tarif', 'price', 'code', 'settings', 'context']

    keys.forEach((primaryKey) => {
      delete this.cache[primaryKey][chatId]
    })
  }
  private sendError(chatId: number, message: string) {
    this.clearAllCacheById(chatId)
    TgService.sendMessage(chatId, 'Упс... что-то пошло не так, попробуй ещё раз.' + '\n' + message)
  }
  private clearCache() {
    // const curTime = Date.now()
    // const keys: KeysOfCache[] = ['reg', 'tarif', 'price', 'code', 'settings', 'context']
    // keys.forEach((primaryKey) => {
    //   for (const key in this.cache[primaryKey]) {
    //     // this.cache[primaryKey][key]
    //     // if (curTime - this.cache[primaryKey][key].updatedAt > this.cacheExpires) {
    //     //   delete this.cache.reg[key]
    //     // }
    //   }
    // })
  }

  constructor() {
    setInterval(() => {
      this.clearCache()
    }, this.cacheExpires)
  }

  /* UTILS */
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

  private createCachePrice(id: number) {
    const result: IPrice = {} as IPrice

    allCurrencys.forEach((cur) => {
      result[cur] = {
        currency: cur,
        value: 0,
        updatedAt: Date.now(),
      }
    })
    this.cache.price[id] = result
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

  private createCacheSettings(id: number) {
    this.cache.settings[id] = { name: false, promo: false }
  }

  private createCacheContext(id: number) {
    this.cache.context[id] = { length: false, service: false, random: false }
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
      TgService.createTarif(id, this.cache.tarif[id], this.cache.price[id])
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
        this.cache.price[id][this.cache.tarif[id].currency!].value = parseInt(text)
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
        this.cache.code[id].value = text || 'default'
        await incementStep()
        break
      case 2:
        this.cache.code[id].limit = parseInt(text || '1')
        await incementStep()
        break
      case 3:
        await incementStep()
        break
    }
  }

  private async settings(id: number) {
    if (this.cache.context[id]) {
      TgService.settingsError(id)
    }
  }

  /* LISTENERS */
  async message(msg: Message) {
    const { text } = msg
    const chatId = msg.chat.id

    try {
      /* PREVALIDATION */

      if (!text) {
        TgService.sendMessage(chatId, 'Не указан текст сообщения!')
        return
      }

      // /* CHEC UTH AND REGISTRATION */
      const user = await DBService.getByChatId(chatId)

      const checkAuth = this.checkAuthAndRegistration(chatId, text, user, msg.from?.first_name)

      if (!checkAuth) {
        return
      }

      if (text === '/test') {
        TgService.test(chatId)
        return
      }

      /* RESET CONTEXT */
      if (text === '/reset') {
        DBService.clearContext(user)
        // GPTController.resetContext(chatId)
        return
      }

      /* SHOW MENU */
      if (text === '/menu') {
        TgService.sendMenu(chatId, user)
        return
      }

      /* SETTINGS */
      if (text === '/settings') {
        this.createCacheSettings(chatId)
        TgService.settings(chatId, user)
        return
      }

      if (this.cache.settings[chatId]) {
        if (this.cache.settings[chatId].name) {
          await TgService.changeName(chatId, text, user)
          this.cache.settings[chatId].name = false
          return
        }

        if (this.cache.settings[chatId].promo) {
          await TgService.activateCode(chatId, text, user)
          this.cache.settings[chatId].promo = false
          return
        }
      }

      if (this.cache.context[chatId]) {
        if (this.cache.context[chatId].length) {
          const length = parseInt(text)

          if (!length || length < 1 || length > user.activity?.tarif?.maxContext!) {
            await TgService.contextLengthError(chatId, user.activity?.tarif?.maxContext!, user.id)
            return
          }
          await TgService.changeContextLength(chatId, length, user.id)
          this.cache.context[chatId].length = false
          return
        }
      }
      /* HELP */
      if (text === '/help') {
        return
      }

      /* INFO */
      if (text === '/info') {
        TgService.info(chatId)
        return
      }

      /* CREATE CODE */
      // if (text === '/code' && user.isAdmin) {
      if (text === '/code') {
        this.code(chatId, text)
        return
      }

      if (this.cache.code[chatId]) {
        this.code(chatId, text)
        return
      }

      /* CREATE TARIF */
      // if (text === '/tarif' && user.isAdmin) {
      if (text === '/tarif') {
        if (this.cache.tarif[chatId]) {
          this.tarif(chatId, text)
          return
        } else {
          this.createCacheTarif(chatId)
          TgService.createTarif(chatId, this.cache.tarif[chatId], this.cache.price[chatId])
          return
        }
      }

      if (this.cache.tarif[chatId]) {
        this.tarif(chatId, text)
      }

      /* SKIPP ALL ACTIONS, SEND QUESTION TO GPT */
      if (!text.startsWith('/')) {
        TgService.sendQuestion(chatId, text, user)
      } else {
        TgService.sendMessage(
          chatId,
          'Неопознанная комманда. Для получения списка всех комманд воспользуйтесь \n/help\nДля вызова меню воспользуйтесь \n/menu',
        )
      }
    } catch (err: any) {
      this.sendError(chatId, err.message)
    }
  }

  async callback(cb: CallbackQuery) {
    if (cb.data === 'edit') {
      return
    }

    const chatId = cb.from.id

    try {
      const incrementRegistrationStep = () => {
        this.cache.reg[chatId].updatedAt = Date.now()
        this.cache.reg[chatId].step++
        TgService.start(chatId, this.cache.reg[chatId])
      }

      const incrementTarifStep = () => {
        this.cache.tarif[chatId].updatedAt = Date.now()
        this.cache.tarif[chatId].step++
        TgService.createTarif(chatId, this.cache.tarif[chatId], this.cache.price[chatId])
      }

      const createTarif = async () => {
        /* CREATING TARIF */
        const { name, title, description, image, limit, dailyLimit, type, maxContext, duration } =
          this.cache.tarif[chatId]

        const tarif = await DBService.createTarif({
          name,
          title,
          description,
          image,
          limit,
          dailyLimit,
          maxContext,
          duration,
          type,
        })

        /* CREATING PRICES */
        const prices: CreatePriceArguments[] = []

        for (const key in this.cache.price[chatId]) {
          prices.push({
            value: this.cache.price[chatId][key as Currency].value,
            currency: this.cache.price[chatId][key as Currency].currency,
          })
        }

        for (let i = 0; i < prices.length; ) {
          await DBService.createPrice(prices[i].value, prices[i].currency, tarif.id)
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
          this.cache.reg[chatId].code = 'welcome'
          incrementRegistrationStep()
          break
        case 'reg_confirm':
          incrementRegistrationStep()
          delete this.cache.reg[chatId]
          break
        case 'reg_reset':
        case 'welcome_start':
          this.createCacheUser(chatId, cb.from?.first_name)
          TgService.start(chatId, this.cache.reg[chatId])
          break
        case 'welcome_info':
        case 'reg_start':
          TgService.info(chatId)
          break

        /* TARIF */
        case 'tarif_add_price':
          this.cache.tarif[chatId].updatedAt = Date.now()
          this.cache.tarif[chatId].step = 10
          TgService.createTarif(chatId, this.cache.tarif[chatId], this.cache.price[chatId])
          break
        case 'tarif_continue':
          const success = await createTarif()
          if (success) {
            incrementTarifStep()
            delete this.cache.tarif[chatId]
            delete this.cache.price[chatId]
          }
          break

        /* CODE */
        case 'code_reset':
        case 'code_add_new':
          delete this.cache.code[chatId]
          this.code(chatId)
          break
        case 'code_confirm':
          await DBService.createCode(this.cache.code[chatId])
          this.code(chatId)
          break
        case 'code_back':
          delete this.cache.code[chatId]
          TgService.sendMessage(chatId, '/menu')
          break

        /* MENU */
        case 'show_menu':
          TgService.sendMessage(chatId, '/menu')
          break

        /* RESET CONTEXT */
        case 'context_reset':
          DBService.clearContext(chatId)
          break

        /* SHOW SETTINGS */
        case 'settings_show':
          TgService.settings(chatId)
          break

        /* BACK TO CHAT WITH BOT */
        case 'back_to_chat':
          delete this.cache.context[chatId]
          delete this.cache.settings[chatId]
          break

        /* SITTIBGS BUTTOBS */
        case 'settings_service_info':
          break
        // case 'settings_random':
        //   await TgService.sendRandomModels(chatId, getQueryId(cb.data))
        //   break
        case 'tarifs_send_code':
          if (!this.cache.settings[chatId]) {
            this.createCacheSettings(chatId)
          }
          this.cache.settings[chatId].promo = true

          TgService.sendCodeInput(chatId)
          break
        case 'tarifs_show_all':
          TgService.sendTarifs(chatId)
          break
        case 'settings_limits':
          break
        case 'settings_version':
          break

        default:
          /* REGISTRATION SELECT LANGUAGE */
          if (cb.data?.startsWith('reg_lang_')) {
            this.cache.reg[chatId].language = cb.data.replace('reg_lang_', '') as Language
            incrementRegistrationStep()
            return
          }

          /* TARIF TYPE */
          if (cb.data?.startsWith('tarif_type_')) {
            const type = cb.data.replace('tarif_type_', '') as TarifType
            this.cache.tarif[chatId].type = type
            incrementTarifStep()
            return
          }

          /* TARIF DURATION */
          if (cb.data?.startsWith('tarif_duration_')) {
            this.cache.tarif[chatId].duration = parseInt(cb.data.replace('tarif_duration_', ''))
            incrementTarifStep()
            return
          }

          /* TARIF ID AND NAME */
          if (cb.data?.startsWith('code_tarif_')) {
            this.cache.code[chatId].tarifName = getQueryName(cb.data)
            this.cache.code[chatId].tarifId = getQueryId(cb.data)
            this.cache.code[chatId].step++
            TgService.createCode(chatId, this.cache.code[chatId])
            return
          }

          /* CURRENCY */
          if (cb.data?.startsWith('tarif_currency_')) {
            const currency = cb.data.replace('tarif_currency_', '') as Currency
            this.createCachePrice(chatId)
            this.cache.price[chatId][currency].currency = currency
            this.cache.tarif[chatId].currency = currency
            incrementTarifStep()
            return
          }

          /* MENU OPTIONS */
          if (cb.data?.startsWith('menu_')) {
            TgService.sendMessage(chatId, '/' + cb.data.replace('menu_', ''))
            return
          }

          /* SETTINGS ALL TARIF BUTTONS */
          if (cb.data?.startsWith('settings_tarifs_')) {
            TgService.sendTarifById(chatId, getQueryId(cb.data))
            return
          }

          /* RANDOM MODEL AND VALUES */
          if (cb.data?.startsWith('settings_random_model_')) {
            TgService.sendRandomValues(chatId, getQueryName(cb.data), getQueryId(cb.data))
            return
          }

          if (cb.data?.startsWith('settings_random_value')) {
            TgService.changeRandomModel(
              chatId,
              getRandomModelName(cb.data),
              getRandomModelValue(cb.data),
              getQueryId(cb.data),
            )
            return
          }

          if (cb.data?.startsWith('settings_random_')) {
            TgService.sendRandomModels(chatId, getQueryId(cb.data))
            return
          }

          /* CHANGE NAME */
          if (cb.data?.startsWith('settings_name_')) {
            if (!this.cache.settings[chatId]) {
              this.createCacheSettings(chatId)
            }
            this.cache.settings[chatId].name = true

            TgService.sendNameChoice(chatId, getToggleValue(cb.data))
            return
          }

          /* CHANGE CONTEXT LENGTH */
          if (cb.data?.startsWith('context_change_length_')) {
            if (!this.cache.context[chatId]) {
              this.createCacheContext(chatId)
            }
            this.cache.context[chatId].length = true
            TgService.sendContextLengthChoise(
              chatId,
              getContextValue(cb.data),
              getContextId(cb.data),
            )
            return
          }

          if (cb.data?.startsWith('context_length_')) {
            TgService.changeContextLength(chatId, getContextValue(cb.data), getContextId(cb.data))
            return
          }
          /* LANGUAGE TOGGLE*/
          if (cb.data?.startsWith('settings_lang_')) {
            TgService.sendLanguages(chatId, getQueryId(cb.data))
            return
          }

          if (cb.data?.startsWith('language_toggle_')) {
            await TgService.languageToggle(
              chatId,
              getToggleId(cb.data),
              getToggleValue(cb.data) as Language,
            )
            return
          }

          /* CONTEXT TOGGLE*/
          if (cb.data?.startsWith('context_toggle_')) {
            await TgService.contextToggle(
              chatId,
              getToggleId(cb.data),
              getToggleValue(cb.data),
              !!(this.cache.settings[chatId] || this.cache.context[chatId]),
            )
            return
          }
      }

      /* ADD CHECKBOX TO SEARCHED BUTTON */
      TgService.editButton(
        chatId,
        cb.message?.message_id!,
        cb.data!,
        '✅ ',
        cb.message?.reply_markup!,
      )
    } catch (err: any) {
      this.sendError(chatId, err.message)
    }
  }
}

export default new TgController()
