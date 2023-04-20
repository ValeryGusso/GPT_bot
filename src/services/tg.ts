import TelegramBot, { InlineKeyboardButton, InlineKeyboardMarkup } from 'node-telegram-bot-api'
import GPTController from '../controllers/gpt.js'
import DBService from './db.js'
import { ICode, IReg, ITarif, PriceCache, PriceCacheKey } from '../interfaces/tg.js'
import { FullUser } from '../interfaces/db.js'
import { Currency, TarifType } from '@prisma/client'

const withContext = true

class TgService {
  private readonly bot

  constructor() {
    this.bot = new TelegramBot(process.env.TG_TOKEN!, { polling: true })
  }

  getBot() {
    return this.bot
  }

  async test(id: number) {
    await this.bot.sendMessage(id, 'Test', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Test 1', callback_data: 'test_1' },
            { text: 'Test 2', callback_data: 'test_2' },
          ],
          [
            { text: 'Test 3', callback_data: 'test_3' },
            { text: 'Test 4', callback_data: 'test_4' },
          ],
          [{ text: 'Test 5', callback_data: 'test_5' }],
        ],
      },
    })
  }

  async welcome(id: number) {
    this.bot.sendMessage(
      id,
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

  async start(id: number, info: IReg, error?: string) {
    switch (info.step) {
      case 1:
        this.bot.sendMessage(
          id,
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
          id,
          `А теперь настало время познакомиться, могу ли я обращаться к тебе ${info.name}? Нажми "Продолжить" чтобы сохранить текущее или пришли мне другое имя`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: 'Продолжить', callback_data: 'reg_skip_name' }]],
            },
          },
        )
        break

      case 3:
        this.bot.sendMessage(
          id,
          `Очень приятно, ${info.name}, меня зовут GPTBot.\nОсталось только отпределиться с тарифом! Если у тебя есть промо-код, то скорее отправь его мне. Но ничего страшного, если у тебя его нет, ты можешь воспользовалься бесплатным тарифом для знакомства с сервисом. Не переживай, насчёт лимитов, тебе их точно хватит!`,
          {
            parse_mode: 'Markdown',
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
          id,
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
        await DBService.createUser(id, info)
        this.bot.sendMessage(
          id,
          'Регистрация прошла успешно, поздравляю! Теперь тебе доступны все функции бота!',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: 'Начать чат!', callback_data: 'reg_start' }]],
            },
          },
        )
        break

      default:
        break
    }
  }

  async sendMenu(id: number, user: FullUser) {
    const inline_keyboard: InlineKeyboardButton[][] = [
      [
        { text: 'Настройки', callback_data: 'menu_settings' },
        { text: 'Мои лимиты', callback_data: 'menu_limits' },
      ],
      [
        { text: 'Тарифы', callback_data: 'menu_tarifs' },
        { text: 'О боте', callback_data: 'menu_about' },
      ],
      // [
      //   { text: 'Test 2', callback_data: 'menu_' },
      //   { text: 'Test 3', callback_data: 'menu_' },
      // ],
      [{ text: 'Начать чат!', callback_data: 'menu_start' }],
    ]

    if (user.isAdmin) {
      inline_keyboard.push([{ text: 'Админка', callback_data: 'menu_admin' }])
    }

    await this.bot.sendMessage(id, 'Меню:', {
      reply_markup: {
        inline_keyboard,
      },
    })
  }

  async createTarif(id: number, info: ITarif, price: PriceCache) {
    switch (info.step) {
      case 1:
        this.bot.sendMessage(id, 'Кодовое название тарифа:')
        break
      case 2:
        this.bot.sendMessage(id, 'Титловое название тарифа:')
        break
      case 3:
        this.bot.sendMessage(id, 'Описание:')
        break
      case 4:
        this.bot.sendMessage(id, 'Пришли ссылку на изображение:')
        break
      case 5:
        this.bot.sendMessage(id, 'Общий лимит тарифа:')
        break
      case 6:
        this.bot.sendMessage(id, 'Дневной лимит тарифа:')
        break
      case 7:
        this.bot.sendMessage(id, 'Максимальная длина контекста:')
        break
      case 8:
        this.bot.sendMessage(id, 'Длительность тарифа:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '1 месяц', callback_data: 'tarif_duration_2592000000', pay: true }],
              [
                {
                  text: '1 год',
                  callback_data: 'tarif_duration_31536000000',
                  pay: true,
                },
              ],
            ],
          },
        })
        break
      case 9:
        this.bot.sendMessage(id, 'Тип тарифа:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Лимит', callback_data: 'tarif_type_' + TarifType.limit, pay: true }],
              [{ text: 'Подписка', callback_data: 'tarif_type_' + TarifType.subscribe, pay: true }],
            ],
          },
        })
        break
      case 10:
        this.bot.sendMessage(id, 'Валюта:.', {
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
        this.bot.sendMessage(id, 'Цена:', {})
        break
      case 12:
        let result = `Текущие ценники для тарифа ${info.name}\n`
        for (const key in price) {
          result += `${price[key as PriceCacheKey].value} ${
            price[key as PriceCacheKey].currency
          } \n`
        }
        this.bot.sendMessage(id, result, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Добавить ещё один прайс', callback_data: 'tarif_add_price' }],
              [{ text: 'Продолжить', callback_data: 'tarif_continue' }],
            ],
          },
        })
        break
      case 13:
        console.log('CASE 13: ', info)

        this.bot.sendMessage(
          id,
          `Тариф ${info.name} / ${info.title} успешно создан!
          \nОписание: ${info.description} 
          \nЛимиты: ${info.limit} / ${info.dailyLimit} 
          \nМаксимальный контекст: ${info.maxContext} 
          \nТип: ${info.type}  
          \nДлительность: ${Math.floor(info.duration / 24 / 60 / 60 / 1000)}дней
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

  async createCode(id: number, info: ICode) {
    switch (info.step) {
      case 0:
        await this.bot.sendMessage(id, 'Введи код:')
        break

      case 1:
        await this.bot.sendMessage(id, 'Укажи лимит использования')
        break

      case 2:
        const tarifs = await DBService.getAllTarifs()
        let row = 0
        const buttons: InlineKeyboardButton[][] = []
        tarifs.forEach((tarif) => {
          const index = Math.floor(row / 5)

          if (!Array.isArray(buttons[index])) {
            buttons[index] = []
          }

          buttons[index].push({
            text: tarif.name,
            callback_data: 'code_tarif_' + tarif.name + '_' + tarif.id,
          })

          row++
        })
        await this.bot.sendMessage(id, `Выбери тариф`, {
          reply_markup: {
            inline_keyboard: buttons,
          },
        })
        break
      case 4:
        await this.bot.sendMessage(
          id,
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
          id,
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
                [
                  {
                    text: 'Вернуться в меню',
                    callback_data: 'code_back',
                  },
                ],
              ],
            },
          },
        )
        break
    }
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

  async settings(id: number, user: FullUser) {}

  async greeting(id: number, user: FullUser) {
    this.bot.sendMessage(
      id,
      `Рад приветсвовать тебя вновь, ${user.name}.\nЕсли ты забыл список команд или тебе нужна помощь, то можешь выбрать одно из преведённых ниже действий чтобы продолжить`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Заполнить профиль заново', callback_data: 'command_' },
              { text: 'Перейти к настройкам', callback_data: 'command_' },
            ],
            [
              { text: 'Посмотреть тарифы', callback_data: 'command_' },
              { text: 'Информация о боте', callback_data: 'command_' },
            ],
            [{ text: 'Начать диалог с botGPT!', callback_data: 'command_' }],
          ],
        },
      },
    )
  }

  async info(id: number) {
    this.bot.sendMessage(id, 'Информация!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Кнопка', callback_data: 'info_' }],
          [{ text: 'Ещё кнопка', callback_data: 'info_' }],
        ],
      },
    })
  }

  async sendQuestion(id: number, text: string, user: FullUser) {
    let isOver = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const sendTyping = () => {
      this.bot.sendChatAction(id, 'typing')
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        if (!isOver) {
          sendTyping()
        }
      }, 5000)
    }

    sendTyping()

    // const res = withContext
    const res = user.context?.useContext
      ? await GPTController.sendWithContext(text, id)
      : await GPTController.send(text)

    isOver = true

    if (res) {
      const activity = await DBService.updateActivity(id, res.tokens)
      const usage = `\n *****
      \nИспользовано ${res.tokens}токенов. 
      \nОсталось: 
      \nсегодня: ${user.activity?.tarif.dailyLimit! - activity.dailyUsage} всего: ${
        user.activity?.tarif.limit! - activity.usage
      }
      \n*****`
      await this.bot.sendMessage(id, res.message + usage, {
        parse_mode: 'Markdown',
        reply_markup: { keyboard: [[{ text: 'Сбросить контекст' }]] },
      })
      return true
    } else {
      await this.sendMessage(id, 'Упс... что-то пошло не так, попробуй ещё раз.')
      return false
    }
  }

  async sendMessage(id: number, message: string) {
    this.bot.sendMessage(id, message)
  }
}

export default new TgService()
