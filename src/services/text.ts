import { Language } from '@prisma/client'

class TextService {
  /* BUTTONS */
  tarifsButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Тарифы 💳'
      case 'en':
        return 'Tarifs 💳'
    }
  }
  aboutButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'О боте ℹ️'
      case 'en':
        return 'About ℹ️'
    }
  }
  settingsButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Настройки ⚙️'
      case 'en':
        return 'Settings ⚙️'
    }
  }
  menuButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Меню 📋'
      case 'en':
        return 'Menu 📋'
    }
  }
  contactButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Связаться со мной'
      case 'en':
        return 'Contact me'
    }
  }
  chatButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Начать чат ✉️'
      case 'en':
        return 'Start chat ✉️'
    }
  }
  resetContextButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Сбросить контекст  🔄'
      case 'en':
        return 'Reset context  🔄'
    }
  }
  offContextButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Отключить контекст'
      case 'en':
        return 'Disable context'
    }
  }
  onContextButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Включить контекст'
      case 'en':
        return 'Enable сontext'
    }
  }
  startButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Начать 🚀'
      case 'en':
        return 'Start 🚀'
    }
  }
  regButton(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Зарегистрироваться! 🚀'
      case 'en':
        return 'Registration 🚀'
    }
  }

  /* TITLES */
  menuTitle(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Меню'
      case 'en':
        return 'Menu'
    }
  }
  /* COMMANDS */
  startCommand(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Для начала использования бота воспользуйся командой /start или же нажми на соответствующую кнопку!'
      case 'en':
        return 'To start this bot, use the /start command or click on the appropriate button!'
    }
  }
  commandsHeader(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Вот список всех доступных комманд:\n'
      case 'en':
        return 'All available commands:\n'
    }
  }
  commandsFooter(lang: Language) {
    switch (lang) {
      case 'ru':
        return '\nИли, ты можешь выбрать одно из наиболее популярных действий нажатием кнопки.'
      case 'en':
        return '\nOr, you can choose one of the most popular actions by pressing a button.'
    }
  }
  commandsList(lang: Language) {
    switch (lang) {
      case 'ru':
        return `\n/start  - Начать работу с ботом
        \n/menu  - Меню
        \n/settings - Настройки
        \n/info - Информация о боте
        \n/about - О разработчике
        \n/chat - Начать чат
        \n/reset - Сбросить контекст\n`
      case 'en':
        return `\n/start  - Start
        \n/menu  - Menu
        \n/settings - Settings
        \n/info - More information
        \n/about - About me
        \n/chat - Start chat
        \n/reset - Reset context\n`
    }
  }
  about(lang: Language) {
    switch (lang) {
      case 'ru':
        return 'Рад приветствовать тебя в своём боте!\nИдея создания этого бота пришла в голову совершенно случайно, когда мне стало лень каждый раз включать/выключать впн, когда необходимо воспользоваться оригинальным ChatGPT, поэтому я полез в телеграм и принялся искать уже готового бота, хоть и с небольшими лимитами, но мне хватило бы и этого. Каким же было удивление, когда кроме просьб подписаться не десяток сообществ, реферальных систем и рекламы всякого говна, я ничего не обраружил. А почему бы не сделать нормально? Вот и сделал. Никакой рекламы, сомнительных ссылок и "пригласи друга получи ещё 10 запросов" тут не будет. Максимально открытая система использования, стоимость запроса в openAI рассчитывается из количества токенов. У меня тоже. Всё очень просто, не правда ли?\nЕсли нужен новый тариф, закончились лимиты, или возникли какие-нибудь вопросы, то готов со всем помочь @gusso\nСказать спасибо можно сюда 2200 7004 7065 2297 :)'
      case 'en':
        return `Glad to welcome you to my bot! \nThe idea of creating this bot came to me completely by chance when I got tired of turning on/off my VPN every time I needed to use the original ChatGPT. So, I went to Telegram and started looking for an existing bot, even with some limitations, but that would have been enough for me. Imagine my surprise when, in addition to requests to subscribe to dozens of communities, referral systems, and advertisements for all sorts of crap, I found nothing. Why not do it properly? That's what I did. No advertising, dubious links, or "invite a friend and get 10 more requests" here. The system is as open as possible, and the cost of a request to openAI is calculated based on the number of tokens. Mine too. It's all very simple, isn't it? If you need a new tariff, have run out of limits, or have any questions, I'm ready to help @gusso. \nYou can say thank you here 2200 7004 7065 2297 :)`
    }
  }
  info(lang: Language) {
    switch (lang) {
      case 'ru':
        return `Бот работает на основе модели обработки естественного языка gpt-3.5-turbo.
      \nДля управления уровнем случайности ответов, генерируемых нейросетью используюется один из двух параетров: temperature или top_p
      \nTemperature - это параметр, который определяет, насколько "смелыми" будут ответы модели. Он регулирует вероятности выбора следующего слова в ответе. Чем выше значение temperature, тем больше возможных ответов модель может предоставить. Если значение temperature равно 1, то вероятности слов будут распределены равномерно. Если значение temperature меньше 1, то это означает, что модель будет более консервативной в своих ответах, выбирая более вероятные слова. Если значение temperature больше 1, то модель будет более смелой в своих ответах, выбирая менее вероятные слова. Параметр temperature позволяет создавать более разнообразные и интересные ответы.
      \nTop_p - это еще один параметр, который определяет, насколько "смелыми" будут ответы модели. Он регулирует вероятности выбора следующего слова в ответе, но в отличие от temperature, он учитывает только те слова, которые имеют наибольшую вероятность. Если значение top_p равно 1, то модель будет выбирать самые вероятные слова. Если значение top_p меньше 1, то модель будет выбирать менее вероятные слова, но только если их суммарная вероятность не превышает значение top_p. Параметр top_p позволяет создавать более разнообразные ответы, но не такие смелые, как при использовании параметра temperature.
      \nОба параметра могут использоваться вместе для того, чтобы получить наиболее интересные ответы. Например, можно установить значение temperature равным 1.5 и top_p равным 0.9, чтобы получить ответы, которые будут и смелыми, и разнообразными.
      \nВыставить настройки этих паметров можно в настройках, а так же выбрать любую из предложенных моделей. По умолчанию используется модель *temperature = 0.7*
      \nПомимо этого в настройках присутствуют *параметры запросов*, это служебная информация, которая каждый раз будет отправляться вместе с запросом и учитываться при составлении ответа. По умолчанию там присутсвует только имя, указанное при регистрации. Для экономии трафика можно отключить использование служебной информации.
      \nКстати, по поводу трафика, а что же такое эти непонятные токены в которых всё измеряется?
      \nТокены в ChatGPT являются необходимой составляющей безопасности и управления доступом к данным. Они обеспечивают конфиденциальность и целостность данных.
      Токены в ChatGPT - это ограничения на количество слов, которые можно использовать при запросе на генерацию текста. Каждый токен представляет собой одно слово или знак препинания, который учитывается в запросе.
      Использование токенов важно для оптимизации производительности и предотвращения перегрузки сервера. Если запрос содержит слишком много токенов, сервер может отказать в обработке запроса или вернуть некачественный результат. Поэтому перед отправкой запроса следует проверять количество использованных токенов и при необходимости уменьшать их количество.`
      case 'en':
    }
  }
}
export default new TextService()
