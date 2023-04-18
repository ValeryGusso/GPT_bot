import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const API = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    Authorization: 'Bearer ' + process.env.API_KEY,
  },
})

export default API
