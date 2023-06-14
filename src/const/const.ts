import { Language } from '@prisma/client'
import { BotCommand } from 'node-telegram-bot-api'

/* TIME */
export const hour = 60 * 60 * 1000
export const day = 24 * 60 * 60 * 1000
export const month = 30 * 24 * 60 * 60 * 1000
export const year = 365 * 24 * 60 * 60 * 1000

/* BUTTONS FOR TELEGRAM MENU */
export const commands = (lang: Language): BotCommand[] => {
  switch (lang) {
    case 'ru':
      return [
        {
          command: '/start',
          description: 'Начать!',
        },
        {
          command: '/menu',
          description: 'Меню',
        },
        {
          command: '/settings',
          description: 'Настройки',
        },
        {
          command: '/info',
          description: 'Подсказки о работе бота',
        },
        {
          command: '/about',
          description: 'Буду рад представиться :)',
        },
        {
          command: '/chat',
          description: 'Запустить чат',
        },
        {
          command: '/reset',
          description: 'Сбросить контекст',
        },
      ]
    case 'en':
      return [
        {
          command: '/start',
          description: 'Start!',
        },
        {
          command: '/menu',
          description: 'Menu',
        },
        {
          command: '/settings',
          description: 'Settings',
        },
        {
          command: '/info',
          description: 'More information',
        },
        {
          command: '/about',
          description: 'About me :)',
        },
        {
          command: '/chat',
          description: 'Start chat',
        },
        {
          command: '/reset',
          description: 'Reset context',
        },
      ]
  }
}
