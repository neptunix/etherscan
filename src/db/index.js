// @flow
import Logger from '../logger'
import { accounts, blocks, settings, transactions } from './models'

export default class DB {
  logger: Logger
  settings: Object

  constructor(logLevel: number) {
    this.logger = new Logger(logLevel)
  }

  _getSettings = async () => {
    try {
      return await settings.find({ where: { id: 1 } })
    } catch (err) {
      this.logger.error('DB[getSettings]', err)
      return null
    }
  }

  init = async () => {
    const settings = await this._getSettings()
    if (settings !== null) {
      this.settings = settings
    }
    return this
  }

  updateSettings = async (params: Object) => {
    try {
      const newSettings = Object.assign({}, this.settings, params)
      await settings.update(newSettings, { where: { id: 1 } })
      this.logger.log(`Updated settings: ${JSON.stringify(params)}`)
    } catch (err) {
      this.logger.error('DB[updateSettings]', err)
    }
  }

  getLatestBlock = () => this.settings.latest_block

  createBlock = async (id: number, date: Date, transactions: number) => {
    try {
      const result = await blocks.create(
        { id, date, transactions },
        { returning: false }
      )
      return true
      //this.logger.log(result)
    } catch (error) {
      this.logger.error(
        `Block [${id}] create error: ${error.message} ${
          error.original ? error.original.message : ''
        }`,
        error.message
      )
      return false
    }
  }

  createAccount = async (account: string) => {
    try {
      const result = await accounts.findOrCreate({ where: { account } })

      if (result && result.length === 2) {
        if (result[1]) {
          // was created
          this.logger.debug(
            `New account was created [${result[0].id}] ${result[0].account}`
          )
        } else {
          this.logger.debug(
            `Found account [${result[0].id}] ${result[0].account}`
          )
        }
        return result[0]
      }
      return null
    } catch (error) {
      this.logger.error(
        `Account [${account}] create error: ${error.message} ${
          error.original ? error.original.message : ''
        }`
      )

      return null
    }
  }

  /*
 .findOrCreate({where: {username: 'sdepold'}, defaults: {job: 'Technical Lead JavaScript'}})
  .spread((user, created) => {
    this.logger.log(user.get({
      plain: true
    }))
    this.logger.log(created)
  */

  createTransaction = async (
    transaction_hash: string,
    from_account: number,
    to_account: number,
    block_id: number,
    wei: number
  ) => {
    try {
      const result = await transactions.create(
        { transaction_hash, from_account, to_account, block_id, wei },
        { returning: false }
      )
      return true
      //this.logger.log(result)
    } catch (error) {
      this.logger.error(
        `Transaction [${transaction_hash}] create error: ${error.message} ${
          error.original ? error.original.message : ''
        }`
      )
      return false
    }
  }
}
