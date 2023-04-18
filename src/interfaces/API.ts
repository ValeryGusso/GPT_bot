import { MessageRole } from '@prisma/client'

export interface AnswerData {
  message: {
    role: MessageRole
    content: string
  }
  finish_reason: string
  index: number
}

interface IUsege {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface GPTResponse {
  id: string
  object: string
  created: string
  model: string
  usage: IUsege
  choices: AnswerData[]
}
