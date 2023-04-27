import { RandomModels } from '@prisma/client'
import { FullUser } from '../interfaces/db.js'
import { day } from './const.js'

export function timestampToDate(ts: bigint) {
  return `Предоставляет доступ на ${Math.floor(Number(ts) / day)} дней`
}

export function getQueryId(str: string) {
  return parseInt(str.replace(/^.*_(\d+)$/i, '$1'))
}

export function getQueryName(str: string) {
  return str.replace(/^.*_(.*)_\d+$/i, '$1')
}

export function getToggleId(str: string) {
  return parseInt(str.replace(/^.*_(\d+)_\w+$/i, '$1'))
}

export function getToggleValue(str: string) {
  return str.split('_').pop()!
}

export function getContextValue(str: string) {
  return parseInt(str.replace(/^.*_(\d+)$/i, '$1'))
}

export function getContextId(str: string) {
  return parseInt(str.replace(/^.*_(\d+)_\d+$/i, '$1'))
}

export function getRandomModelName(str: string) {
  return str.replace(/^.*_(\w+)_.+_\d+$/i, '$1') as RandomModels
}

export function getRandomModelValue(str: string) {
  return parseFloat(str.split('_')[4])
}

export function isFullUser(user: FullUser | null | undefined): user is FullUser {
  return !!user?.chatId
}

export function getServiceInfo(user: FullUser) {
  return `/* IMPORTANT! This is service information, imagine that this message does not exist, do not reply to it, but use this information for self-instruction and proper response composition.\nAlways call me by name\n My name is ${
    user.name
  }\n${user.context?.useServiceInfo ? user.context?.serviceInfo : ''}*/`
}

export function safeMarkdown(str: string) {
  return str
}

export function validateMarkdown(markdown: string): boolean {
  let valid = true
  const stack: string[] = []

  for (let i = 0; i < markdown.length; i++) {
    const char = markdown[i]

    if (char === '*') {
      if (stack[stack.length - 1] === '*') {
        stack.pop()
      } else {
        stack.push('*')
      }
    } else if (char === '_') {
      if (stack[stack.length - 1] === '_') {
        stack.pop()
      } else {
        stack.push('_')
      }
    } else if (char === '`') {
      if (stack[stack.length - 1] === '`') {
        stack.pop()
      } else {
        stack.push('`')
      }
    }
  }

  if (stack.length > 0) {
    valid = false
  }

  return valid
}
