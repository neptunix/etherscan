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
    this.isError ? console.error(...args) : ''
  }

  warn = (...args) => {
    this.isWarn ? console.warn(...args) : ''
  }

  log = (...args) => {
    this.isInfo ? console.log(...args) : ''
  }

  debug = (...args) => {
    this.isDebug ? console.debug(...args) : ''
  }

  trace = (...args) => {
    this.isTrace ? console.trace(args) : ''
  }
}
