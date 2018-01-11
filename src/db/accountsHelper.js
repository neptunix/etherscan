// @flow
export default class AccountsHelper {
  accounts: Object

  constructor() {
    this.accounts = {}
  }

  length = () => Object.keys(this.accounts).length

  get = (value: string) => {
    return this.accounts[value]
  }

  set = (value: string, id: number) => {
    this.accounts[value] = id
  }

  clear = () => {
    this.accounts = {}
  }
}
