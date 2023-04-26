import { CallbackQuery, Message } from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import TgService from '../services/tg.js'
import DBService from '../services/db.js'
import { ICache } from '../interfaces/tg.js'
import { CreatePriceArguments, FullUser } from '../interfaces/db.js'
import { Currency, Language, RandomModels, TarifType } from '@prisma/client'
import { hour } from '../const/const.js'
import {
  getContextId,
  getContextValue,
  getQueryId,
  getQueryName,
  getRandomModelName,
  getRandomModelValue,
  getToggleId,
  getToggleValue,
  isFullUser,
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
    language: {},
  }

  private readonly cacheExpires

  private clearAllCacheById(chatId: number) {
    for (const primaryKey in this.cache) {
      delete this.cache[primaryKey][chatId]
    }
  }

  private clearCache() {
    for (const primaryKey in this.cache) {
      const field = this.cache[primaryKey]

      for (const chatId in field) {
        if (this.cache[primaryKey][chatId].updatedAt + this.cacheExpires < Date.now()) {
          delete this.cache[primaryKey][chatId]
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

  /* UTILS */
  private createCacheReg(chatId: number, name: string) {
    this.cache.reg[chatId] = {
      name: name || 'Незнакомец',
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
      step: 1 /* IT WAS 0 */,
      updatedAt: Date.now(),
    }
  }

  private createCacheSettings(chatId: number) {
    this.cache.settings[chatId] = { name: false, promo: false, updatedAt: Date.now() }
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

  private async createCacheLanguage(chatId: number, user?: FullUser) {
    let safeUser: FullUser | undefined = user

    if (!isFullUser(safeUser)) {
      safeUser = await DBService.getByChatId(chatId)
    }

    this.cache.language[chatId] = {
      lang: safeUser.settings?.language!,
      updatedAt: Date.now(),
    }

    return safeUser.settings?.language!
  }

  private checkAuthAndRegistration(
    chatId: number,
    text: string,
    user: FullUser | null,
    name: string,
  ): user is FullUser {
    if (text !== '/start' && !user && !this.cache.reg[chatId]) {
      TgService.welcome(chatId)
      return false
    }

    if (text === '/start' && !user) {
      this.createCacheReg(chatId, name)

      TgService.start(chatId, this.cache.reg[chatId])
      return false
    }

    if (text === '/start' && user) {
      TgService.sendGreeting(chatId)
    }

    if (this.cache.reg[chatId]) {
      switch (this.cache.reg[chatId].step) {
        case 1:
          TgService.start(
            chatId,
            this.cache.reg[chatId],
            'Это немного не то, что я хотел бы получить от тебя в ответ. Давай всё таки определимся с языком',
          )
          return false
        case 2:
          this.cache.reg[chatId].name = text
          this.cache.reg[chatId].step++
          TgService.start(chatId, this.cache.reg[chatId])
          return false
        case 3:
          this.cache.reg[chatId].code = text
          this.cache.reg[chatId].step++
          TgService.start(chatId, this.cache.reg[chatId])
          return false
        case 4:
          TgService.start(
            chatId,
            this.cache.reg[chatId],
            'Это немного не то, что я хотел бы получить от тебя в ответ. Давай всё таки сверим данные и завершим регистрацию',
          )
          return false
      }
      return false
    }

    return true
  }

  private async settings(chatId: number, text: string, user: FullUser) {
    if (text === '/settings') {
      this.createCacheSettings(chatId)
      TgService.settings(chatId, user)
      return
    }

    if (this.cache.settings[chatId]) {
      if (this.cache.settings[chatId].name) {
        await TgService.changeName(chatId, text, user)
        this.cache.settings[chatId].updatedAt = Date.now()
        this.cache.settings[chatId].name = false
        return
      }

      if (this.cache.settings[chatId].promo) {
        await TgService.activateCode(chatId, text, user)
        this.cache.settings[chatId].updatedAt = Date.now()
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
        this.cache.context[chatId].updatedAt = Date.now()
        this.cache.context[chatId].length = false
        return
      }

      if (this.cache.context[chatId].service) {
        if (!text) {
          await this.sendError(chatId, 'Необходимо указать корректные параметры!')
          await TgService.sendQueryInput(chatId)
          return
        }
        await TgService.changeQuery(chatId, text, user)
        this.cache.context[chatId].updatedAt = Date.now()
        this.cache.context[chatId].service = false
        return
      }
    }
  }

  private async startShat(chatId: number) {
    delete this.cache.context[chatId]
    delete this.cache.settings[chatId]
    await DBService.clearContext(chatId)
    TgService.sendMessage(chatId, 'Задай мне любой интересующий тебя вопрос!')
  }

  private async tarif(chatId: number, text: string) {
    if (!this.cache.tarif[chatId]) {
      this.createCacheTarif(chatId)
    }

    /* UTILS */
    const incrementRegistrationStep = async (isRetry?: boolean) => {
      this.cache.tarif[chatId].updatedAt = Date.now()
      if (!isRetry) {
        this.cache.tarif[chatId].step++
      }
      await TgService.createTarif(chatId, this.cache.tarif[chatId], this.cache.price[chatId].prices)
    }

    /* PREVALIDATION */

    /* INITIAL CASE */
    if (text === '/tarif') {
      await TgService.createTarif(chatId, this.cache.tarif[chatId], this.cache.price[chatId].prices)
      return
    }

    if (text === '*wrong_case*') {
      await this.sendError(chatId, 'Указаны невалидные данные')
      incrementRegistrationStep(true)
      return
    }

    /* NUMBERS CASES */

    if (
      ((this.cache.tarif[chatId].step >= 5 && this.cache.tarif[chatId].step <= 9) ||
        this.cache.tarif[chatId].step === 11) &&
      Number.isNaN(parseInt(text))
    ) {
      this.tarif(chatId, '*wrong_case*')
      return
    }

    /* BUTTON CASES */
    if (
      this.cache.tarif[chatId].step === 9 ||
      this.cache.tarif[chatId].step === 10 ||
      this.cache.tarif[chatId].step === 13
    ) {
      this.tarif(chatId, '*wrong_case*')
      return
    }

    /* HANDLERS */
    switch (this.cache.tarif[chatId].step) {
      case 1:
        this.cache.tarif[chatId].name = text
        return incrementRegistrationStep()

      case 2:
        this.cache.tarif[chatId].title = text
        return incrementRegistrationStep()

      case 3:
        this.cache.tarif[chatId].description = text
        return incrementRegistrationStep()

      case 4:
        this.cache.tarif[chatId].image = text
        return incrementRegistrationStep()

      case 5:
        this.cache.tarif[chatId].limit = parseInt(text)
        return incrementRegistrationStep()

      case 6:
        this.cache.tarif[chatId].dailyLimit = parseInt(text)
        return incrementRegistrationStep()

      case 7:
        this.cache.tarif[chatId].maxContext = parseInt(text)
        return incrementRegistrationStep()

      case 8:
        this.cache.tarif[chatId].duration = parseInt(text)
        return incrementRegistrationStep()

      case 11:
        const curPrice = this.cache.price[chatId].prices[this.cache.price[chatId].prices.length - 1]

        curPrice.value = parseInt(text)
        curPrice.updatedAt = Date.now()
        return incrementRegistrationStep()
    }
  }

  private async code(chatId: number, text: string) {
    const incementStep = async (isRetry?: boolean) => {
      if (!isRetry) {
        this.cache.code[chatId].step++
      }
      await TgService.createCode(chatId, this.cache.code[chatId])
    }

    if (!this.cache.code[chatId]) {
      this.createCacheCode(chatId)
    }

    if (text === '/code') {
      incementStep(true)
      return
    }

    if (this.cache.code[chatId].step === 2 && Number.isNaN(parseInt(text))) {
      return await incementStep(true)
    }

    // if (this.cache.code[chatId].step === 2 && Number.isNaN(parseInt(text))) {
    //   return await incementStep(true)
    // }

    switch (this.cache.code[chatId].step) {
      case 1:
        this.cache.code[chatId].value = text
        await incementStep()
        break

      case 2:
        this.cache.code[chatId].limit = parseInt(text)
        await incementStep()
        break

      case 3:
        await incementStep()
        break
    }
  }

  private async sendError(chatId: number, message: string) {
    await TgService.sendMessage(chatId, 'Упс... что-то пошло не так, попробуй ещё раз.' + '\n' + message)
  }

  async getUserLanguage(chatId: number) {
    if (this.cache.language[chatId]) {
      return this.cache.language[chatId].lang
    } else {
      return await this.createCacheLanguage(chatId)
    }
  }

  /* LISTENERS */
  async message(msg: Message) {
    const { text } = msg
    const chatId = msg.chat.id
    const stop = TgService.sendTyping(chatId)
    stop()

    if (!text) {
      this.sendError(chatId, 'Необходимо указать текст сообщения!')
      return
    }

    try {
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
        this.tarif(chatId, text)
        return
      }

      if (this.cache.tarif[chatId]) {
        this.tarif(chatId, text)
        return
      }

      this.sendError(chatId, 'lajkdaj')
      return
      // /* PREVALIDATION */
      // if (!text) {
      //   TgService.sendMessage(chatId, 'Не указан текст сообщения!')
      //   return
      // }

      // /*  UNAUTH COMMAND HANDLER */
      // if (text.startsWith('/')) {
      //   /* SHOW MENU */
      //   if (text === '/menu') {
      //     TgService.sendMenu(chatId)
      //     return
      //   }

      //   /* INFO */
      //   if (text === '/info') {
      //     TgService.sendInfo(chatId)
      //     return
      //   }

      //   /* ABOUT */
      //   if (text === '/about') {
      //     TgService.sendAbout(chatId)
      //     return
      //   }

      //   /* HELP */
      //   if (text === '/help') {
      //     TgService.sendGreeting(chatId)
      //     return
      //   }
      // }

      // /* CHECK AUTH AND REGISTRATION */
      // const user = await DBService.getByChatId(chatId)

      // const checkAuth = this.checkAuthAndRegistration(chatId, text, user, msg.from?.first_name)

      // if (!checkAuth) {
      //   // this.sendError(chatId, 'Пользователь не найден.')
      //   return
      // }

      // /*  AUTH COMMAND HANDLER */
      // if (text.startsWith('/')) {
      //   /* RESET CONTEXT */
      //   if (text === '/reset') {
      //     TgService.clearContext(chatId, 'context')
      //   }

      //   /* SETTINGS */
      //   if (text === '/settings' || this.cache.settings[chatId] || this.cache.context[chatId]) {
      //     await this.settings(chatId, text, user)
      //   }

      //   /* START CHAT */
      //   if (text === '/chat') {
      //     this.startShat(chatId)
      //   }

      //   /* CREATE CODE */
      //   // if (text === '/code' && user.isAdmin) {
      //   if (text === '/code') {
      //     this.code(chatId, text)
      //   }

      //   if (this.cache.code[chatId]) {
      //     this.code(chatId, text)
      //   }

      //   /* CREATE TARIF */
      //   // if (text === '/tarif' && user.isAdmin) {
      //   if (text === '/tarif') {
      //     if (this.cache.tarif[chatId]) {
      //       this.tarif(chatId, text)
      //     } else {
      //       this.createCacheTarif(chatId)
      //       TgService.createTarif(chatId, this.cache.tarif[chatId], this.cache.price[chatId].prices)
      //     }
      //   }

      //   if (this.cache.tarif[chatId]) {
      //     this.tarif(chatId, text)
      //   }

      //   if (text !== '/start') {
      //     TgService.sendMessage(
      //       chatId,
      //       'Неопознанная комманда. Для получения списка всех комманд воспользуйтесь \n/help\nДля вызова меню воспользуйтесь \n/menu',
      //     )
      //   }
      //   return
      // }

      // /* SKIPP ALL ACTIONS, SEND QUESTION TO GPT */
      // TgService.sendQuestion(chatId, text, user)
    } catch (err: any) {
      console.log(err)
      this.sendError(chatId, err.message)
    }
  }

  async callback(cb: CallbackQuery) {
    const chatId = cb.from.id

    /* PREVALIDATION BUTTON */
    if (!cb.data || cb.data === 'edit') {
      return
    }

    /* ADD CHECKBOX TO SEARCHED BUTTON */
    TgService.editButton(chatId, cb.message?.message_id!, cb.data!, '✅ ', cb.message?.reply_markup!)

    const stop = TgService.sendTyping(chatId)
    stop()

    try {
      /* UTILS */
      const incrementRegistrationStep = () => {
        this.cache.reg[chatId].updatedAt = Date.now()
        this.cache.reg[chatId].step++
        TgService.start(chatId, this.cache.reg[chatId])
      }

      const incrementTarifStep = () => {
        this.cache.tarif[chatId].updatedAt = Date.now()
        this.cache.tarif[chatId].step++
        TgService.createTarif(chatId, this.cache.tarif[chatId], this.cache.price[chatId].prices)
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

        this.cache.price[chatId].prices.forEach((price) => {
          prices.push({
            value: price.value,
            currency: price.currency,
          })
        })

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

        case 'reg_tarif_welcome':
          this.cache.reg[chatId].code = 'welcome'
          incrementRegistrationStep()
          break

        case 'reg_confirm':
          incrementRegistrationStep()
          delete this.cache.reg[chatId]
          break

        case 'reg_start':
          this.createCacheReg(chatId, cb.from?.first_name)
          TgService.start(chatId, this.cache.reg[chatId])
          break

        /* TARIF */
        case 'tarif_add_price':
          this.cache.tarif[chatId].step = 9
          incrementTarifStep()
          break

        case 'tarif_continue':
          const success = await createTarif()
          if (success) {
            incrementTarifStep()
            delete this.cache.tarif[chatId]
            delete this.cache.price[chatId]
          }
          break

        case 'tarif_add_new':
          delete this.cache.tarif[chatId]
          this.createCacheTarif(chatId)
          this.tarif(chatId, '/tarif')
          break

        /* CODE */
        case 'code_add_new':
          this.code(chatId, '/code')
          break

        case 'code_confirm':
          this.cache.code[chatId].step++
          await TgService.createCode(chatId, this.cache.code[chatId])
          break

        /* SHOW CASE */
        case 'show_menu':
          TgService.sendMenu(chatId)
          break

        case 'show_about':
          TgService.sendAbout(chatId)
          break

        case 'show_greeting':
          TgService.sendGreeting(chatId)
          break

        case 'show_settings':
          TgService.settings(chatId)
          break

        case 'show_info':
          TgService.sendInfo(chatId)
          break

        case 'show_tarifs':
          TgService.sendTarifs(chatId)
          break

        case 'show_limits':
          TgService.sendMyTarif(chatId)
          break

        case 'show_version':
          TgService.sendVersion(chatId)
          break

        /* RESET CONTEXT */
        case 'context_reset':
          TgService.clearContext(chatId, 'settings')
          break

        /* BACK TO CHAT */
        case 'back_to_chat':
          this.startShat(chatId)
          break

        /* SETTINGS BUTTOBS */
        case 'settings_service_info':
          if (!this.cache.context[chatId]) {
            this.createCacheContext(chatId)
          }

          this.cache.context[chatId].updatedAt = Date.now()
          this.cache.context[chatId].service = true
          TgService.sendQueryInput(chatId)
          break

        case 'tarifs_send_code':
          if (!this.cache.settings[chatId]) {
            this.createCacheSettings(chatId)
          }

          this.cache.settings[chatId].updatedAt = Date.now()
          this.cache.settings[chatId].promo = true

          TgService.sendCodeInput(chatId)

        default:
          /* REGISTRATION SELECT LANGUAGE */
          if (cb.data?.startsWith('reg_lang_')) {
            this.cache.reg[chatId].language = cb.data.replace('reg_lang_', '') as Language
            incrementRegistrationStep()
          }

          /* TARIF TYPE */
          if (cb.data?.startsWith('tarif_type_')) {
            const type = cb.data.replace('tarif_type_', '') as TarifType
            this.cache.tarif[chatId].type = type
            incrementTarifStep()
          }

          /* TARIF DURATION */
          if (cb.data?.startsWith('tarif_duration_')) {
            this.cache.tarif[chatId].duration = parseInt(cb.data.replace('tarif_duration_', ''))
            incrementTarifStep()
          }

          /* TARIF ID AND NAME */
          if (cb.data?.startsWith('code_tarif_')) {
            this.cache.code[chatId].tarifName = getQueryName(cb.data)
            this.cache.code[chatId].tarifId = getQueryId(cb.data)
            this.cache.code[chatId].step++
            TgService.createCode(chatId, this.cache.code[chatId])
          }

          /* TARIF CURRENCY */
          if (cb.data?.startsWith('tarif_currency_')) {
            const currency = cb.data.replace('tarif_currency_', '') as Currency
            this.cache.price[chatId].prices[this.cache.price[chatId].prices.length] = {
              currency,
              value: 0,
              updatedAt: Date.now(),
            }
            this.cache.tarif[chatId].currency = currency
            incrementTarifStep()
          }

          /* SETTINGS ALL TARIF BUTTONS */
          if (cb.data?.startsWith('settings_tarifs_')) {
            TgService.sendTarifById(chatId, getQueryId(cb.data))
          }

          /* RANDOM MODEL AND VALUES */
          if (cb.data?.startsWith('settings_random_model_')) {
            TgService.sendRandomValues(chatId, getQueryName(cb.data) as RandomModels, getQueryId(cb.data))
          }

          if (cb.data?.startsWith('settings_random_value')) {
            TgService.changeRandomModel(
              chatId,
              getRandomModelName(cb.data),
              getRandomModelValue(cb.data),
              getQueryId(cb.data),
            )
          }

          if (cb.data?.startsWith('settings_random_')) {
            TgService.sendRandomModels(chatId, getQueryId(cb.data))
          }

          /* CHANGE NAME */
          if (cb.data?.startsWith('settings_name_')) {
            if (!this.cache.settings[chatId]) {
              this.createCacheSettings(chatId)
            }
            this.cache.settings[chatId].updatedAt = Date.now()
            this.cache.settings[chatId].name = true

            TgService.sendNameChoice(chatId, getToggleValue(cb.data))
          }

          /* CHANGE CONTEXT LENGTH */
          if (cb.data?.startsWith('context_change_length_')) {
            if (!this.cache.context[chatId]) {
              this.createCacheContext(chatId)
            }
            this.cache.context[chatId].updatedAt = Date.now()
            this.cache.context[chatId].length = true
            TgService.sendContextLengthChoise(chatId, getContextValue(cb.data), getContextId(cb.data))
          }

          if (cb.data?.startsWith('context_length_')) {
            TgService.changeContextLength(chatId, getContextValue(cb.data), getContextId(cb.data))
          }

          /* TOGGLE */
          if (cb.data?.startsWith('settings_lang_')) {
            TgService.sendLanguages(chatId, getQueryId(cb.data))
          }

          if (cb.data?.startsWith('toggle_language_')) {
            await TgService.languageToggle(chatId, getToggleId(cb.data), getToggleValue(cb.data) as Language)
          }

          if (cb.data?.startsWith('toggle_context_')) {
            await TgService.contextToggle(
              chatId,
              getToggleId(cb.data),
              getToggleValue(cb.data),
              !!(this.cache.settings[chatId] || this.cache.context[chatId]),
            )
          }
      }
    } catch (err: any) {
      console.log(err)
      this.sendError(chatId, err.message)
    }
  }
}

export default new TgController(hour)
