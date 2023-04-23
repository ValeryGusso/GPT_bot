import TelegramBot, { InlineKeyboardButton, InlineKeyboardMarkup } from 'node-telegram-bot-api'
import GPTService from '../services/gpt.js'
import DBService from './db.js'
import TgController from '../controllers/tg.js'
import { ICode, IPriceItem, IReg, ITarif } from '../interfaces/tg.js'
import { FullUser } from '../interfaces/db.js'
import { Currency, Language, MessageRole, RandomModels, TarifType } from '@prisma/client'
import { isFullUser, timestampToDate, validateMarkdown } from '../const/utils.js'
import { commandsList, infoText } from '../const/text.js'
import { day, month, year } from '../const/const.js'

class TgService {
  private readonly bot

  constructor() {
    this.bot = new TelegramBot(process.env.TG_TOKEN!, { polling: true })
  }

  /* BUTTONS */
  private readonly backToSettingsButton: InlineKeyboardButton[] = [
    { text: 'Вернуться к настройкам', callback_data: `settings_show` },
  ]
  private readonly backToMenuButton: InlineKeyboardButton[] = [
    { text: 'Вернуться в меню', callback_data: `show_info` },
  ]
  private startChatButton(type: 'back' | 'start'): InlineKeyboardButton[] {
    return [
      {
        text: type === 'back' ? 'Продолжить общение с ботом' : 'Начать чат!',
        callback_data: 'back_to_chat',
      },
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

  /* UTILS */
  getBot() {
    return this.bot
  }

  async sendMessage(chatId: number, message: string) {
    this.bot.sendMessage(chatId, message)
  }

  async welcome(chatId: number) {
    this.bot.sendMessage(
      chatId,
      'Для начала использования бота воспользуйся командой /start или же нажми на соответствующую кнопку!',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Информация о боте', callback_data: 'welcome_info' }],
            [{ text: 'Начать!', callback_data: 'welcome_start' }],
          ],
        },
      },
    )
  }

  async sendGreeting(chatId: number) {
    let header = 'Вот список всех доступных комманд:\n'
    const footer = '\nИли, ты можешь выбрать одно из наиболее популярных действий нажатием кнопки.'
    this.bot.sendMessage(chatId, header + commandsList + footer, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Перейти к меню', callback_data: 'show_menu' },
            { text: 'Перейти к настройкам', callback_data: 'settings_show' },
          ],
          this.startChatButton('start'),
        ],
      },
    })
  }

  async editButton(
    chatId: number,
    messageId: number,
    query: string,
    replacer: string,
    marcup: InlineKeyboardMarkup,
  ) {
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
    const inline_keyboard: InlineKeyboardButton[][] = [
      [
        { text: 'Подсказки', callback_data: 'show_info' },
        { text: 'О боте', callback_data: 'show_about' },
      ],
      this.startChatButton('start'),
    ]

    await this.bot.sendMessage(chatId, 'Меню:', {
      reply_markup: {
        inline_keyboard,
      },
    })
  }

  async sendAbout(chatId: number) {
    this.bot.sendMessage(chatId, 'about', {
      reply_markup: { inline_keyboard: [this.backToMenuButton, this.startChatButton('start')] },
    })
  }

  async sendInfo(chatId: number) {
    this.bot.sendMessage(chatId, infoText, {
      parse_mode: validateMarkdown(infoText) ? 'Markdown' : undefined,
      reply_markup: {
        inline_keyboard: [this.backToMenuButton, this.startChatButton('start')],
      },
    })
  }

  /* START AND REGISTRATION */
  async start(chatId: number, info: IReg, error?: string) {
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
              inline_keyboard: [
                [{ text: 'Попробовать бесплатно', callback_data: 'reg_welcome_tarif' }],
              ],
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
          \n${
            info.code === 'test_tarif'
              ? 'Активировать пробный тариф'
              : 'Воспользоваться промокодом ' + info.code
          }`
            : `Спасибо!\nМы практически закончили! Осталось только убедиться, что мы всё правильно записали, давай проверим ещё раз:
          \nТебя зовут: ${info.name}
          \nЯзык: ${info.language}
          \n${
            info.code === 'test_tarif'
              ? 'Активировать пробный тариф'
              : 'Воспользоваться промокодом ' + info.code
          }`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Да, всё верно!', callback_data: 'reg_confirm' }],
                [{ text: 'Заполнить ещё раз', callback_data: 'reg_reset' }],
              ],
            },
          },
        )
        break

      case 5:
        await DBService.createUser(chatId, info)
        this.bot.sendMessage(
          chatId,
          'Регистрация прошла успешно, поздравляю! Теперь тебе доступны все функции бота!',
          {
            reply_markup: {
              inline_keyboard: [this.startChatButton('start')],
            },
          },
        )
        break

      default:
        break
    }
  }

  /* CODE */
  async createCode(chatId: number, info: ICode) {
    switch (info.step) {
      case 0:
        await this.bot.sendMessage(chatId, 'Введи код:')
        break

      case 1:
        await this.bot.sendMessage(chatId, 'Укажи лимит использования')
        break

      case 2:
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
          `Всё правильно?\nТариф: ${info.tarifName} с айди ${info.tarifId}\nКод: ${info.value}\nЛимит :${info.limit}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Заполнить ещё раз', callback_data: 'code_reset' }],
                [{ text: 'Подтвердить', callback_data: 'code_confirm' }],
              ],
            },
          },
        )
        break
      case 5:
        await this.bot.sendMessage(
          chatId,
          `Код ${info.value} для тарифа ${info.tarifName} с лимотом использования ${info.limit} успешно создан!`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Создать ещё код',
                    callback_data: 'code_add_new',
                  },
                ],
                this.backToSettingsButton,
              ],
            },
          },
        )
        break
    }
  }

  async activateCode(chatId: number, code: string, user: FullUser) {
    await DBService.activateCode(user.id, code)

    this.bot.sendMessage(chatId, `Код успешно был активирован!`, {
      reply_markup: {
        inline_keyboard: [this.backToSettingsButton, this.startChatButton('back')],
      },
    })
  }

  /* GPT */
  async sendQuestion(chatId: number, text: string, user: FullUser) {
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
            inline_keyboard: [
              [{ text: 'Перейти к тарифам', callback_data: 'tarifs_show_all' }],
              this.backToSettingsButton,
            ],
          },
        },
      )

      return
    }

    /* SEND TYPING ACTION */
    const stop = this.sendTyping(chatId)

    /* CREATE CONTEXT AND GET ANSVER FROM GPT */
    if (user.context?.useContext) {
      await DBService.createMessage(MessageRole.user, text, user)
    }

    const res = user.context?.useContext
      ? await GPTService.sendWithContext(chatId)
      : await GPTService.send(text, user)

    stop()

    /* SEND ANSVER */
    if (res) {
      if (user.context?.useContext) {
        await DBService.createMessage(MessageRole.assistant, res.message, user)
      }

      const activity = await DBService.updateActivity(user.id, res.tokens)

      const usage = `\n\n--- --- --- --- --- --- --- --- ---
      \nИспользовано ${res.tokens} токенов. 
      \nОсталось: сегодня: ${user.activity?.tarif?.dailyLimit! - activity.dailyUsage} / всего: ${
        user.activity?.tarif?.limit! - activity.usage
      }\n\n--- --- --- --- --- --- --- --- ---`

      await this.bot.sendMessage(chatId, res.message + usage, {
        parse_mode: validateMarkdown(res.message) ? 'Markdown' : undefined,
        reply_markup: {
          inline_keyboard: user.context?.useContext
            ? [
                [
                  { text: 'Сбросить контекст 🔄', callback_data: 'context_reset' },
                  { text: 'Отключить контекст', callback_data: `context_toggle_${user.id}_off` },
                ],
              ]
            : [[{ text: 'Включить контекст', callback_data: `context_toggle_${user.id}_on` }]],
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
      buttons.push(this.backToSettingsButton)
    }
    buttons.push(this.startChatButton('start'))

    this.bot.sendMessage(chatId, 'Контекст был успешно сброшен!', {
      reply_markup: { inline_keyboard: buttons },
    })
  }

  /* TARIFS */
  async createTarif(chatId: number, info: ITarif, price: IPriceItem[]) {
    switch (info.step) {
      case 1:
        this.bot.sendMessage(chatId, 'Кодовое название тарифа:')
        break
      case 2:
        this.bot.sendMessage(chatId, 'Титловое название тарифа:')
        break
      case 3:
        this.bot.sendMessage(chatId, 'Описание:')
        break
      case 4:
        this.bot.sendMessage(chatId, 'Пришли ссылку на изображение:')
        break
      case 5:
        this.bot.sendMessage(chatId, 'Общий лимит тарифа:')
        break
      case 6:
        this.bot.sendMessage(chatId, 'Дневной лимит тарифа:')
        break
      case 7:
        this.bot.sendMessage(chatId, 'Максимальная длина контекста:')
        break
      case 8:
        this.bot.sendMessage(chatId, 'Длительность тарифа:', {
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
        this.bot.sendMessage(chatId, 'Тип тарифа:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Лимит', callback_data: 'tarif_type_' + TarifType.limit }],
              [{ text: 'Подписка', callback_data: 'tarif_type_' + TarifType.subscribe }],
            ],
          },
        })
        break
      case 10:
        this.bot.sendMessage(chatId, 'Валюта:.', {
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
        this.bot.sendMessage(chatId, 'Цена:', {})
        break
      case 12:
        let result = `Текущие ценники для тарифа ${info.name}\n`
        // for (const key in price) {
        result += `${
          price[TgController.findPriceIndex(chatId, info.name)]
        } ${TgController.findPriceIndex(chatId, info.name)} \n`
        // }
        this.bot.sendMessage(chatId, result, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Добавить ещё один прайс', callback_data: 'tarif_add_price' }],
              [{ text: 'Продолжить', callback_data: 'tarif_continue' }],
            ],
          },
        })
        break
      case 13:
        this.bot.sendMessage(
          chatId,
          `Тариф ${info.name} / ${info.title} успешно создан!
          \nОписание: ${info.description} 
          \nЛимиты: ${info.limit} / ${info.dailyLimit} 
          \nМаксимальный контекст: ${info.maxContext} 
          \nТип: ${info.type}  
          \nДлительность: ${Math.floor(info.duration / day)}дней
          \nЧто делаем дальше?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Создеть ещё 1 тариф', callback_data: 'show_menu' },
                  { text: 'Вернуться в меню!', callback_data: 'tarif_add_new' },
                ],
              ],
            },
          },
        )
        break
    }
  }

  async sendTarifs(chatId: number) {
    const buttons = await this.getTarifButtons('settings_tarifs_')

    this.bot.sendMessage(chatId, 'Доступные тарифы: ', {
      reply_markup: { inline_keyboard: [...buttons, this.backToSettingsButton] },
    })
  }

  async sendTarifById(chatId: number, tarifId: number) {
    const tarif = await DBService.getTaridById(tarifId)

    const description = `${tarif.title}
    \n${tarif.description}
    \n --- --- --- --- --- --- ---
    \nТип: ${tarif.type}, доступен в течении ${timestampToDate(tarif.duration)}
    \nЛимиты: дневной ${tarif.dailyLimit} / общий ${tarif.limit}
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
          this.backToSettingsButton,
        ],
      },
    })
  }

  async sendMyTarif(chatId: number) {
    const user = await DBService.getByChatId(chatId)

    const description = `Мой тариф ${user?.activity?.tarif.title}
    \nОбщий лимит ${user?.activity?.tarif.limit} / ежедневный ${user?.activity?.tarif.dailyLimit}
    \nОсталось ${user?.activity?.tarif.limit! - user?.activity?.usage!} / ${
      user?.activity?.tarif.dailyLimit! - user?.activity?.dailyUsage!
    }
    \nЗаканчивается ${user?.activity?.expiresIn.toLocaleDateString()}`

    this.bot.sendMessage(chatId, description, {
      reply_markup: {
        inline_keyboard: [this.backToSettingsButton, this.startChatButton('back')],
      },
    })
  }

  /* SETTINGS */
  async settings(chatId: number, user?: FullUser) {
    let safeUser: FullUser | null | undefined = user

    if (!user) {
      safeUser = await DBService.getByChatId(chatId)
    }

    if (!isFullUser(safeUser)) {
      throw new Error('User not found')
    }

    const buttons = [
      [
        { text: 'Параметры запросов', callback_data: 'settings_service_info' },
        { text: 'Рандомайзер', callback_data: 'settings_random_' + safeUser.id },
      ],
      [
        {
          text: safeUser.context?.useContext ? 'Отключить контекст' : 'Включить контекст',
          callback_data: `context_toggle_${safeUser.id}_${
            safeUser.context?.useContext ? 'off' : 'on'
          }`,
        },
        {
          text: 'Максимальная длина контекста',
          callback_data:
            'context_change_length_' + safeUser.id + '_' + safeUser.activity?.tarif.maxContext,
        },
      ],
      [
        { text: 'Изменить имя', callback_data: 'settings_name_' + safeUser.name },
        { text: 'Язык', callback_data: 'settings_lang_' + safeUser.id },
      ],
      [
        { text: 'Все тарифы', callback_data: 'tarifs_show_all' },
        { text: 'Ввести промокод', callback_data: 'tarifs_send_code' },
      ],
      [
        { text: 'Версия GPT', callback_data: 'settings_version' },
        { text: 'Мои лимиты', callback_data: 'settings_limits' },
      ],
      this.startChatButton('back'),
    ]

    this.bot.sendMessage(chatId, 'Настройки', {
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  }

  async settingsError(chatId: number) {
    const buttons = [this.backToSettingsButton, this.startChatButton('back')]
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
            { text: 'Русский', callback_data: 'language_toggle_' + userId + '_' + Language.ru },
            { text: 'English', callback_data: 'language_toggle_' + userId + '_' + Language.en },
          ],
          this.backToSettingsButton,
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
              callback_data: `settings_show`,
            },
          ],
        ],
      },
    })
  }

  async changeName(chatId: number, name: string, user: FullUser) {
    await DBService.changeName(name, user)
    this.bot.sendMessage(chatId, 'Имя успешно изменено на ' + name, {
      reply_markup: {
        inline_keyboard: [this.backToSettingsButton, this.startChatButton('back')],
      },
    })
  }

  async sendCodeInput(chatId: number) {
    this.bot.sendMessage(chatId, `Пришли мне код`, {
      reply_markup: {
        inline_keyboard: [this.backToSettingsButton],
      },
    })
  }

  async sendContextLengthChoise(chatId: number, max: number, userId: number) {
    this.bot.sendMessage(chatId, `Отправь мне желаемую длинну контекста. Но не более ${max}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `Максимум (${max})`, callback_data: `context_length_` + userId + '_' + max }],
          this.backToSettingsButton,
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
            this.backToSettingsButton,
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
          inline_keyboard: [this.backToSettingsButton, this.startChatButton('back')],
        },
      },
    )
  }

  async sendRandomModels(chatId: number, userId: number) {
    this.bot.sendMessage(
      chatId,
      `Выбери модель рандомизации ответа.
    \nTemperature: 
    \nTop_p: `,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Temperature', callback_data: 'settings_random_model_temperature_' + userId },
              { text: 'Top_p', callback_data: 'settings_random_model_topP_' + userId },
            ],
            this.backToSettingsButton,
          ],
        },
      },
    )
  }

  async sendRandomValues(chatId: number, model: RandomModels, userId: number) {
    this.bot.sendMessage(
      chatId,
      'А теперь выбери одно из значени (чем больше значениие, тем более случайными получаются ответы)',
      {
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
            this.backToSettingsButton,
          ],
        },
      },
    )
  }

  async changeRandomModel(chatId: number, model: RandomModels, value: number, userId: number) {
    await DBService.changeRandomModel(model, value, userId)
    this.bot.sendMessage(
      chatId,
      `Модель была успешно изменена на ${model}\nУровень рандомности выставлен на ${value}`,
      {
        reply_markup: {
          inline_keyboard: [this.backToSettingsButton, this.startChatButton('back')],
        },
      },
    )
  }

  async sendQueryInput(chatId: number) {
    await this.bot.sendMessage(
      chatId,
      'Укажи дополнительные парамтры запросов.\nОни будут каждый раз отправляться вместе с сообщением. Бот не будет на них отвечать, но учтёт их при составлении ответа.',
      {
        reply_markup: { inline_keyboard: [this.backToSettingsButton] },
      },
    )
  }

  async changeQuery(chatId: number, query: string, user: FullUser) {
    await DBService.changeQuery(query, user)
    this.bot.sendMessage(chatId, 'Дополнительные параметры запроса были успешно изменены', {
      reply_markup: { inline_keyboard: [this.backToSettingsButton, this.startChatButton('back')] },
    })
  }

  async sendVersion(chatId: number) {
    this.bot.sendMessage(
      chatId,
      'К сожалению на данный момент доступна только версия ***gpt-3.5-turbo***, как только 4я версия станет доступной, я обязательно об этом сообщу.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [this.backToSettingsButton, this.startChatButton('back')],
        },
      },
    )
  }

  /* TOGGLE */
  async languageToggle(chatId: number, id: number, lang: Language) {
    await DBService.languageToggle(id, lang)
    this.bot.sendMessage(
      chatId,
      `Язык был успешно изменён на ${lang === 'ru' ? 'русский' : 'английский'}`,
      {
        reply_markup: {
          inline_keyboard: [this.backToSettingsButton],
        },
      },
    )
  }

  async contextToggle(chatId: number, userId: number, action: string, settings: boolean) {
    await DBService.contextToggle(userId, action)

    const buttons: InlineKeyboardButton[][] =
      action === 'on'
        ? [
            [
              { text: 'Сбросить контекст 🔄', callback_data: 'context_reset' },
              { text: 'Отключить контекст', callback_data: `context_toggle_${userId}_off` },
            ],
          ]
        : [[{ text: 'Включить контекст', callback_data: `context_toggle_${userId}_on` }]]

    if (settings) {
      buttons.push(this.backToSettingsButton)
    }

    buttons.push(this.startChatButton('back'))

    this.bot.sendMessage(
      chatId,
      `Контекст был успешно ${action === 'on' ? 'включен' : 'отключен'}`,
      {
        reply_markup: {
          inline_keyboard: buttons,
        },
      },
    )
  }
}

export default new TgService()
