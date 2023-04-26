import { IMessage } from './gpt.js'

export interface AnswerData {
  message: IMessage
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
