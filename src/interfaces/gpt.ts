import { ROLE } from './API.js'

export interface ISession {
  [key: string]: ISessionItem[]
}

export interface ISessionItem {
  role: ROLE
  content: string
}

export interface IResult {
  tokens: number
  message: string
}
