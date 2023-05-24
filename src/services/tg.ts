import TelegramBot, { InlineKeyboardButton, InlineKeyboardMarkup } from 'node-telegram-bot-api'
import GPTService from '../services/gpt.js'
import DBService from './db.js'
import CacheService from './cache.js'
import TextService from './text.js'
import { IRandomModel } from '../interfaces/tg.js'
import { Currency, Language, MessageRole, RandomModels, TarifType } from '@prisma/client'
import { timestampToDate, validateMarkdown } from '../const/utils.js'
import { commandsList, FAQ } from '../const/text.js'
import { day, month, year } from '../const/const.js'

class TgService {
  private readonly bot

  constructor() {
    this.bot = new TelegramBot(process.env.TG_TOKEN!, { polling: true })
  }

  /* BUTTONS */
  private readonly tarifsButton: InlineKeyboardButton = { text: 'Тарифы 💳', callback_data: 'show_tarifs' }
  private readonly aboutButton: InlineKeyboardButton = { text: 'О боте ℹ️', callback_data: 'show_about' }
  private readonly settingsButton: InlineKeyboardButton = { text: 'Настройки ⚙️', callback_data: `show_settings` }
  private readonly menuButton: InlineKeyboardButton = { text: 'Меню 📋', callback_data: `show_menu` }
  private readonly menuAndsettingSButtons: InlineKeyboardButton[] = [this.menuButton, this.settingsButton]
  private readonly contactMeButton: InlineKeyboardButton[] = [{ text: 'Связаться со мной', url: 'https://t.me/gusso' }]
  private readonly FAQButton: InlineKeyboardButton = { text: 'F.A.Q ❓', callback_data: 'show_info' }
  private readonly chatButton: InlineKeyboardButton[] = [
    {
      text: 'Начать чат! ✉️',
      callback_data: 'back_to_chat',
    },
  ]
  private contextButton(userId: number): InlineKeyboardButton[] {
    return [
      { text: 'Сбросить контекст 🔄', callback_data: 'context_reset' },
      { text: 'Отключить контекст', callback_data: `toggle_context_${userId}_off` },
    ]
  }
  private async getTarifButtons(prefix: string) {
    const tarifs = await DBService.getAllTarifs()

    const buttons: InlineKeyboardButton[][] = []
    let row = 0

    tarifs.forEach((tarif) => {
      const index = Math.floor(row / 5)

      if (!Array.isArray(buttons[index])) {
        buttons[index] = []
      }

      buttons[index].push({
        text: tarif.name,
        callback_data: prefix + tarif.name + '_' + tarif.id,
      })

      row++
    })

    return buttons
  }
  private async getPriceButtons(prefix: string, tarifId: number) {
    const pricess = await DBService.getAllPrices(tarifId)

    const buttons: InlineKeyboardButton[][] = []
    let row = 0

    pricess.forEach((price) => {
      const index = Math.floor(row / 5)

      if (!Array.isArray(buttons[index])) {
        buttons[index] = []
      }

      buttons[index].push({
        text: `${price.value} ${price.currency}`,
        callback_data: prefix + '_' + price.id,
      })

      row++
    })

    return buttons
  }

  /* UTILS */
  getBot() {
    return this.bot
  }

  async sendMessage(chatId: number, message: string, isStartChat?: boolean) {
    const user = await DBService.getByChatId(chatId)

    const inline_keyboard = [this.menuAndsettingSButtons]

    const contextButtons: InlineKeyboardButton[] = user.context?.useContext
      ? this.contextButton(user.id)
      : [{ text: 'Включить контекст', callback_data: `toggle_context_${user.id}_on` }]

    if (isStartChat) {
      inline_keyboard.unshift(contextButtons)
    }

    this.bot.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard },
    })
  }

  async welcome(chatId: number) {
    this.bot.sendMessage(
      chatId,
      'Для начала использования бота воспользуйся командой /start или же нажми на соответствующую кнопку!',
      {
        reply_markup: {
          inline_keyboard: [[this.FAQButton], [{ text: 'Начать! 🚀', callback_data: 'reg_start' }]],
        },
      },
    )
  }

  async sendCommandsList(chatId: number) {
    let header = 'Вот список всех доступных комманд:\n'
    const footer = '\nИли, ты можешь выбрать одно из наиболее популярных действий нажатием кнопки.'
    this.bot.sendMessage(chatId, header + commandsList + footer, {
      reply_markup: {
        inline_keyboard: [this.menuAndsettingSButtons, this.chatButton],
      },
    })
  }

  async editButton(chatId: number, messageId: number, query: string, replacer: string, marcup: InlineKeyboardMarkup) {
    const newMarkup: InlineKeyboardMarkup = {
      inline_keyboard: [],
    }

    marcup?.inline_keyboard.forEach((row, rowIndex) =>
      row.forEach((el) => {
        if (!Array.isArray(newMarkup.inline_keyboard[rowIndex])) {
          newMarkup.inline_keyboard[rowIndex] = []
        }
        const newButton: InlineKeyboardButton = {
          text: query === el.callback_data ? replacer + el.text : el.text,
          callback_data: 'edit',
        }
        newMarkup.inline_keyboard[rowIndex].push(newButton)
      }),
    )

    await this.bot.editMessageReplyMarkup(newMarkup, { chat_id: chatId, message_id: messageId })
  }

  sendTyping(chatId: number) {
    let isOver = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const typing = () => {
      this.bot.sendChatAction(chatId, 'typing')
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        if (!isOver) {
          typing()
        }
      }, 2000)
    }

    typing()

    return () => {
      isOver = true
    }
  }

  /* MENU */
  async sendMenu(chatId: number) {
    const user = await DBService.getByChatId(chatId)
    const inline_keyboard: InlineKeyboardButton[][] = [[this.FAQButton]]

    if (user) {
      inline_keyboard[0].push(this.aboutButton)
      inline_keyboard.push([this.settingsButton], this.chatButton)
    } else {
      inline_keyboard.push([{ text: 'Зарегистрироваться! 🚀', callback_data: 'reg_start' }])
    }

    await this.bot.sendMessage(chatId, 'Меню', {
      reply_markup: {
        inline_keyboard,
        remove_keyboard: true,
      },
    })
  }

  async sendAbout(chatId: number) {
    this.bot.sendMessage(chatId, TextService.about('ru'), {
      reply_markup: {
        inline_keyboard: [[this.menuButton, this.FAQButton], this.contactMeButton],
      },
    })
  }

  async sendInfo(chatId: number) {
    this.bot.sendMessage(chatId, FAQ, {
      parse_mode: validateMarkdown(FAQ) ? 'Markdown' : undefined,
      reply_markup: {
        inline_keyboard: [[this.menuButton]],
      },
    })
  }

  /* START AND REGISTRATION */
  async start(chatId: number, error?: string) {
    const info = CacheService.getReg(chatId)
    switch (info.step) {
      case 1:
        this.bot.sendMessage(
          chatId,
          error
            ? error
            : 'Приветствую тебя в GPT боте! \nДля начала давай определимся с языком. Выбери удобный для тебя (ты в любой момент сможешь сменить его в настройках)',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Русский', callback_data: 'reg_lang_ru' }],
                [{ text: 'English', callback_data: 'reg_lang_en' }],
              ],
            },
          },
        )
        break

      case 2:
        this.bot.sendMessage(
          chatId,
          `А теперь настало время познакомиться, могу ли я обращаться к тебе ${info.name}? Нажми "Продолжить" чтобы сохранить текущее или пришли мне другое имя`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Продолжить', callback_data: 'reg_skip_name' }]],
            },
          },
        )
        break

      case 3:
        this.bot.sendMessage(
          chatId,
          `Очень приятно, ${info.name}, меня зовут GPTBot.\nОсталось только отпределиться с тарифом! Если у тебя есть промо-код, то скорее отправь его мне. Но ничего страшного, если у тебя его нет, ты можешь воспользовалься бесплатным тарифом для знакомства с сервисом. Не переживай, насчёт лимитов, тебе их точно хватит!`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Попробовать бесплатно', callback_data: 'reg_tarif_welcome' }]],
            },
          },
        )
        break

      case 4:
        this.bot.sendMessage(
          chatId,
          error
            ? `Верно ли указаны следующие данные?
          \nТебя зовут: ${info.name}
          \nЯзык: ${info.language}
          \n${info.code === 'test_tarif' ? 'Активировать пробный тариф' : 'Воспользоваться промокодом ' + info.code}`
            : `Спасибо!\nМы практически закончили! Осталось только убедиться, что мы всё правильно записали, давай проверим ещё раз:
          \nТебя зовут: ${info.name}
          \nЯзык: ${info.language}
          \n${info.code === 'welcome' ? 'Активировать пробный тариф' : 'Воспользоваться промокодом ' + info.code}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Заполнить ещё раз', callback_data: 'reg_start' }],
                [{ text: 'Да, всё верно!', callback_data: 'reg_confirm' }],
              ],
            },
          },
        )
        break

      case 5:
        await DBService.createUser(chatId, info)
        this.bot.sendMessage(chatId, 'Регистрация прошла успешно, поздравляю! Теперь тебе доступны все функции бота!', {
          reply_markup: {
            inline_keyboard: [this.chatButton],
          },
        })
        break

      default:
        break
    }
  }

  /* CODE */
  async createCode(chatId: number) {
    const code = CacheService.getCode(chatId)

    switch (code.step) {
      case 1:
        await this.bot.sendMessage(chatId, 'Введи код:')
        break

      case 2:
        await this.bot.sendMessage(chatId, 'Укажи лимит использования')
        break

      case 3:
        const buttons = await this.getTarifButtons('code_tarif_')

        await this.bot.sendMessage(chatId, `Выбери тариф`, {
          reply_markup: {
            inline_keyboard: buttons,
          },
        })
        break
      case 4:
        await this.bot.sendMessage(
          chatId,
          `Всё правильно?\nТариф: ${code.tarifName} с айди ${code.tarifId}\nКод: ${code.value}\nЛимит :${code.limit}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Заполнить ещё раз', callback_data: 'code_add_new' }],
                [{ text: 'Подтвердить', callback_data: 'code_confirm' }],
              ],
            },
          },
        )
        break
      case 5:
        await DBService.createCode(code)
        await this.bot.sendMessage(
          chatId,
          `Код ${code.value} для тарифа ${code.tarifName} с лимитом использования ${code.limit} успешно создан!`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Создать ещё код',
                    callback_data: 'code_add_new',
                  },
                ],
                [this.settingsButton],
              ],
            },
          },
        )
        break
    }
  }

  async activateCode(chatId: number, code: string) {
    const { user } = await CacheService.getUser(chatId)
    await DBService.activateCode(user.id, code)

    this.bot.sendMessage(chatId, `Код успешно был активирован!`, {
      reply_markup: {
        inline_keyboard: [[this.settingsButton], this.chatButton],
      },
    })
  }

  /* GPT */
  async sendQuestion(chatId: number, text: string) {
    const { user } = await CacheService.getUser(chatId)

    if (!user.isAdmin) {
      /* VALIDATE ACCESS */
      const access = await DBService.validateAccess(user)

      if (!access.daily || !access.total || !access.validTarif) {
        await this.bot.sendMessage(
          chatId,
          access.validTarif
            ? `К сожалению вы исчерпали ${!access.daily ? 'дневной' : ''} ${
                !access.daily && !access.total ? 'и' : ''
              }  ${!access.total ? 'общий' : ''} лимит использования.`
            : 'К сожалению тариф более не действителен, но всегда можно перейти на стартовую версию или обновиться до расширенной!',
          {
            reply_markup: {
              inline_keyboard: [[this.tarifsButton], [this.settingsButton]],
            },
          },
        )

        return
      }
    }

    /* SEND TYPING ACTION */
    const stop = this.sendTyping(chatId)

    /* CREATE CONTEXT AND GET ANSVER FROM GPT */
    if (user.context?.useContext) {
      await DBService.createMessage(MessageRole.user, text, user)
    }

    const res = user.context?.useContext ? await GPTService.sendWithContext(chatId) : await GPTService.send(text, user)

    stop()

    /* SEND ANSVER */
    if (res) {
      if (user.context?.useContext) {
        await DBService.createMessage(MessageRole.assistant, res.message, user)
      }

      const activity =
        user.isAdmin || user.activity?.tarif.name === 'unlim'
          ? null
          : await DBService.updateActivity(user.id, res.tokens)

      const usage = `\n\n--- --- --- --- --- --- --- --- ---
      \nИспользовано ${res.tokens} токенов. 
      \nОсталось: сегодня: ${activity ? user.activity?.tarif?.dailyLimit! - activity.dailyUsage : '∞'} / всего: ${
        activity ? user.activity?.tarif?.totalLimit! - activity.totalUsage : '∞'
      }\n\n--- --- --- --- --- --- --- --- ---`

      await this.bot.sendMessage(chatId, res.message + usage, {
        parse_mode: validateMarkdown(res.message) ? 'Markdown' : undefined,
        reply_markup: {
          inline_keyboard: user.context?.useContext
            ? [this.contextButton(user.id)]
            : [[{ text: 'Включить контекст', callback_data: `toggle_context_${user.id}_on` }]],
        },
      })

      return true
    } else {
      await this.sendMessage(chatId, 'Упс... что-то пошло не так, попробуй ещё раз.')
      return false
    }
  }

  async clearContext(chatId: number, type: 'settings' | 'context') {
    await DBService.clearContext(chatId)
    const buttons: InlineKeyboardButton[][] = []

    if (type === 'settings') {
      buttons.push([this.settingsButton])
    }
    buttons.push(this.chatButton)

    this.bot.sendMessage(chatId, 'Контекст был успешно сброшен!', {
      reply_markup: { inline_keyboard: buttons },
    })
  }

  /* TARIFS */
  async createTarif(chatId: number) {
    const tarif = CacheService.getTarif(chatId)
    const { prices } = CacheService.getPrice(chatId)
    switch (tarif.step) {
      case 1:
        await this.bot.sendMessage(chatId, 'Кодовое название тарифа:')
        break

      case 2:
        await this.bot.sendMessage(chatId, 'Титловое название тарифа:')
        break

      case 3:
        await this.bot.sendMessage(chatId, 'Описание:')
        break

      case 4:
        await this.bot.sendMessage(chatId, 'Пришли ссылку на изображение:')
        break

      case 5:
        await this.bot.sendMessage(chatId, 'Общий лимит тарифа:')
        break

      case 6:
        await this.bot.sendMessage(chatId, 'Дневной лимит тарифа:')
        break

      case 7:
        await this.bot.sendMessage(chatId, 'Максимальная длина контекста:')
        break

      case 8:
        await this.bot.sendMessage(chatId, 'Длительность тарифа:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '1 месяц', callback_data: 'tarif_duration_' + month }],
              [
                {
                  text: '1 год',
                  callback_data: 'tarif_duration_' + year,
                  pay: true,
                },
              ],
            ],
          },
        })
        break

      case 9:
        await this.bot.sendMessage(chatId, 'Тип тарифа:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Лимит', callback_data: 'tarif_type_' + TarifType.limit }],
              [{ text: 'Подписка', callback_data: 'tarif_type_' + TarifType.subscribe }],
            ],
          },
        })
        break

      case 10:
        await this.bot.sendMessage(chatId, 'Валюта:.', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: Currency.rub, callback_data: 'tarif_currency_' + Currency.rub },
                { text: Currency.usd, callback_data: 'tarif_currency_' + Currency.usd },
                { text: Currency.btc, callback_data: 'tarif_currency_' + Currency.btc },
                { text: Currency.eth, callback_data: 'tarif_currency_' + Currency.eth },
                { text: Currency.usdt, callback_data: 'tarif_currency_' + Currency.usdt },
              ],
            ],
          },
        })
        break

      case 11:
        await this.bot.sendMessage(chatId, 'Цена:', {})
        break

      case 12:
        const message = prices.reduce(
          (acc, el) => acc + el.value + ' ' + el.currency + '\n',
          `Текущие ценники для тарифа ${tarif.name}\n`,
        )

        await this.bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Добавить ещё один прайс', callback_data: 'tarif_add_price' }],
              [{ text: 'Продолжить', callback_data: 'tarif_continue' }],
            ],
          },
        })
        break

      case 13:
        await this.bot.sendMessage(
          chatId,
          `Тариф ${tarif.name} / ${tarif.title} успешно создан!
          \nОписание: ${tarif.description} 
          \nЛимиты: ${tarif.limit} / ${tarif.dailyLimit} 
          \nМаксимальный контекст: ${tarif.maxContext} 
          \nТип: ${tarif.type}  
          \nДлительность: ${Math.floor(tarif.duration / day)}дней
          \nЧто делаем дальше?`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Создать ещё 1 тариф', callback_data: 'tarif_add_new' }, this.menuButton]],
            },
          },
        )
        break
    }
  }

  async sendTarifs(chatId: number) {
    const buttons = await this.getTarifButtons('settings_tarifs_')

    this.bot.sendMessage(chatId, 'Доступные тарифы: ', {
      reply_markup: { inline_keyboard: [...buttons, [this.settingsButton]] },
    })
  }

  async sendTarifById(chatId: number, tarifId: number) {
    const tarif = await DBService.getTaridById(tarifId)

    const description = `${tarif.title}
    \n${tarif.description}
    \n --- --- --- --- --- --- ---
    \nТип: ${tarif.type === 'limit' ? 'лимит запросов' : 'подписка'}, ${timestampToDate(tarif.duration)}
    \nЛимиты: дневной ${tarif.dailyLimit === 0 ? '∞' : tarif.dailyLimit} / общий ${
      tarif.totalLimit === 0 ? '∞' : tarif.totalLimit
    }
    \nМаксимальная доступная длина контекста: ${tarif.maxContext}`

    this.bot.sendMessage(chatId, description, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Выбрать тариф: ' + tarif.title,
              callback_data: 'tarif_select_' + tarif.name + '_' + tarif.id,
            },
          ],
          [this.settingsButton],
        ],
      },
    })
  }

  async sendTarifPrices(chatId: number, tarifId: number) {
    const buttons = await this.getPriceButtons('tarif_buy_', tarifId)
    buttons.push(this.menuAndsettingSButtons)

    this.bot.sendMessage(chatId, 'Выбери удобный для тебя способ оплаты', {
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  }

  async sendTarifBuy(chatId: number, priceId: number) {
    this.bot.sendMessage(
      chatId,
      'К сожалению на текущий момент нет технической возможности автоматического преобретения тарифов, но над этим ведутся активные работы :( Отратитесь ко мне напрямую для получения промо-кода для этого тарифа',
      {
        reply_markup: { inline_keyboard: [this.contactMeButton, this.menuAndsettingSButtons] },
      },
    )
  }

  async sendMyTarif(chatId: number) {
    const { user } = await CacheService.getUser(chatId)
    // const user = await DBService.getByChatId(chatId)

    const description = `Мой тариф ${user?.activity?.tarif.title}
    \nОбщий лимит ${user?.activity?.tarif.totalLimit} / ежедневный ${user?.activity?.tarif.dailyLimit}
    \nОсталось ${user?.activity?.tarif.totalLimit! - user?.activity?.totalUsage!} / ${
      user?.activity?.tarif.dailyLimit! - user?.activity?.dailyUsage!
    }
    \nЗаканчивается ${user?.activity?.expiresIn.toLocaleDateString()}`

    this.bot.sendMessage(chatId, description, {
      reply_markup: {
        inline_keyboard: [[this.tarifsButton, this.settingsButton], this.chatButton],
      },
    })
  }

  /* SETTINGS */
  async settings(chatId: number) {
    const { user } = await CacheService.getUser(chatId)

    const buttons = [
      [{ text: 'Рандомайзер', callback_data: 'settings_random_' + user.id }],
      [
        { text: 'Параметры запросов', callback_data: 'settings_service_info' },
        {
          text: user.context?.useServiceInfo ? 'Отключить' : 'Включить',
          callback_data: `toggle_service_info_${user.id}_${user.context?.useServiceInfo ? 'off' : 'on'}`,
        },
      ],
      [
        {
          text: 'Контекст',
          callback_data: 'context_change_length_' + user.id + '_' + user.activity?.tarif.maxContext,
        },
        {
          text: user.context?.useContext ? 'Отключить' : 'Включить',
          callback_data: `toggle_context_${user.id}_${user.context?.useContext ? 'off' : 'on'}`,
        },
      ],
      [
        { text: 'Изменить имя', callback_data: 'settings_name_' + user.name },
        { text: 'Язык', callback_data: 'settings_lang_' + user.id },
      ],
      [this.tarifsButton, { text: 'Ввести промокод', callback_data: 'tarifs_send_code' }],
      [
        { text: 'Версия GPT', callback_data: 'show_version' },
        { text: 'Мои лимиты', callback_data: 'show_limits' },
      ],
      this.chatButton,
    ]

    this.bot.sendMessage(chatId, 'Настройки', {
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  }

  async settingsError(chatId: number) {
    const buttons = [[this.settingsButton], this.chatButton]
    this.bot.sendMessage(chatId, 'Я не понимаю твоей команды. Выбери одно из следующих действий', {
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  }

  async sendLanguages(chatId: number, userId: number) {
    this.bot.sendMessage(chatId, 'Выбери язык: ', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Русский 🇷🇺', callback_data: 'toggle_language_' + userId + '_' + Language.ru },
            { text: 'English 🇬🇧', callback_data: 'toggle_language_' + userId + '_' + Language.en },
          ],
          [this.settingsButton],
        ],
      },
    })
  }

  async sendNameChoice(chatId: number, oldName: string) {
    this.bot.sendMessage(chatId, `Пришли мне новое имя`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Оставить текущее (${oldName}) и вернуться обратно`,
              callback_data: `show_settings`,
            },
          ],
        ],
      },
    })
  }

  async changeName(chatId: number, name: string) {
    const { user } = await CacheService.getUser(chatId)

    await DBService.changeName(name, user)
    this.bot.sendMessage(chatId, 'Имя успешно изменено на ' + name, {
      reply_markup: {
        inline_keyboard: [[this.settingsButton], this.chatButton],
      },
    })
  }

  async sendCodeInput(chatId: number) {
    this.bot.sendMessage(chatId, `Пришли мне код`, {
      reply_markup: {
        inline_keyboard: [[this.settingsButton]],
      },
    })
  }

  async sendContextLengthChoise(chatId: number, max: number, userId: number) {
    this.bot.sendMessage(chatId, `Отправь мне желаемую длинну контекста. Но не более ${max}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `Максимум (${max})`, callback_data: `context_length_` + userId + '_' + max }],
          [this.settingsButton],
        ],
      },
    })
  }

  async contextLengthError(chatId: number, max: number, userId: number) {
    this.bot.sendMessage(
      chatId,
      `Некорректный размер контекста, пожалуйста, укажи его правильно. Максимальный размер: ${max}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Максимум (${max})`, callback_data: `context_length_` + userId + '_' + max }],
            [this.settingsButton],
          ],
        },
      },
    )
  }

  async changeContextLength(chatId: number, value: number, userId: number) {
    await DBService.changeContext(value, userId)
    this.bot.sendMessage(
      chatId,
      `Максимальная длина контекста была успешно изменена и теперь составляет ${value} сообщений`,
      {
        reply_markup: {
          inline_keyboard: [[this.settingsButton], this.chatButton],
        },
      },
    )
  }

  async sendRandomModels(chatId: number, userId: number) {
    this.bot.sendMessage(chatId, 'Выбери модель рандомизации.', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Temperature', callback_data: 'settings_random_model_temperature_' + userId },
            { text: 'Top_p', callback_data: 'settings_random_model_topP_' + userId },
            { text: 'Обе сразу', callback_data: 'settings_random_model_both_' + userId },
          ],
          [this.settingsButton],
        ],
      },
    })
  }

  async sendRandomValues(chatId: number, model: RandomModels, userId: number) {
    this.bot.sendMessage(chatId, `А теперь выбери одно из значений для ${model}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '0.5',
              callback_data: 'settings_random_value_' + model + '_0.5_' + userId,
            },
            {
              text: '0.7(по умолчанию)',
              callback_data: 'settings_random_value_' + model + '_0.7_' + userId,
            },
          ],
          [
            {
              text: '0.9',
              callback_data: 'settings_random_value_' + model + '_0.9_' + userId,
            },
            {
              text: '1',
              callback_data: 'settings_random_value_' + model + '_1_' + userId,
            },
            {
              text: '1.1',
              callback_data: 'settings_random_value_' + model + '_1.1_' + userId,
            },
            {
              text: '1.25',
              callback_data: 'settings_random_value_' + model + '_1.25_' + userId,
            },
            {
              text: '1.5',
              callback_data: 'settings_random_value_' + model + '_1.5_' + userId,
            },
          ],
          [this.settingsButton],
        ],
      },
    })
  }

  async changeRandomModel(chatId: number, userId: number, models: IRandomModel) {
    await DBService.changeRandomModel(models, userId)
    this.bot.sendMessage(
      chatId,
      models.model === 'both'
        ? `Обе модели были успешно изменены.\nTemperature: ${models.temperature} \nTop_p: ${models.topP}`
        : `Модель была успешно изменена на ${models.model}\nУровень рандомности выставлен на ${models.value}`,
      {
        reply_markup: {
          inline_keyboard: [[this.settingsButton], this.chatButton],
        },
      },
    )
  }

  async sendQueryInput(chatId: number) {
    const user = await DBService.getByChatId(chatId)
    const serviceInfo = `Укажи дополнительные парамтры запросов.\nОни будут каждый раз отправляться вместе с сообщением. Бот не будет на них отвечать, но учтёт их при составлении ответа.
    ${user?.context?.serviceInfo ? '\nТекущие параметры: ' + user.context.serviceInfo : ''}`

    await this.bot.sendMessage(chatId, serviceInfo, {
      reply_markup: { inline_keyboard: [[this.settingsButton]] },
    })
  }

  async changeQuery(chatId: number, query: string) {
    const { user } = await CacheService.getUser(chatId)

    await DBService.changeQuery(query, user)
    this.bot.sendMessage(chatId, 'Дополнительные параметры запроса были успешно изменены', {
      reply_markup: { inline_keyboard: [[this.settingsButton], this.chatButton] },
    })
  }

  async sendVersion(chatId: number) {
    this.bot.sendMessage(
      chatId,
      'К сожалению на данный момент доступна только версия ***gpt-3.5-turbo***, как только 4я версия станет доступной, я обязательно об этом сообщу.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[this.settingsButton], this.chatButton],
        },
      },
    )
  }

  /* TOGGLE */
  async languageToggle(chatId: number, id: number, lang: Language) {
    await DBService.languageToggle(id, lang)
    this.bot.sendMessage(chatId, `Язык был успешно изменён на ${lang === 'ru' ? 'русский' : 'английский'}`, {
      reply_markup: {
        inline_keyboard: [[this.settingsButton]],
      },
    })
  }

  async contextToggle(chatId: number, userId: number, action: string, settings: boolean) {
    await DBService.contextToggle(userId, action)

    const buttons: InlineKeyboardButton[][] =
      action === 'on'
        ? [this.contextButton(userId)]
        : [[{ text: 'Включить контекст', callback_data: `toggle_context_${userId}_on` }]]

    if (settings) {
      buttons.push([this.settingsButton])
    }

    buttons.push(this.chatButton)

    this.bot.sendMessage(chatId, `Контекст был успешно ${action === 'on' ? 'включен' : 'отключен'}`, {
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  }

  async serviceInfoToggle(chatId: number, userId: number, action: string) {
    await DBService.serviceInfoToggle(userId, action)

    const buttons: InlineKeyboardButton[][] = [
      [
        {
          text: action === 'on' ? 'Отключить ' : 'Включить',
          callback_data: `toggle_service_info_${userId}_${action === 'on' ? 'off' : 'on'}`,
        },
      ],
      [this.settingsButton],
      this.chatButton,
    ]

    this.bot.sendMessage(chatId, `Сервисная информация ${action === 'on' ? 'включена' : 'отключена'}`, {
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  }
}

export default new TgService()
