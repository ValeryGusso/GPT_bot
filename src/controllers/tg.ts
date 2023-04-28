import { CallbackQuery, Message } from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import TgService from '../services/tg.js'
import DBService from '../services/db.js'
import CacheService from '../services/cache.js'
import { ICache, IRandomModel } from '../interfaces/tg.js'
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
    user: {},
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

  private async checkAuthAndRegistration(chatId: number, text: string, user: FullUser | null, name: string) {
    if (text !== '/start' && !user && !this.cache.reg[chatId]) {
      await TgService.welcome(chatId)
      return false
    }

    if (text === '/start' && !user) {
      this.createCacheReg(chatId, name)

      await TgService.start(chatId, this.cache.reg[chatId])
      return false
    }

    if (text === '/start' && user) {
      await TgService.sendCommandsList(chatId)
      return true
    }

    if (this.cache.reg[chatId]) {
      switch (this.cache.reg[chatId].step) {
        case 1:
          await TgService.start(
            chatId,
            this.cache.reg[chatId],
            'Это немного не то, что я хотел бы получить от тебя в ответ. Давай всё таки определимся с языком',
          )
          return false
        case 2:
          this.cache.reg[chatId].name = text
          this.cache.reg[chatId].step++
          await TgService.start(chatId, this.cache.reg[chatId])
          return false
        case 3:
          const isValid = await DBService.validateCode(text)
          if (isValid) {
            this.cache.reg[chatId].code = text
            this.cache.reg[chatId].step++
            await TgService.start(chatId, this.cache.reg[chatId])
            return false
          }

          await this.sendError(
            chatId,
            'Код невалиден, пожалуйста, укажи валидный код или воспользуйся стартовым тарифом',
          )
          await TgService.start(chatId, this.cache.reg[chatId])
          return false

        case 4:
          await TgService.start(
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
    if (!this.cache.settings[chatId]) {
      this.createCacheSettings(chatId)
    }
    this.createCacheContext(chatId)

    if (text === '/settings') {
      await TgService.settings(chatId, user)
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
        const isValid = await DBService.validateCode(text)
        if (isValid) {
          await TgService.activateCode(chatId, text, user)
          this.cache.settings[chatId].updatedAt = Date.now()
          this.cache.settings[chatId].promo = false
          return
        }
        await this.sendError(chatId, 'Код невалиден')
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
    this.clearAllCacheById(chatId)
    await DBService.clearContext(chatId)
    TgService.sendMessage(chatId, 'Задай мне любой интересующий тебя вопрос!', true)
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

    switch (this.cache.code[chatId].step) {
      case 1:
        this.cache.code[chatId].value = text
        await incementStep()
        break

      case 2:
        this.cache.code[chatId].limit = parseInt(text)
        await incementStep()
        break

      default:
        await incementStep(true)
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
      /* PREVALIDATION */
      if (!text) {
        await TgService.sendMessage(chatId, 'Не указан текст сообщения!')
        return
      }

      // /*  UNAUTH COMMAND HANDLER */
      if (text.startsWith('/')) {
        /* SHOW MENU */
        if (text === '/menu') {
          await TgService.sendMenu(chatId)
          return
        }

        /* INFO */
        if (text === '/info') {
          await TgService.sendInfo(chatId)
          return
        }

        /* ABOUT */
        if (text === '/about') {
          await TgService.sendAbout(chatId)
          return
        }

        /* HELP */
        if (text === '/help') {
          await TgService.sendCommandsList(chatId)
          return
        }
      }

      /* CHECK AUTH AND REGISTRATION */
      const user = await DBService.getByChatIdUnsafe(chatId)

      const checkAuth = this.checkAuthAndRegistration(chatId, text, user, msg.from?.first_name || 'Незнакомец')

      if (!checkAuth) {
        await this.sendError(chatId, 'Произошла ошибка авторизации.')
        return
      }

      if (!isFullUser(user)) {
        await this.sendError(chatId, 'Произошла ошибка валидации пользователя')
        return
      }

      /*  AUTH COMMAND HANDLER */
      if (text.startsWith('/')) {
        /* RESET CONTEXT */
        if (text === '/reset') {
          await TgService.clearContext(chatId, 'context')
          return
        }

        /* SETTINGS */
        if (text === '/settings' || this.cache.settings[chatId] || this.cache.context[chatId]) {
          await this.settings(chatId, text, user)
          return
        }

        /* START CHAT */
        if (text === '/chat') {
          await this.startShat(chatId)
          return
        }

        /* CREATE CODE */
        if (text === '/code' && user.isAdmin) {
          await this.code(chatId, text)
          return
        }

        /* CREATE TARIF */
        if (text === '/tarif' && user.isAdmin) {
          this.createCacheTarif(chatId)
          await this.tarif(chatId, text)

          return
        }

        if (text !== '/start') {
          await TgService.sendMessage(
            chatId,
            'Неопознанная комманда. Для получения списка всех комманд воспользуйтесь \n/help\nДля вызова меню воспользуйтесь \n/menu',
          )
        }
        return
      }

      /* INPUTS */

      /* SETTINGS */
      if (this.cache.settings[chatId] || this.cache.context[chatId]) {
        await this.settings(chatId, text, user)
        return
      }

      /* CODE */
      if (this.cache.code[chatId]) {
        await this.code(chatId, text)
        return
      }

      /* TARIF */
      if (this.cache.tarif[chatId]) {
        await this.tarif(chatId, text)
        return
      }

      /* SKIPP ALL ACTIONS, SEND QUESTION TO GPT */
      // this.sendError(chatId, 'С какого-то хуя дошло досюда')
      TgService.sendQuestion(chatId, text, user)
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
          this.createCacheTarif(chatId)
          this.tarif(chatId, '/tarif')
          break

        /* CODE */
        case 'code_add_new':
          this.createCacheCode(chatId)
          this.code(chatId, '/code')
          break

        case 'code_confirm':
          this.cache.code[chatId].step++
          await TgService.createCode(chatId, this.cache.code[chatId])
          delete this.cache.code[chatId]
          break

        /* SHOW CASE */
        case 'show_menu':
          TgService.sendMenu(chatId)
          break

        case 'show_about':
          TgService.sendAbout(chatId)
          break

        case 'show_greeting':
          TgService.sendCommandsList(chatId)
          break

        case 'show_settings':
          this.createCacheContext(chatId)
          this.createCacheSettings(chatId)
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
            return
          }

          /* SETTINGS ALL TARIF BUTTONS */
          if (cb.data?.startsWith('settings_tarifs_')) {
            TgService.sendTarifById(chatId, getQueryId(cb.data))
            return
          }

          if (cb.data.startsWith('tarif_select_')) {
            TgService.sendTarifPrices(chatId, getQueryId(cb.data))
          }

          if (cb.data.startsWith('tarif_buy_')) {
            TgService.sendTarifBuy(chatId, getQueryId(cb.data))
          }

          /* RANDOM MODEL AND VALUES */
          if (cb.data?.startsWith('settings_random_model_')) {
            const model = getQueryName(cb.data) as RandomModels

            this.cache.settings[chatId].randomModel.model = model

            if (cb.data.startsWith('settings_random_model_both_')) {
              await TgService.sendRandomValues(chatId, 'temperature', getQueryId(cb.data))
              return
            }

            TgService.sendRandomValues(chatId, model, getQueryId(cb.data))
            return
          }

          if (cb.data?.startsWith('settings_random_value_')) {
            const model = getRandomModelName(cb.data) as RandomModels
            const value = getRandomModelValue(cb.data)

            if (this.cache.settings[chatId].randomModel.model === 'both') {
              switch (this.cache.settings[chatId].randomModel.step) {
                case 1:
                  this.cache.settings[chatId].randomModel.step++
                  this.cache.settings[chatId].randomModel.temperature = value
                  await TgService.sendRandomValues(chatId, 'topP', getQueryId(cb.data))
                  break
                case 2:
                  this.cache.settings[chatId].randomModel.topP = value
                  TgService.changeRandomModel(chatId, getQueryId(cb.data), this.cache.settings[chatId].randomModel)
                  break
              }
              return
            }

            this.cache.settings[chatId].randomModel.model = model
            this.cache.settings[chatId].randomModel.value = value
            await TgService.changeRandomModel(chatId, getQueryId(cb.data), this.cache.settings[chatId].randomModel)
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

            this.cache.settings[chatId].updatedAt = Date.now()
            this.cache.settings[chatId].name = true

            TgService.sendNameChoice(chatId, getToggleValue(cb.data))
            return
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
            return
          }

          /* TOGGLE */
          if (cb.data?.startsWith('settings_lang_')) {
            TgService.sendLanguages(chatId, getQueryId(cb.data))
            return
          }

          if (cb.data?.startsWith('toggle_language_')) {
            await TgService.languageToggle(chatId, getToggleId(cb.data), getToggleValue(cb.data) as Language)
            return
          }

          if (cb.data?.startsWith('toggle_context_')) {
            await TgService.contextToggle(
              chatId,
              getToggleId(cb.data),
              getToggleValue(cb.data),
              !!(this.cache.settings[chatId] || this.cache.context[chatId]),
            )
            return
          }

          if (cb.data.startsWith('toggle_service_info_')) {
            await TgService.serviceInfoToggle(chatId, getToggleId(cb.data), getToggleValue(cb.data))
            return
          }
      }
    } catch (err: any) {
      console.log(err)
      this.sendError(chatId, err.message)
    }
  }
}

export default new TgController(hour)
