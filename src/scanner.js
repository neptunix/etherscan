// @flow
import Web3 from 'web3'
import DB from './db'
import { executeAllPromises, sleep } from './utils'
import Logger from './logger'
import SyncQueue from './syncQueue'

import { type Block, type BlockHeader, type Transaction } from './types'

const maxFetchConnections = 400
const maxDownloadQueueLength = 3000
const maxSyncQueueLength = 10000

type Response = {
  type: 'b' | 't',
  block?: null | Block,
  blockNumber?: number,
  transaction?: null | Transaction,
  transactionHash?: string
}

export default class Scanner {
  api: string
  web3: Web3
  db: DB
  logger: Logger
  sync: SyncQueue
  blocksQueue: Array<number>
  transactionsQueue: Array<string>
  currentConnections: number
  downloadRunning: boolean

  constructor(apiUrl: string, logLevel: number) {
    this.logger = new Logger(logLevel)
    this.web3 = new Web3(new Web3.providers.HttpProvider(apiUrl))
    this.logger.log(`Creating new Web3 instance with URL ${apiUrl}`)
    this.db = new DB(logLevel)
    this.sync = new SyncQueue(this.db, this.logger, this.web3)

    this.blocksQueue = []
    this.transactionsQueue = []
    this.currentConnections = 0
    this.downloadRunning = false
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

  nextBlock = (): number =>
    this.blocksLength() > 0 ? this.blocksQueue.shift() : -1
  nextTransaction = (): string =>
    this.transactionsLength() > 0 ? this.transactionsQueue.shift() : ''

  addBlock = (block: number) => {
    if (!this.blockExists(block)) {
      this.blocksQueue.push(block)
      this.checkDownloadRunning()
    }
  }

  addTransaction = (transaction: string) => {
    if (!this.transactionExists(transaction)) {
      this.transactionsQueue.push(transaction)
      this.checkDownloadRunning()
    }
  }

  getBlock = async (block: number): Promise<Response> => {
    try {
      //this.logger.debug(`Fetching Block ${block}`)
      this.currentConnections += 1
      const blockResult = await this.web3.eth.getBlock(block)
      //this.logger.debug(`Block received`, block)
      if (!blockResult || !blockResult.transactions) {
        this.logger.warn(
          `Scanner[getBlock] [${block}]: received empty block data`
        )
        return { type: 'b', block: null, blockNumber: block }
      }

      blockResult.transactions.forEach((transaction) => {
        this.addTransaction(transaction)
      })
      this.currentConnections -= 1
      return { type: 'b', block: blockResult, blockNumber: block }
    } catch (err) {
      //this.logger.warn('Scanner[getBlock] [block]', err.message)
      this.currentConnections -= 1
      return { type: 'b', block: null, blockNumber: block }
    }
  }

  getTransaction = async (hash: string): Promise<Response> => {
    try {
      //this.logger.debug(`Fetching Transaction ${hash}`)
      this.currentConnections += 1
      const transactionResult = await this.web3.eth.getTransaction(hash)
      //this.logger.debug(`Transaction received`, transactionResult)
      this.currentConnections -= 1
      if (!transactionResult) {
        this.logger.warn(
          `Scanner[getTransaction] [${hash}]: received empty transaction data`
        )
        return { type: 't', transaction: null, transactionHash: hash }
      }
      return {
        type: 't',
        transaction: transactionResult,
        transactionHash: hash
      }
    } catch (err) {
      //this.logger.warn(`Scanner[getTransaction] [${hash}]`, err.message)
      this.currentConnections -= 1
      return { type: 't', transaction: null, transactionHash: hash }
    }
  }

  runSync = async (nextBlocks: number) => {
    const latestBlock = this.db.getLatestBlock()

    this.logger.log(
      `Starting blocks sync for next ${nextBlocks} blocks. Latest block ${latestBlock}`
    )

    let currentBlock = latestBlock + 1
    let isStopping = false

    while (true) {
      this.logger.debug(
        `Download queue => Connections: ${
          this.currentConnections
        }, Blocks: ${this.blocksLength()}, Transactions: ${this.transactionsLength()}`
      )

      if (currentBlock >= latestBlock + nextBlocks) {
        if (isStopping === false) {
          this.logger.log(
            'Stopped blocks processing queue. Waiting for sync queue to empty ...'
          )
          isStopping = true
        }
        this.logger.log(
          `Scanner loop stopping... Waiting for sync queue to empty: Blocks/Transactions: [${this.sync.blocksLength()} / ${this.sync.transactionsLength()}]`
        )
        if (
          this.sync.blocksLength() > 0 ||
          this.sync.transactionsLength() > 0
        ) {
          await sleep(1000)
          continue
        }
        this.logger.log(
          `Blocks processing complete. Stopped on block ${currentBlock}`
        )
        break
      }

      const addToQueue = Math.min(
        maxDownloadQueueLength,
        currentBlock + nextBlocks
      )
      const currentTasks = this.blocksLength() + this.transactionsLength()
      if (currentTasks < addToQueue) {
        for (let b = currentTasks; b < addToQueue; b++) {
          this.addBlock(currentBlock++)
        }
      }
      await sleep(1000)
    }
  }

  checkDownloadRunning = () => {
    if (!this.downloadRunning) {
      this.downloadProcessor()
    }
  }

  downloadProcessor = async () => {
    if (this.downloadRunning) {
      return
    }
    this.downloadRunning = true
    //this.logger.log('Starting download processor')
    const t1 = process.hrtime()

    let totalBlocks = 0
    let totalTransactions = 0

    while (true) {
      if (this.blocksLength() === 0 && this.transactionsLength() === 0) {
        const t2 = process.hrtime(t1)
        const diff = (t2[0] * 1e9 + t2[1]) / 1e6
        console.log(
          `
  Download Queue is empty. Time ${diff}ms (B+T/sec: ${totalBlocks +
            totalTransactions /
              diff *
              1000}) Total blocks/trans: ${totalBlocks}/${totalTransactions}
          `
        )
        break
      }

      // If SyncQueue is longer than expected, stop fetching blocks
      if (
        this.sync.blocksLength() + this.sync.transactionsLength() >
        maxSyncQueueLength
      ) {
        console.log(
          `Sync Queue is too long [${this.sync.blocksLength()}, ${this.sync.transactionsLength()}]. Not fetching new blocks`
        )
        await sleep(1000)
        continue
      }

      console.log(
        `DownloadQueue length => blocks: ${this.blocksLength()}, transactions: ${this.transactionsLength()}`
      )

      let nextBlocks: Array<Promise<any>> = []
      let nextTransactions: Array<Promise<any>> = []

      for (let i = this.currentConnections; i < maxFetchConnections; i++) {
        const nextBlock = this.nextBlock()
        if (nextBlock !== -1) {
          nextBlocks.push(this.getBlock(nextBlock))
          continue
        }
        const nextTransaction = this.nextTransaction()
        if (nextTransaction !== '') {
          nextTransactions.push(this.getTransaction(nextTransaction))
          continue
        }
        break
      }

      const combinedItems: Array<Promise<Block | Transaction>> = [
        ...nextBlocks,
        ...nextTransactions
      ]

      const items = await Promise.all(combinedItems)

      items.forEach((item) => {
        if (item.type === 'b') {
          // Block
          if (item.block === null) {
            // Error while downloading. Lets try again
            this.addBlock(item.blockNumber)
            return
          }
          // Nice block - add to db processing queue
          this.sync.addBlock(item.block)
          totalBlocks += 1
        } else {
          if (item.transaction === null) {
            // Error while downloading. Lets try again
            this.addTransaction(item.transactionHash)
            return
          }
          // Nice transaction - add to db processing queue
          this.sync.addTransaction(item.transaction)
          totalTransactions += 1
        }
      })
      await sleep(500)
    }
    this.downloadRunning = false
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

  testTransaction = async (hash: string) => {
    const gt = await this.web3.eth.getTransaction(hash)
    const gtr = await this.web3.eth.getTransactionReceipt(hash)

    this.logger.log(gt, gtr)

    // "{"blockHash":"0xfc0c9b5eeb67c2914fe73852d14431ef00c27fc48d7e60452138e2d47aebbcd4","blockNumber":147064,"from":"0x16644332bB8F5f2229C6825285958a13CBf127E7","gas":628318,"gasPrice":"50000000000","hash":"0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d","input":"0x","nonce":0,"to":null,"transactionIndex":0,"value":"10000000000000000","v":"0x1b","r":"0xa1f6e3dfb12744c85aa9fdc9d0ec0574d9ff09090cb05044ce9b59c4e8c5fc54","s":"0x584034a2eadfcd6bba6bd519121a49aa23d66d5240617158d821a1259862666d"}"
    // "{"blockHash":"0xfc0c9b5eeb67c2914fe73852d14431ef00c27fc48d7e60452138e2d47aebbcd4","blockNumber":147064,"contractAddress":"0xF96023111267D540396CA5c4161b3846375C3b73","cumulativeGasUsed":21000,"from":"0x16644332bb8f5f2229c6825285958a13cbf127e7","gasUsed":21000,"logs":[],"logsBloom":"0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","root":"0x978ddff5b368de77f6bdccd6855cb80025b18d25998be13b16d77995217799e2","to":null,"transactionHash":"0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d","transactionIndex":0}"
    //0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d
  }
}
