import { ConversationBuilder, Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'

export const testCommander = yargs()
  .option('age', {
    type: 'number',
    description: 'Your age',
  })

export const testPlugin = new Plugin('atri-plugin-test')
  .onInstall(async ({ event, bot }) => {
    event.regCommandEvent({
      endPoint: 'message.private',
      trigger: 'test',
      commander: testCommander,
      callback: new ConversationBuilder<'message.private', typeof testCommander>('测试对话')
        .handle(async ({ context, options }) => {
          if (!options.age || options.age < 18) {
            await bot.sendMsg(context, [Structs.text('年龄必须大于等于18岁才能参与对话')])
            return 'quit'
          }

          await bot.sendMsg(context, [Structs.text(`你的年龄是 ${options.age}`)])
          await bot.sendMsg(context, [Structs.text('1. 请输入您的名字:')])

          return {
            age: options.age,
          }
        })
        .step({
          // 预检函数，返回 false 可以阻止 callback 执行
          predicate: async ({ context, isLastRetry }) => {
            if (context.raw_message.trim().length < 3) {
              if (!isLastRetry) {
                await bot.sendMsg(context, [Structs.text('名字不能少于3位，请重新输入:')])
              }
              return false
            }

            return true
          },
          callback: async ({ context }, data) => {
            await bot.sendMsg(context, [Structs.text(`你好 ${context.raw_message.trim()}!\n`), Structs.text('2. 请输入您所在的城市:')])

            return {
              ...data,
              name: context.raw_message.trim(),
            }
          },
          timeout: 60 * 1000, // 可以为每个 step 单独设置 timeout 和 retryCount
          retryCount: 1,
        })
        // step 也可以直接传一个 callback 函数，等价于上面只有 callback 没有 predicate 的写法
        .step(async ({ context }, data) => {
          await bot.sendMsg(context, [Structs.text(`您所在的城市是 ${context.raw_message.trim()} 吗? (是/否)`)])
          return {
            ...data,
            city: context.raw_message.trim(),
          }
        })
        .step(async ({ context }, data) => {
          if (context.raw_message.trim() === '是') {
            await bot.sendMsg(context, [Structs.text('感谢您的确认!')])
            return {
              ...data,
              confirm: true,
            }
          }
          else {
            await bot.sendMsg(context, [Structs.text('请重新输入您所在的城市:')])
            return -1 // 返回 -1 可以往前回退步骤
          }
        })
        .resolve(async (data, { context }) => {
          await bot.sendMsg(context, [Structs.text('对话完成!'), Structs.text(`收集到的数据: ${JSON.stringify(data)}`)])
        }),
    })
  })
