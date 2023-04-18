import { AxiosInstance } from 'axios'
import API from '../API/API.js'
import { GPTResponse, ROLE } from '../interfaces/API.js'
import { IResult, ISession, ISessionItem } from '../interfaces/gpt.js'

class GPTController {
  private readonly API
  private currentSessions: ISession = {}

  constructor(API: AxiosInstance) {
    this.API = API
  }

  private safeMarkdown(text: string) {
    // return text.replace(
    //   /([_*[\]()~`>#+\-=|{}.!]|<(\/)?(b|i|a|code|pre)(\s+.*?)?>)/gi,
    //   (match, p1, p2, p3) => {
    //     if (p1) {
    //       return `\\${p1}`
    //     } else if (p2) {
    //       return p2 === '/' ? '_' : ''
    //     } else {
    //       return ''
    //     }
    //   },
    // )

    // return text.replace(/([\_\*\[\]\(\)\~\`\>\#+\\-=\|\{\}\.\!])/g, '\\$1')
    // return text.replace(/([\*\`\\\_\-\~\/])/g, '\\$1')
    return text
  }

  async send(msg: string) {
    const res = await this.API.post<GPTResponse>('/v1/chat/completions', {
      // model: 'text-davinci-003',
      // prompt: msg,
      // stop: null,
      // max_tokens: 2048,
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: ROLE.USER,
          content: msg,
        },
      ],
      temperature: 0.7,
    })

    console.log(res.data)
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

  async sendWithContext(msg: string, id: number) {
    const item: ISessionItem = { role: ROLE.USER, content: msg }

    if (this.currentSessions[id]) {
      this.currentSessions[id].push(item)
    } else {
      this.currentSessions[id] = [item]
    }

    const res = await this.API.post<GPTResponse>('/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: this.currentSessions[id],
      temperature: 0.7,
    })

    console.log(res.data)
    console.log(res.data.choices[0].message.content)

    if (res.status === 200) {
      this.currentSessions[id].push({
        role: res.data.choices[0].message.role,
        content: this.safeMarkdown(res.data.choices[0].message.content),
      })

      return {
        tokens: res.data.usage.total_tokens,
        message: this.safeMarkdown(res.data.choices[0].message.content),
      } as IResult
    } else {
      return null
    }
  }

  resetContext(id: number) {
    this.currentSessions[id] = []
  }
}

export default new GPTController(API)
