import { CallbackQuery, Message } from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import TgService from '../services/tg.js'
import DBService from '../services/db.js'
import CacheService from '../services/cache.js'
import { CreatePriceArguments, FullUser } from '../interfaces/db.js'
import { Currency, Language, RandomModels, TarifType } from '@prisma/client'
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
  /* UTILS */
  private async checkAuthAndRegistration(chatId: number, text: string) {
    const unsafeUser = await CacheService.getUser(chatId)

    if (text !== '/start' && !unsafeUser) {
      await TgService.welcome(chatId)
      return false
    }

    if (text === '/start') {
      if (unsafeUser) {
        await TgService.sendCommandsList(chatId)
        return true
      } else {
        await TgService.start(chatId)
        return false
      }
    }

    if (unsafeUser) {
      return true
    }

    const registration = CacheService.getReg(chatId)
    if (registration) {
      switch (registration.step) {
        case 1:
          await TgService.start(
            chatId,
            'Это немного не то, что я хотел бы получить от тебя в ответ. Давай всё таки определимся с языком',
          )
          return false
        case 2:
          registration.name = text
          registration.step++
          await TgService.start(chatId)
          return false
        case 3:
          const isValid = await DBService.validateCode(text)
          if (isValid) {
            registration.code = text
            registration.step++
            await TgService.start(chatId)
            return false
          }

          await this.sendError(
            chatId,
            'Код невалиден, пожалуйста, укажи валидный код или воспользуйся стартовым тарифом',
          )
          await TgService.start(chatId)
          return false

        case 4:
          await TgService.start(
            chatId,
            'Это немного не то, что я хотел бы получить от тебя в ответ. Давай всё таки сверим данные и завершим регистрацию',
          )
          return false
      }
      return false
    }

    return true
  }

  private async settings(chatId: number, text: string) {
    const settings = CacheService.getSettings(chatId)
    const context = CacheService.getContext(chatId)
    const { user } = await CacheService.getUser(chatId)

    if (text === '/settings') {
      await TgService.settings(chatId)
      return
    }

    if (settings) {
      if (settings.name) {
        await TgService.changeName(chatId, text)
        settings.updatedAt = Date.now()
        settings.name = false
        await CacheService.updateUser(chatId)
        return
      }

      if (settings.promo) {
        const isValid = await DBService.validateCode(text)
        if (isValid) {
          await TgService.activateCode(chatId, text)
          settings.updatedAt = Date.now()
          settings.promo = false
          await CacheService.updateUser(chatId)
          return
        }
        await this.sendError(chatId, 'Код невалиден')
      }
    }

    if (context) {
      if (context.length) {
        const length = parseInt(text)

        if (!length || length < 1 || length > user.activity?.tarif?.maxContext!) {
          await TgService.contextLengthError(chatId, user.activity?.tarif?.maxContext!, user.id)
          return
        }
        await TgService.changeContextLength(chatId, length, user.id)
        context.updatedAt = Date.now()
        context.length = false
        await CacheService.updateUser(chatId)
        return
      }

      if (context.service) {
        if (!text) {
          await this.sendError(chatId, 'Необходимо указать корректные параметры!')
          await TgService.sendQueryInput(chatId)
          return
        }
        await TgService.changeQuery(chatId, text)
        context.updatedAt = Date.now()
        context.service = false
        await CacheService.updateUser(chatId)
        return
      }
    }
  }

  private async startShat(chatId: number) {
    CacheService.clearAll(chatId)
    await DBService.clearContext(chatId)
    TgService.sendMessage(chatId, 'Задай мне любой интересующий тебя вопрос!', true)
  }

  private async tarif(chatId: number, text: string) {
    const tarif = CacheService.getTarif(chatId)
    const { prices } = CacheService.getPrice(chatId)

    /* UTILS */
    const incrementRegistrationStep = async (isRetry?: boolean) => {
      tarif.updatedAt = Date.now()
      if (!isRetry) {
        tarif.step++
      }
      await TgService.createTarif(chatId)
    }

    /* PREVALIDATION */

    /* INITIAL CASE */
    if (text === '/tarif') {
      await TgService.createTarif(chatId)
      return
    }

    if (text === '*wrong_case*') {
      await this.sendError(chatId, 'Указаны невалидные данные')
      incrementRegistrationStep(true)
      return
    }

    /* NUMBERS CASES */

    if (((tarif.step >= 5 && tarif.step <= 9) || tarif.step === 11) && Number.isNaN(parseInt(text))) {
      this.tarif(chatId, '*wrong_case*')
      return
    }

    /* BUTTON CASES */
    if (tarif.step === 9 || tarif.step === 10 || tarif.step === 13) {
      this.tarif(chatId, '*wrong_case*')
      return
    }

    /* HANDLERS */
    switch (tarif.step) {
      case 1:
        tarif.name = text
        return incrementRegistrationStep()

      case 2:
        tarif.title = text
        return incrementRegistrationStep()

      case 3:
        tarif.description = text
        return incrementRegistrationStep()

      case 4:
        tarif.image = text
        return incrementRegistrationStep()

      case 5:
        tarif.limit = parseInt(text)
        return incrementRegistrationStep()

      case 6:
        tarif.dailyLimit = parseInt(text)
        return incrementRegistrationStep()

      case 7:
        tarif.maxContext = parseInt(text)
        return incrementRegistrationStep()

      case 8:
        tarif.duration = parseInt(text)
        return incrementRegistrationStep()

      case 11:
        const curPrice = prices[prices.length - 1]

        curPrice.value = parseInt(text)
        curPrice.updatedAt = Date.now()
        return incrementRegistrationStep()
    }
  }

  private async code(chatId: number, text: string) {
    const code = CacheService.getCode(chatId)
    const incementStep = async (isRetry?: boolean) => {
      if (!isRetry) {
        code.step++
      }
      await TgService.createCode(chatId)
    }

    if (text === '/code') {
      incementStep(true)
      return
    }

    if (code.step === 2 && Number.isNaN(parseInt(text))) {
      return await incementStep(true)
    }

    switch (code.step) {
      case 1:
        code.value = text
        await incementStep()
        break

      case 2:
        code.limit = parseInt(text)
        await incementStep()
        break

      default:
        await incementStep(true)
    }
  }

  private async sendError(chatId: number, message: string) {
    await TgService.sendMessage(chatId, 'Упс... что-то пошло не так, попробуй ещё раз.' + '\n' + message)
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

      /** UNAUTH COMMAND HANDLER */
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

      const checkAuth = await this.checkAuthAndRegistration(chatId, text)

      if (checkAuth) {
        CacheService.clearReg(chatId)
      } else {
        return
      }

      const { user } = await CacheService.getUser(chatId)
      const code = CacheService.getUnsafeCode(chatId)
      const settings = CacheService.getUnsafeSettings(chatId)
      const context = CacheService.getUnsafeContext(chatId)
      const tarif = CacheService.getUnsafeTaruf(chatId)

      /** AUTH COMMAND HANDLER */
      if (text.startsWith('/')) {
        /* RESET CONTEXT */
        if (text === '/reset') {
          await TgService.clearContext(chatId, 'context')
          return
        }

        /* SETTINGS */
        if (text === '/settings' || settings || context) {
          await this.settings(chatId, text)
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
          await this.tarif(chatId, text)

          return
        }

        if (text !== '/start') {
          await TgService.sendMessage(
            chatId,
            'Неопознанная команда. Для получения списка всех команд воспользуйтесь \n/help\nДля вызова меню воспользуйтесь \n/menu',
          )
        }
        return
      }

      /** INPUTS */

      /* SETTINGS */
      if (settings || context) {
        await this.settings(chatId, text)
        return
      }

      /* CODE */
      if (code) {
        await this.code(chatId, text)
        return
      }

      /* TARIF */
      if (tarif) {
        await this.tarif(chatId, text)
        return
      }

      /* SKIPP ALL ACTIONS, SEND QUESTION TO GPT */
      // this.sendError(chatId, 'Всё впорядке')
      TgService.sendQuestion(chatId, text)
    } catch (err: any) {
      console.log(err)
      this.sendError(chatId, err.message)
    }
  }

  async callback(cb: CallbackQuery) {
    const chatId = cb.from.id

    const settings = CacheService.getSettings(chatId)
    const context = CacheService.getContext(chatId)

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
      const registration = CacheService.getReg(chatId)
      const incrementRegistrationStep = () => {
        registration.updatedAt = Date.now()
        registration.step++
        TgService.start(chatId)
      }

      const incrementTarifStep = () => {
        CacheService.getTarif(chatId).updatedAt = Date.now()
        CacheService.getTarif(chatId).step++
        TgService.createTarif(chatId)
      }

      const createTarif = async () => {
        const { prices } = CacheService.getPrice(chatId)
        /* CREATING TARIF */
        const { name, title, description, image, limit, dailyLimit, type, maxContext, duration } =
          CacheService.getTarif(chatId)

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
        const pricesList: CreatePriceArguments[] = []

        prices.forEach((price) => {
          pricesList.push({
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

      // const registration = CacheService.getReg(chatId)
      switch (cb.data) {
        /* REGISTRATION */
        case 'reg_skip_name':
          registration.name = cb.from.first_name
          incrementRegistrationStep()
          break

        case 'reg_tarif_welcome':
          // const registration = CacheService.getReg(chatId)
          registration.code = 'welcome'
          incrementRegistrationStep()
          break

        case 'reg_confirm':
          incrementRegistrationStep()
          CacheService.clearReg(chatId)
          break

        case 'reg_start':
          TgService.start(chatId)
          break

        /* TARIF */
        case 'tarif_add_price':
          CacheService.getTarif(chatId).step = 9
          incrementTarifStep()
          break

        case 'tarif_continue':
          const success = await createTarif()
          if (success) {
            incrementTarifStep()
            CacheService.clearTarif(chatId)
            CacheService.clearPrice(chatId)
          }
          break

        case 'tarif_add_new':
          CacheService.clearTarif(chatId)
          this.tarif(chatId, '/tarif')
          break

        /* CODE */
        case 'code_add_new':
          CacheService.clearCode(chatId)
          this.code(chatId, '/code')
          break

        case 'code_confirm':
          const code = CacheService.getCode(chatId)

          code.step++
          await TgService.createCode(chatId)
          CacheService.clearCode(chatId)
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
          context.updatedAt = Date.now()
          context.service = true
          TgService.sendQueryInput(chatId)
          break

        case 'tarifs_send_code':
          settings.updatedAt = Date.now()
          settings.promo = true

          TgService.sendCodeInput(chatId)

        default:
          /* REGISTRATION SELECT LANGUAGE */
          if (cb.data?.startsWith('reg_lang_')) {
            const registration = CacheService.getReg(chatId)
            registration.language = cb.data.replace('reg_lang_', '') as Language
            incrementRegistrationStep()
            return
          }

          /* TARIF TYPE */
          if (cb.data?.startsWith('tarif_type_')) {
            const type = cb.data.replace('tarif_type_', '') as TarifType
            CacheService.getTarif(chatId).type = type
            incrementTarifStep()
            return
          }

          /* TARIF DURATION */
          if (cb.data?.startsWith('tarif_duration_')) {
            CacheService.getTarif(chatId).duration = parseInt(cb.data.replace('tarif_duration_', ''))
            incrementTarifStep()
            return
          }

          /* TARIF ID AND NAME */
          if (cb.data?.startsWith('code_tarif_')) {
            const code = CacheService.getCode(chatId)

            code.tarifName = getQueryName(cb.data)
            code.tarifId = getQueryId(cb.data)
            code.step++
            TgService.createCode(chatId)
            return
          }

          /* TARIF CURRENCY */
          if (cb.data?.startsWith('tarif_currency_')) {
            const { prices } = CacheService.getPrice(chatId)
            const currency = cb.data.replace('tarif_currency_', '') as Currency

            prices[prices.length] = {
              currency,
              value: 0,
              updatedAt: Date.now(),
            }

            CacheService.getTarif(chatId).currency = currency
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

            settings.randomModel.model = model

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

            if (settings.randomModel.model === 'both') {
              switch (settings.randomModel.step) {
                case 1:
                  settings.randomModel.step++
                  settings.randomModel.temperature = value
                  await TgService.sendRandomValues(chatId, 'topP', getQueryId(cb.data))
                  break
                case 2:
                  settings.randomModel.topP = value
                  TgService.changeRandomModel(chatId, getQueryId(cb.data), settings.randomModel)
                  break
              }
              return
            }

            settings.randomModel.model = model
            settings.randomModel.value = value
            await TgService.changeRandomModel(chatId, getQueryId(cb.data), settings.randomModel)
            await CacheService.updateUser(chatId)
            return
          }

          if (cb.data?.startsWith('settings_random_')) {
            TgService.sendRandomModels(chatId, getQueryId(cb.data))
            return
          }

          /* CHANGE NAME */
          if (cb.data?.startsWith('settings_name_')) {
            settings.updatedAt = Date.now()
            settings.name = true

            TgService.sendNameChoice(chatId, getToggleValue(cb.data))
            return
          }

          /* CHANGE CONTEXT LENGTH */
          if (cb.data?.startsWith('context_change_length_')) {
            context.updatedAt = Date.now()
            context.length = true

            TgService.sendContextLengthChoise(chatId, getContextValue(cb.data), getContextId(cb.data))
          }

          if (cb.data?.startsWith('context_length_')) {
            TgService.changeContextLength(chatId, getContextValue(cb.data), getContextId(cb.data))
            await CacheService.updateUser(chatId)
            return
          }

          /* TOGGLE */
          if (cb.data?.startsWith('settings_lang_')) {
            TgService.sendLanguages(chatId, getQueryId(cb.data))
            await CacheService.updateUser(chatId)
            return
          }

          if (cb.data?.startsWith('toggle_language_')) {
            await TgService.languageToggle(chatId, getToggleId(cb.data), getToggleValue(cb.data) as Language)
            await CacheService.updateUser(chatId)
            return
          }

          if (cb.data?.startsWith('toggle_context_')) {
            await TgService.contextToggle(
              chatId,
              getToggleId(cb.data),
              getToggleValue(cb.data),
              !!(settings || context),
            )
            await CacheService.updateUser(chatId)
            return
          }

          if (cb.data.startsWith('toggle_service_info_')) {
            await TgService.serviceInfoToggle(chatId, getToggleId(cb.data), getToggleValue(cb.data))
            await CacheService.updateUser(chatId)
            return
          }
      }
    } catch (err: any) {
      console.log(err)
      this.sendError(chatId, err.message)
    }
  }
}

export default new TgController()
