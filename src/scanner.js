// @flow
import Web3 from 'web3'
import DB from './db'
import { executeAllPromises } from './utils'
import Logger from './logger'

import { type Block, type BlockHeader, type Transaction } from './types'

const maxFetchConnections = 20
const queueLength = 100

export default class Scanner {
  api: string
  web3: Web3
  db: DB
  logger: Logger
  blocksQueue: Array<number>
  transactionsQueue: Array<string>

  constructor(apiUrl: string, logLevel: number) {
    this.logger = new Logger(logLevel)
    this.web3 = new Web3(new Web3.providers.HttpProvider(apiUrl))
    this.logger.log(`Creating new Web3 instance with URL ${apiUrl}`)
    this.db = new DB(logLevel)

    this.blocksQueue = []
    this.transactionsQueue = []
  }

  init = async () => {
    this.logger.log(`Web3.version: ${this.web3.version}`)
    await this.db.init()
  }

  blocksLength = () => this.blocksQueue.length
  transactionsLength = () => this.transactionsQueue.length

  blockExists = (block: number) => this.blocksQueue.indexOf(block) > -1
  transactionExists = (transaction: string) =>
    this.transactionsQueue.indexOf(transaction) > -1

  addBlock = (block: number) => {
    if (!this.blockExists(block)) {
      this.blocksQueue.push(block)
    }
  }

  addTransaction = (transaction: string) => {
    if (!this.transactionExists(transaction)) {
      this.transactionsQueue.push(transaction)
    }
  }

  // Useful methods
  getBalance = async (account: string) => {
    try {
      const res = await this.web3.eth.getBalance(account)
      return res
    } catch (err) {
      this.logger.error('Scanner[getBalance]', err)
      return null
    }
  }

  getBlock = async (block: number) => {
    try {
      const blockResult = await this.web3.eth.getBlock(block)
      if (!blockResult || !blockResult.transactions) {
        this.logger.warn('Scanner[getBlock]: received empty block data')
        return null
      }

      blockResult.transactions.forEach((transaction) => {
        this.addTransaction(transaction)
        // transactions.push(this.web3.eth.getTransaction(transaction))
      })
    } catch (err) {
      this.logger.warn('Scanner[getBlock]', err)
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
