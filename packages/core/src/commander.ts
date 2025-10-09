import type { CommanderTransformOptions } from './types/commander.js'

export class CommanderUtils {
  static enum(options: string[]) {
    return function (value: string) {
      if (!options.includes(value)) {
        throw new Error(
          `参数 "${value}" 不是有效参数, 有效参数: \n${options.map((item) => ` - ${item}`).join('\n')}`,
        )
      }

      return value
    }
  }

  static int(options: CommanderTransformOptions = {}) {
    return function (value: string) {
      const parsedValue = parseInt(value)
      if (isNaN(parsedValue)) throw new Error(`参数 "${value}" 不是有效的整数`)
      if (options.min !== undefined && parsedValue < options.min) {
        throw new Error(`参数 "${value}" 不能小于 ${options.min}`)
      }
      if (options.max !== undefined && parsedValue > options.max) {
        throw new Error(`参数 "${value}" 不能大于 ${options.max}`)
      }
      return parsedValue
    }
  }

  static float(options: CommanderTransformOptions = {}) {
    return function (value: string) {
      const parsedValue = parseFloat(value)
      if (isNaN(parsedValue)) throw new Error(`参数 "${value}" 不是有效的浮点数`)
      if (options.min !== undefined && parsedValue < options.min) {
        throw new Error(`参数 "${value}" 不能小于 ${options.min}`)
      }
      if (options.max !== undefined && parsedValue > options.max) {
        throw new Error(`参数 "${value}" 不能大于 ${options.max}`)
      }
      return parsedValue
    }
  }
}
