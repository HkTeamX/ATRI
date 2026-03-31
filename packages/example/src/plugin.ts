import { ConversationBuilder, Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'

export const testCommander = yargs()
  .option('age', {
    type: 'number',
    description: 'Your age',
  })

export const testPlugin = new Plugin('atri-plugin-test')
  .onInstall(async ({ event, bot, logger }) => {
    event.regCommandEvent({
      endPoint: 'message.group',
      trigger: 'test',
      commander: testCommander,
      callback: new ConversationBuilder<'message.group', typeof testCommander>('测试对话')
        .handle(async ({ context, options }) => {
          logger.INFO('Conversation started', context, options)
          if (!options.age || options.age < 18) {
            logger.INFO('User is not old enough')
            await bot.sendMsg(context, [Structs.text('Sorry, you must be at least 18 years old to use this command.')])
            return 'quit'
          }

          await bot.sendMsg(context, [Structs.text('Welcome to the conversation!')])
        })
        .step(async ({ context }, data) => {
          logger.INFO('Step 1: Ask for name,data:', data)
          await bot.sendMsg(context, [Structs.text('What is your name?')])
          return {}
        })
        .step(async ({ context }, data) => {
          logger.INFO('Step 2: Ask for city,data:', data)
          await bot.sendMsg(context, [Structs.text('Which city do you live in?')])
          return {
            name: context.raw_message.trim(),
          }
        })
        .step(async ({ context }, data) => {
          logger.INFO('Step 3: Say goodbye,data:', data)
          await bot.sendMsg(context, [Structs.text(`Goodbye ${data.name} from step 2!`)])
          return {
            ...data,
            city: context.raw_message.trim(),
          }
        })
        .resolve(async (data, { context }) => {
          logger.INFO('Conversation resolved with data:', data)
          await bot.sendMsg(context, [Structs.text('Conversation completed!'), Structs.text(`Collected data: ${JSON.stringify(data)}`)])
        }),
    })
  })
