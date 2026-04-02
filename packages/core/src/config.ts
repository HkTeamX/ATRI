import fs from 'node:fs'
import path from 'node:path'
import { Document, parseDocument } from 'yaml'

export const defineConfig = <T extends object>(items: ConfigItem<T>[]) => items

export async function saveDefaultConfig<T extends object>(items: ConfigItem<T>[], filepath: string): Promise<boolean> {
  let doc: Document
  if (fs.existsSync(filepath)) {
    const content = await fs.promises.readFile(filepath, 'utf-8')
    doc = parseDocument(content)
  }
  else {
    doc = new Document()
  }

  items.forEach((item) => {
    if (doc.get(item.key) !== undefined) {
      return
    }

    const node = doc.createNode(item.val)

    if (item.comment) {
      if (item.place === 'bottom') {
        node.comment = ` ${item.comment}`
      }
      else {
        node.commentBefore = ` ${item.comment}`
      }
    }

    doc.set(item.key, node)
  })

  await fs.promises.writeFile(filepath, doc.toString())
  return true
}

export async function readConfig<T extends object>(filepath: string): Promise<[true, T] | [false, Error]> {
  if (!fs.existsSync(filepath)) {
    return [false, new Error(`Config file not found: ${filepath}`)]
  }

  try {
    const content = await fs.promises.readFile(filepath, 'utf-8')
    const doc = parseDocument(content)
    return [true, doc.toJS()]
  }
  catch {
    return [false, new Error(`Failed to read config file: ${filepath}`)]
  }
}

const [isSuccess, doc] = await readConfig('./config.yaml')
if (isSuccess) {
  console.log(doc)
}

// const config = defineConfig<{
//   username: string
//   password: {
//     hash: string
//   }
// }>([
//   {
//     key: 'username',
//     val: '123456',
//     comment: '这是用户名',
//   },
//   {
//     key: 'password',
//     val: { hash: '123' },
//     comment: '这是密码',
//   },
// ])

// // 使用示例：
// saveDefaultConfig(config, './config.yaml')
