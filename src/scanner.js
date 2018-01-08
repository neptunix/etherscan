// @flow
import Web3 from 'web3'
import DB from './db'
import { executeAllPromises, sleep } from './utils'
import Logger from './logger'
import SyncQueue from './syncQueue'

import { type Block, type BlockHeader, type Transaction } from './types'

const maxFetchConnections = 10
const maxQueueLength = 100
const maxSyncQueueLength = 200

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
  synq: SyncQueue
  blocksQueue: Array<number>
  transactionsQueue: Array<string>
  currentConnections: number

  constructor(apiUrl: string, logLevel: number) {
    this.logger = new Logger(logLevel)
    this.web3 = new Web3(new Web3.providers.HttpProvider(apiUrl))
    this.logger.log(`Creating new Web3 instance with URL ${apiUrl}`)
    this.db = new DB(logLevel)
    this.synq = new SyncQueue(this.db, this.logger, this.web3)

    this.blocksQueue = []
    this.transactionsQueue = []
    this.currentConnections = 0
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
    }
  }

  addTransaction = (transaction: string) => {
    if (!this.transactionExists(transaction)) {
      this.transactionsQueue.push(transaction)
    }
  }

  getBlock = async (block: number): Promise<Response> => {
    try {
      //this.logger.debug(`Fetching Block ${block}`)
      this.currentConnections += 1
      const blockResult = await this.web3.eth.getBlock(block)
      //this.logger.debug(`Block received`, block)
      if (!blockResult || !blockResult.transactions) {
        this.logger.warn('Scanner[getBlock]: received empty block data')
        return { type: 'b', block: null, blockNumber: block }
      }

      blockResult.transactions.forEach((transaction) => {
        this.addTransaction(transaction)
      })
      this.currentConnections -= 1
      return { type: 'b', block: blockResult, blockNumber: block }
    } catch (err) {
      this.logger.warn('Scanner[getBlock]', err)
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
          'Scanner[getTransaction]: received empty transaction data'
        )
        return { type: 't', transaction: null, transactionHash: hash }
      }
      return {
        type: 't',
        transaction: transactionResult,
        transactionHash: hash
      }
    } catch (err) {
      this.logger.warn('Scanner[getTransaction]', err)
      this.currentConnections -= 1
      return { type: 't', transaction: null, transactionHash: hash }
    }
  }

  runSync = async (nextBlocks: number) => {
    const latestBlock = this.db.getLatestBlock()

    this.logger.log(
      `Starting blocks synq for next ${nextBlocks} blocks. Latest blocks ${latestBlock}`
    )

    let currentBlock = latestBlock + 1
    let isStopping = false

    while (true) {
      console.debug(
        `runSync loop. Blocks: ${this.synq.blocksLength()} transactions: ${this.synq.transactionsLength()}`
      )

      if (currentBlock >= latestBlock + nextBlocks) {
        if (isStopping === false) {
          console.log(
            'Stopped blocks processing queue. Waiting for queue to empty'
          )
          isStopping = true
        }
        console.log(
          `Scanner db queue. blocks: ${this.synq.blocksLength()} transactions: ${this.synq.transactionsLength()}`
        )
        if (
          this.synq.blocksLength() > 0 ||
          this.synq.transactionsLength() > 0
        ) {
          continue
        }
      }

      // If SynqQueue is longer than expected, stop fetching blocks
      if (
        this.synq.blocksLength() + this.synq.transactionsLength() >
        maxSyncQueueLength
      ) {
        console.log('Synq Queue is too long. Waiting...')
        await sleep(2000)
        continue
      }

      const addToQueue = Math.min(maxQueueLength, currentBlock + nextBlocks)
      if (this.blocksLength() < addToQueue) {
        for (let b = this.blocksLength(); b < addToQueue; b++) {
          this.addBlock(currentBlock++)
        }
      }
      await sleep(1000, 'runSync')
    }
  }

  downloadProcessor = async () => {
    this.logger.log('Starting download processor')
    while (true) {
      if (this.blocksLength() === 0 && this.transactionsLength() === 0) {
        this.logger.debug('Download processor: empty queue')
        await sleep(1000, 'downloadProcessor')
        continue
      }

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
          this.synq.addBlock(item.block)
        } else {
          if (item.transaction === null) {
            // Error while downloading. Lets try again
            this.addTransaction(item.transactionHash)
            return
          }
          // Nice transaction - add to db processing queue
          this.synq.addTransaction(item.transaction)
        }
      })
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

  testTransaction = async (hash: string) => {
    const gt = await this.web3.eth.getTransaction(hash)
    const gtr = await this.web3.eth.getTransactionReceipt(hash)

    this.logger.log(gt, gtr)

    // "{"blockHash":"0xfc0c9b5eeb67c2914fe73852d14431ef00c27fc48d7e60452138e2d47aebbcd4","blockNumber":147064,"from":"0x16644332bB8F5f2229C6825285958a13CBf127E7","gas":628318,"gasPrice":"50000000000","hash":"0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d","input":"0x","nonce":0,"to":null,"transactionIndex":0,"value":"10000000000000000","v":"0x1b","r":"0xa1f6e3dfb12744c85aa9fdc9d0ec0574d9ff09090cb05044ce9b59c4e8c5fc54","s":"0x584034a2eadfcd6bba6bd519121a49aa23d66d5240617158d821a1259862666d"}"
    // "{"blockHash":"0xfc0c9b5eeb67c2914fe73852d14431ef00c27fc48d7e60452138e2d47aebbcd4","blockNumber":147064,"contractAddress":"0xF96023111267D540396CA5c4161b3846375C3b73","cumulativeGasUsed":21000,"from":"0x16644332bb8f5f2229c6825285958a13cbf127e7","gasUsed":21000,"logs":[],"logsBloom":"0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","root":"0x978ddff5b368de77f6bdccd6855cb80025b18d25998be13b16d77995217799e2","to":null,"transactionHash":"0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d","transactionIndex":0}"
    //0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d
  }
}
