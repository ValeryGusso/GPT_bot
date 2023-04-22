import { AxiosInstance } from 'axios'
import API from '../API/API.js'
import { GPTResponse } from '../interfaces/API.js'
import { IResult } from '../interfaces/gpt.js'
import { MessageRole } from '@prisma/client'
import { FullUser } from '../interfaces/db.js'

class GPTController {
  private readonly API
  constructor(API: AxiosInstance) {
    this.API = API
  }

  private safeMarkdown(text: string) {
    return text
  }

  async send(msg: string) {
    const res = await this.API.post<GPTResponse>('/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: MessageRole.user,
          content: msg,
        },
      ],
      temperature: 0.7,
    })

    console.log(res.data.choices[0].message.content)

    if (res.status === 200) {
      return {
        tokens: res.data.usage.total_tokens,
        message: this.safeMarkdown(res.data.choices[0].message.content),
      } as IResult
    } else {
      return null
    }
  }

  async sendWithContext(user: FullUser) {
    const res = await this.API.post<GPTResponse>('/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: user.context?.value,
      temperature: user.settings?.temperature,
    })

    console.log(res.data.choices[0].message.content)

    if (res.status === 200) {
      return {
        tokens: res.data.usage.total_tokens,
        message: this.safeMarkdown(res.data.choices[0].message.content),
      } as IResult
    } else {
      return null
    }
  }
}

export default new GPTController(API)
