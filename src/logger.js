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

  error = (...args) => {
    if (this.isError) {
      console.error(...args)
    }
  }

  warn = (...args) => {
    if (this.isWarn) {
      console.warn(...args)
    }
  }

  log = (...args) => {
    if (this.isInfo) {
      console.log(...args)
    }
  }

  debug = (...args) => {
    if (this.isDebug) {
      console.debug(...args)
    }
  }

  trace = (...args) => {
    if (this.isTrace) {
      console.trace(...args)
    }
  }
}
