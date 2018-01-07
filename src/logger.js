// @flow

export default class Log {
  isError: boolean
  isWarn: boolean
  isInfo: boolean
  isDebug: boolean
  isTrace: boolean

  constructor(level: number) {
    this.isError = level > 0
    this.isWarn = level > 1
    this.isInfo = level > 2
    this.isDebug = level > 3
    this.isTrace = level > 4
  }

  error = (...args: Array<any>) => {
    if (this.isError) {
      console.error(...args)
    }
  }

  warn = (...args: Array<any>) => {
    if (this.isWarn) {
      console.warn(...args)
    }
  }

  log = (...args: Array<any>) => {
    if (this.isInfo) {
      console.log(...args)
    }
  }

  debug = (...args: Array<any>) => {
    if (this.isDebug) {
      console.debug(...args)
    }
  }

  trace = (...args: Array<any>) => {
    if (this.isTrace) {
      console.trace(...args)
    }
  }
}
