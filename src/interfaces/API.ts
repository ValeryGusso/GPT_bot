export enum ROLE {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface AnswerData {
  message: {
    role: ROLE.ASSISTANT
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
