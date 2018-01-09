// @flow

import Web3 from 'web3'
import { type Block, type BlockHeader, type Transaction } from './types'
import { sleep } from './utils'
import DB from './db'
import Logger from './logger'

const maxRetryCount = 3

type TransactionData = {
  transaction: Transaction,
  from: number,
  to: number,
  retryCount: number
}

type BlockData = {
  block: Block,
  retryCount: number
}

type CreateBlockResult = {
  result: boolean,
  type: 'b',
  blockNumber: number,
  blockData: null | BlockData
}

type CreateTransactionResult = {
  result: boolean,
  type: 't',
  transactionData: null | TransactionData
}

export default class SyncQueue {
  db: DB
  dbhelper: DbHelper
  logger: Logger
  web3: Web3
  blocksQueue: Array<BlockData>
  transactionsQueue: Array<TransactionData>
  running: boolean
  maxConnections: number
  currentConnections: number
  latestBlock: number
  failedBlocks: number
  failedTransactions: number
  totalBlocks: number
  totalTransactions: number

  constructor(db: DB, logger: Logger, web3: Web3) {
    this.db = db
    this.dbhelper = new DbHelper(db, logger, web3)
    this.logger = logger
    this.web3 = web3
    this.blocksQueue = []
    this.transactionsQueue = []
    this.running = false
    this.maxConnections = 400
    this.currentConnections = 0
    this.latestBlock = 0

    this.failedBlocks = 0
    this.failedTransactions = 0
    this.totalBlocks = 0
    this.totalTransactions = 0
  }

  start = async () => {
    if (this.running) {
      return
    }
    //    console.log(`Restarting SyncQueue ... `)
    this.failedBlocks = 0
    this.failedTransactions = 0
    this.totalBlocks = 0
    this.totalTransactions = 0

    const t1 = process.hrtime()
    this.running = true

    while (true) {
      if (this.transactionsLength() === 0 && this.blocksLength() === 0) {
        const t2 = process.hrtime(t1)
        const diff = (t2[0] * 1e9 + t2[1]) / 1e6
        console.log(
          `
  DB SyncQueue is empty. Latest block: ${
    this.latestBlock
  }. Time ${diff}ms (B+T/sec: ${this.totalBlocks +
            this.totalTransactions / diff * 1000}) Total blocks/trans: ${
            this.totalBlocks
          }/${this.totalTransactions}. Failed blocks/trans ${
            this.failedBlocks
          }/${this.failedTransactions}
          `
        )
        await this.db.updateSettings({ latest_block: this.latestBlock })

        break
      }

      console.log(
        `SyncQueue length => blocks: ${this.blocksLength()}, transactions: ${this.transactionsLength()}`
      )

      let nextBlocks: Array<Promise<CreateBlockResult>> = []
      let nextTransactions: Array<Promise<CreateTransactionResult>> = []

      for (let i = this.currentConnections; i < this.maxConnections; i++) {
        const nextBlock = this.nextBlock()
        if (nextBlock !== null) {
          nextBlocks.push(this.dbhelper.createBlock(nextBlock))
          continue
        }
        const nextTransaction = this.nextTransaction()
        if (nextTransaction !== null) {
          nextTransactions.push(
            this.dbhelper.createTransaction(nextTransaction)
          )
          continue
        }
        break
      }

      try {
        const combinedItems: Array<
          Promise<CreateBlockResult | CreateTransactionResult>
        > = [...nextBlocks, ...nextTransactions]

        // Lets execute all DB actions. Should never get reject on errors (unless problems in code)
        const items = await Promise.all(combinedItems)

        // Process results
        items.forEach((item) => {
          if (item.type === 'b') {
            // Block
            if (!item.result && item.blockData) {
              if (item.blockData.retryCount < maxRetryCount) {
                // Block processing error. Will try again
                this.addBlockData(item.blockData)
              } else {
                this.failedBlocks += 1
              }
              return
            }
            this.totalBlocks += 1
            if (item.blockNumber > this.latestBlock) {
              this.latestBlock = item.blockNumber
            }
          } else {
            // Transaction
            if (!item.result && item.transactionData) {
              if (item.transactionData.retryCount < maxRetryCount) {
                // Transaction processing error. Will try again
                this.addTransactionData(item.transactionData)
              } else {
                this.failedTransactions += 1
              }
              return
            }
            this.totalTransactions += 1
          }
        })
      } catch (err) {
        this.logger.error('Promise processBlocks error', err)
      }
      //await sleep(1000)
    }
    this.running = false
  }

  checkRunning = () => {
    if (!this.running) {
      this.start()
    }
  }

  blocksLength = () => this.blocksQueue.length
  transactionsLength = () => this.transactionsQueue.length

  addBlock = (block: Block) => {
    if (block !== null) {
      //this.logger.debug(`SyncQueue: Adding block ${block.number}`)
      this.blocksQueue.push({
        type: 'b',
        blockNumber: block.number,
        block: block,
        retryCount: 0
      })
      this.checkRunning()
    }
  }

  addBlockData = (blockData: BlockData) => {
    if (blockData !== null) {
      this.blocksQueue.push(blockData)
      this.checkRunning()
    }
  }

  addTransaction = (transaction: Transaction) => {
    if (transaction !== null) {
      //this.logger.debug(`SyncQueue: Adding transaction ${transaction.hash}`)
      this.transactionsQueue.push({
        type: 't',
        transaction,
        from: -1,
        to: -1,
        retryCount: 0
      })
      this.checkRunning()
    }
  }

  addTransactionData = (transactionData: TransactionData) => {
    if (transactionData !== null) {
      this.transactionsQueue.push(transactionData)
      this.checkRunning()
    }
  }

  hasBlock = (id: number) => !!this.blocksQueue.find((b) => b.block.id === id)
  hasTransaction = (hash: string) =>
    !!this.transactionsQueue.find((t) => t.transaction.hash === hash)

  nextBlock = (): BlockData | null =>
    this.blocksLength() > 0 ? this.blocksQueue.shift() : null
  nextTransaction = (): TransactionData | null =>
    this.transactionsLength() > 0 ? this.transactionsQueue.shift() : null
}

class DbHelper {
  db: DB
  logger: Logger
  web3: Web3
  constructor(db: DB, logger: Logger, web3: Web3) {
    this.db = db
    this.web3 = web3
    this.logger = logger
  }
  createBlock = async (blockData: BlockData): Promise<CreateBlockResult> => {
    const createResult = await this.db.createBlock(
      blockData.block.number,
      new Date(blockData.block.timestamp * 1000),
      blockData.block.transactions.length
    )
    if (!createResult.result) {
      this.logger.error(createResult.message)
    }
    return {
      result: createResult.result,
      type: 'b',
      blockNumber: blockData.block.number,
      blockData: createResult.result
        ? null
        : {
            block: blockData.block,
            retryCount: blockData.retryCount + 1
          }
    }
  }

  createTransaction = async (
    transactionData: TransactionData
  ): Promise<CreateTransactionResult> => {
    let from = transactionData.from
    let to = transactionData.to

    // Создаем или вытаскиваем данные аккаунта из базы (from)
    if (transactionData.from === -1) {
      const fromResult = await this.db.createAccount(
        this.web3.utils.hexToNumberString(transactionData.transaction.from)
      )
      if (!fromResult.result) {
        this.logger.error(fromResult.message)
        return {
          result: false,
          type: 't',
          transactionData
        }
      }
      if (fromResult.data !== null && fromResult.data.id > 0) {
        from = fromResult.data.id
      }
    }

    // Создаем или вытаскиваем данные аккаунта из базы (to)
    if (transactionData.to === -1) {
      const toResult = await this.db.createAccount(
        this.web3.utils.hexToNumberString(
          transactionData.transaction.to === null
            ? '0x00' // transaction.to is null for Smart Contract creation. TODO: should call getTransactionReceipt to get contract hash
            : transactionData.transaction.to
        )
      )
      if (!toResult.result) {
        this.logger.error(toResult.message)
        return {
          result: false,
          type: 't',
          transactionData
        }
      }
      if (toResult.data !== null && toResult.data.id > 0) {
        to = toResult.data.id
      }
    }

    const createResult = await this.db.createTransaction(
      this.web3.utils.hexToNumberString(transactionData.transaction.hash),
      from,
      to,
      transactionData.transaction.blockNumber,
      transactionData.transaction.value
    )
    if (!createResult.result) {
      this.logger.error(createResult.message)
    }
    return {
      result: createResult.result,
      type: 't',
      transactionData: createResult.result
        ? null
        : {
            transaction: transactionData.transaction,
            from: from,
            to: to,
            retryCount: transactionData.retryCount + 1
          }
    }
  }
}

/*
eth.getBlock(1450000)
{ difficulty: '34037275555832',
  extraData: '0xd783010400844765746887676f312e352e31856c696e7578',
  gasLimit: 4712388,
  gasUsed: 21000,
  hash: '0x642fc6d15875a143628c9ccd9e95202256a403f179375fa8fc7441463dc76aef',
  logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  miner: '0x4Bb96091Ee9D802ED039C4D1a5f6216F90f81B01',
  mixHash: '0xaf5d545274d65770d6f0f6b04af288b9d08148dc45a5645c7ee8d96525950fa5',
  nonce: '0xf5a5e93aa0dc1452',
  number: 1450000,
  parentHash: '0x09b3172b2f03deedd9189a560e4fa0f7cc7b96bac729c8c5372d6a2e2201ac99',
  receiptsRoot: '0xb4a29367ab524ad7eda062f063ad61ed75a20763c608b89d1087884364c05961',
  sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
  size: 658,
  stateRoot: '0x65e2db91de7ccfd3cb18ef3d3e61109adb9b499e5f5d87c8fc421c36404a0c6d',
  timestamp: 1462285256,
  totalDifficulty: '17157058370454415782',
  transactions:
   [ '0xa5e607859a6a0afdec9e4e6b029081920ea7f10044f2a25f49c7b5197bd08be5' ],
  transactionsRoot: '0x356a42adad0954de05b4ea4640877cada94df50e728706492cfb2fd12f81e1a2',
  uncles: [] }

> eth.getTransaction('0x6ef5b459ed945fbabfc3a5ef34fb0087752002c319649ff44c3b2759d13a517d')
{
  blockHash: "0x425a4d04ac0185863266b0d1b000f579f9675a37c5c6df3bf3cf72e0bc9a94e7",
  blockNumber: 1701040,
  from: "0x81747eb1afd9e2670aa6883ed80973ffcb531e1f",
  gas: 666666,
  gasPrice: 20000000000,
  hash: "0x6ef5b459ed945fbabfc3a5ef34fb0087752002c319649ff44c3b2759d13a517d",
  input: "0xf04fd2f3000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000001e0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  nonce: 16,
  to: "0x2cac6e4b11d6b58f6d3c1c9d5fe8faa89f60e5a2",
  transactionIndex: 1,
  value: 0
}

*/
