import { commands } from './const/const.js'
import TgController from './controllers/tg.js'
import TgService from './services/tg.js'

const bot = TgService.getBot()

bot.setMyCommands(commands)

bot.on('message', async (msg) => {
  TgController.message(msg)
})

bot.on('callback_query', async (cb) => {
  TgController.callback(cb)
})
