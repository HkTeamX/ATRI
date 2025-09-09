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
}
