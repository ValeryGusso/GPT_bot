import { MessageRole } from '@prisma/client'

export interface ISession {
  [key: string]: ISessionItem[]
}

export interface ISessionItem {
  role: MessageRole
  content: string
}

export interface IResult {
  tokens: number
  message: string
}
