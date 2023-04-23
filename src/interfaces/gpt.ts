import { IMessage } from './API.js'

export interface IResult {
  tokens: number
  message: string
}

export interface IOptions {
  model: 'gpt-3.5-turbo'
  messages: IMessage[]
  temperature: number | undefined
  top_p: number | undefined
}
