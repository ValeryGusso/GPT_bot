import { MessageRole } from '@prisma/client'

export interface IResult {
  tokens: number
  message: string
}

export interface IMessage {
  role: MessageRole
  content: string
  name?: string
}

export interface IOptions {
  model: 'gpt-3.5-turbo' | 'gpt-4'
  messages: IMessage[]
  temperature: number | undefined
  top_p: number | undefined
}
