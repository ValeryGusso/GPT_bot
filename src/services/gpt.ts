import { AxiosInstance } from 'axios'
import API from '../API/API.js'
import { GPTResponse } from '../interfaces/API.js'
import { IResult, IOptions, IMessage } from '../interfaces/gpt.js'
import { MessageRole } from '@prisma/client'
import { FullUser } from '../interfaces/db.js'
import DBService from './db.js'
import { getServiceInfo, safeMarkdown } from '../const/utils.js'

class GPTService {
  private readonly API
  constructor(API: AxiosInstance) {
    this.API = API
  }

  private createOptions(user: FullUser, messages: IMessage[]) {
    const options: IOptions = {
      model: 'gpt-3.5-turbo',
      messages,
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
      },
    ]

    message.unshift({
      role: MessageRole.user,
      content: getServiceInfo(user),
    })

    const options = this.createOptions(user, message)

    const res = await this.API.post<GPTResponse>('/v1/chat/completions', options)

    // console.log(res.data.choices[0].message.content)

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

    const messages: IMessage[] = []
    user.context?.context.forEach((msg, i) => {
      messages.push({ role: msg.role, content: msg.content })
    })

    messages.unshift({
      role: MessageRole.user,
      content: getServiceInfo(user),
    })

    const options = this.createOptions(user, messages)

    const res = await this.API.post<GPTResponse>('/v1/chat/completions', options)

    // console.log(res.data.choices[0].message.content)

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
