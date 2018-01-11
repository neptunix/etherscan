// @flow
import Logger from '../logger'
import { accounts, blocks, settings, transactions } from './models'
import { type Block, type BlockHeader, type Transaction } from '../types'

export type DBResult = {
  result: boolean,
  message: string | null,
  data: Object | null
}

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

  updateSettings = async (params: Object): Promise<void> => {
    try {
      const newSettings = Object.assign({}, this.settings, params)
      await settings.update(newSettings, { where: { id: 1 } })
      this.logger.log(`Updated settings: ${JSON.stringify(params)}`)
    } catch (err) {
      this.logger.error('DB[updateSettings]', err)
    }
  }

  getLatestBlock = () => this.settings.latest_block

  bulkCreateBlocks = async (data: Array<Block>): Promise<DBResult> => {
    try {
      const result = await blocks.bulkCreate(data, { returning: false })
      return { result: true, message: null, data: null }
    } catch (error) {
      const message = `BulkCreateBlock error [Blocks: ${data
        .map((item) => item.number)
        .join(', ')}]: ${error.message} ${
        error.original ? error.original.message : ''
      }`
      return { result: false, message, data: null }
    }
  }

  bulkCreateTransactions = async (
    data: Array<Transaction>
  ): Promise<DBResult> => {
    try {
      //     const result = await transactions.bulkCreate(data, {
      //       returning: false
      //     })
      return transactions.bulkCreate(data, {
        returning: false
      })
      //return { result: true, message: null, data: null }
    } catch (error) {
      const message = `BulkCreateTransaction error [TX: ${data
        .map((item) => item.transaction_hash)
        .join(', ')}]: ${error.message} ${
        error.original ? error.original.message : ''
      }`
      return { result: false, message, data: null }
    }
  }

  createBlock = async (
    id: number,
    date: Date,
    transactions: number
  ): Promise<DBResult> => {
    try {
      const result = await blocks.create(
        { id, date, transactions },
        { returning: false }
      )
      return { result: true, message: null, data: null }
    } catch (error) {
      const message = `Block [${id}] create error: ${error.message} ${
        error.original ? error.original.message : ''
      }`
      return { result: false, message, data: null }
    }
  }

  createAccount = async (account: string): Promise<DBResult> => {
    try {
      const result = await accounts.findOrCreate({ where: { account } })

      if (result && result.length === 2) {
        let message
        if (result[1]) {
          // was created
          message = `New account was created [${result[0].id}] ${
            result[0].account
          }`
        } else {
          message = `Found account [${result[0].id}] ${result[0].account}`
        }
        return { result: true, message, data: result[0] }
      }
      return { result: false, message: null, data: null }
    } catch (error) {
      return {
        result: false,
        message: `Account [${account}] create error: ${error.message} ${
          error.original ? error.original.message : ''
        }`,
        data: null
      }
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
  ): Promise<DBResult> => {
    try {
      const result = await transactions.create(
        { transaction_hash, from_account, to_account, block_id, wei },
        { returning: false }
      )
      return { result: true, message: null, data: null }
    } catch (error) {
      return {
        result: false,
        message: `Transaction [${transaction_hash}] create error: ${
          error.message
        } ${error.original ? error.original.message : ''}`,
        data: null
      }
    }
  }
}
