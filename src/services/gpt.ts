import { AxiosInstance } from 'axios'
import API from '../API/API.js'
import { GPTResponse } from '../interfaces/API.js'
import { IResult, IOptions, IMessage } from '../interfaces/gpt.js'
import { MessageRole } from '@prisma/client'
import { FullUser } from '../interfaces/db.js'
import DBService from './db.js'
import { isFullUser, safeMarkdown } from '../const/utils.js'

class GPTService {
  private readonly API
  constructor(API: AxiosInstance) {
    this.API = API
  }

  private createOptions(user: FullUser, messages: IMessage[]) {
    const options: IOptions = {
      model: 'gpt-3.5-turbo',
      messages,
      temperature: undefined,
      top_p: undefined,
    }

    switch (user.settings?.randomModel) {
      case 'temperature':
        options.temperature = user.settings.temperature
        break
      case 'topP':
        options.top_p = user.settings.topP
        break
      case 'both':
        options.temperature = user.settings.temperature
        options.top_p = user.settings.topP
        break
    }
    return options
  }

  async send(msg: string, user: FullUser) {
    const message: IMessage[] = [
      {
        role: MessageRole.user,
        content: msg,
        name: user.name,
      },
    ]

    if (user.context?.useServiceInfo) {
      message.unshift({ role: MessageRole.system, content: user.context.serviceInfo })
    }

    const options = this.createOptions(user, message)

    const res = await this.API.post<GPTResponse>('/v1/chat/completions', options)

    console.log(res.data.choices[0].message.content)

    if (res.status === 200) {
      return {
        tokens: res.data.usage.total_tokens,
        message: safeMarkdown(res.data.choices[0].message.content),
      } as IResult
    } else {
      return null
    }
  }

  async sendWithContext(chatId: number) {
    const user = await DBService.getByChatId(chatId)

    if (!isFullUser(user)) {
      throw new Error('User not found')
    }

    const messages: IMessage[] = []

    user.context?.value.forEach((msg) => {
      messages.push({ role: msg.role, content: msg.content, name: user.name })
    })

    if (user.context?.useServiceInfo) {
      messages.unshift({ role: MessageRole.system, content: user.context.serviceInfo })
    }

    const options = this.createOptions(user, messages)

    const res = await this.API.post<GPTResponse>('/v1/chat/completions', options)

    console.log(res.data.choices[0].message.content)

    if (res.status === 200) {
      return {
        tokens: res.data.usage.total_tokens,
        message: safeMarkdown(res.data.choices[0].message.content),
      } as IResult
    } else {
      return null
    }
  }
}

export default new GPTService(API)
