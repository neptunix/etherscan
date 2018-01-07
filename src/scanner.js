// @flow
import Web3 from 'web3'
import DB from './db'
import Utils from './utils'
import Logger from './logger'

import type { Transaction } from 'web3'
//import { error } from 'util'
//$FlowFixMe

export default class Scanner {
  api: string
  web3: Web3
  db: DB
  logger: Logger

  constructor(apiUrl: string, logLevel: number) {
    this.logger = new Logger(logLevel)
    this.web3 = new Web3(new Web3.providers.HttpProvider(apiUrl))
    this.logger.log(`Creating new Web3 instance with URL ${apiUrl}`)
    this.db = new DB(logLevel)
  }

  init = async () => {
    this.logger.log(`Web3.version: ${this.web3.version}`)
    await this.db.init()
  }

  getBalance = async (account: string) => {
    try {
      const res = await this.web3.eth.getBalance(account)
      return res
    } catch (err) {
      this.logger.error('Scanner[getBalance]', err)
      return null
    }
  }

  runSync = async (nextBlocks: number) => {
    const latest = this.db.getLatestBlock()
    return await this.processBlocks(latest + 1, latest + nextBlocks)
  }

  testTransaction = async (hash: string) => {
    const gt = await this.web3.eth.getTransaction(hash)
    const gtr = await this.web3.eth.getTransactionReceipt(hash)

    this.logger.log(gt, gtr)

    // "{"blockHash":"0xfc0c9b5eeb67c2914fe73852d14431ef00c27fc48d7e60452138e2d47aebbcd4","blockNumber":147064,"from":"0x16644332bB8F5f2229C6825285958a13CBf127E7","gas":628318,"gasPrice":"50000000000","hash":"0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d","input":"0x","nonce":0,"to":null,"transactionIndex":0,"value":"10000000000000000","v":"0x1b","r":"0xa1f6e3dfb12744c85aa9fdc9d0ec0574d9ff09090cb05044ce9b59c4e8c5fc54","s":"0x584034a2eadfcd6bba6bd519121a49aa23d66d5240617158d821a1259862666d"}"
    // "{"blockHash":"0xfc0c9b5eeb67c2914fe73852d14431ef00c27fc48d7e60452138e2d47aebbcd4","blockNumber":147064,"contractAddress":"0xF96023111267D540396CA5c4161b3846375C3b73","cumulativeGasUsed":21000,"from":"0x16644332bb8f5f2229c6825285958a13cbf127e7","gasUsed":21000,"logs":[],"logsBloom":"0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","root":"0x978ddff5b368de77f6bdccd6855cb80025b18d25998be13b16d77995217799e2","to":null,"transactionHash":"0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d","transactionIndex":0}"
    //0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d
  }

  processBlock = async (blockNumber: number) => {
    try {
      //
      const block = await this.web3.eth.getBlock(blockNumber)
      if (!block) {
        this.logger.warn(` . No block data for ${blockNumber}`)
        return blockNumber
      }

      const createBlockResult = await this.db.createBlock(
        block.number,
        new Date(block.timestamp * 1000),
        block.transactions.length
      )
      this.logger.debug(
        ` . Added block #${block.number} Date: ${new Date(
          block.timestamp * 1000
        ).toString()} Transactions: ${
          block.transactions.length
        }. Result: ${createBlockResult.toString()}`
      )

      // Read transactions
      if (block.transactions && block.transactions.length > 0) {
        let transactions: Array<Transaction> = []
        block.transactions.forEach((transaction) => {
          this.logger.debug(
            ` .. [${block.number}] Getting transaction info ${transaction}`
          )
          transactions.push(this.web3.eth.getTransaction(transaction))
        })

        const transactItems = await Utils.executeAllPromises(transactions)

        transactItems.errors
          ? this.logger.error(
              transactItems.errors.map((error) => error.message).join(',')
            )
          : ''

        for (let t = 0; t < transactItems.results.length; t++) {
          const transaction = transactItems.results[t]
          //transactItems.results.forEach(async (transaction: Transaction) => {
          if (transaction === null) {
            this.logger.warn(` .. No transaction data for  ${transaction.hash}`)
            return
          }
          const from = await this.db.createAccount(
            this.web3.utils.hexToNumberString(transaction.from)
          )
          // 0xffff.. - contract creation transaction. TODO: should get getTransactionReceipt
          const to = await this.db.createAccount(
            this.web3.utils.hexToNumberString(
              transaction.to === null ? '0x00' : transaction.to
            )
          )
          if (from === null || to === null) {
            this.logger.error(
              `Error creating accouns. Skipping transaction ${transaction.hash}`
            )
            return
          }
          const createTransactionResult = await this.db.createTransaction(
            this.web3.utils.hexToNumberString(transaction.hash),
            from.id,
            to.id,
            block.number,
            transaction.value
          )
          if (createTransactionResult) {
            this.logger.debug(
              `Added transaction #${transaction.hash} from block [${
                block.number
              }]`
            )
          }
        } //)

        //this.logger.log('Debug: ' + JSON.stringify(block))
      }

      return 0
    } catch (err) {
      this.logger.error(
        `Scanner[processBlock] [${blockNumber}]: ${err.message}`
      )
      return blockNumber
    }
  }

  processBlocks = async (startBlock: number, endBlock: number) => {
    this.logger.log(`Processing blocks from ${startBlock} => ${endBlock}`)

    let blocks = []

    for (let b = startBlock; b <= endBlock; b++) {
      blocks.push(this.processBlock(b))
    }

    try {
      const items = await Promise.all(blocks)
      const errorBlocks = items.filter((b) => parseInt(b) > 0)

      await this.db.updateSettings({ latest_block: endBlock })

      this.logger.log(
        `Successful blocks ${items.length - errorBlocks.length}. Error blocks ${
          errorBlocks.length
        }`
      )
      this.logger.warn(`Error blocks: [${errorBlocks.join(', ')}]`)
    } catch (err) {
      this.logger.error('Promise processBlocks error', err)
    }
  }
}
