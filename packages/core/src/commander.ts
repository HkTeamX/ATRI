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

  static int(value: string) {
    const parsedValue = parseInt(value)
    if (isNaN(parsedValue)) throw new Error(`参数 "${value}" 不是有效的整数`)
    return parsedValue
  }

  static float(value: string) {
    const parsedValue = parseFloat(value)
    if (isNaN(parsedValue)) throw new Error(`参数 "${value}" 不是有效的浮点数`)
    return parsedValue
  }
}
