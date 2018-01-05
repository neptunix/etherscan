// @flow
import DB from './db'

const rpcApi = 'https://mainnet.infura.io/Oxgvoj8dFruRa6YCekfU' // Mainnet

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(rpcApi))

const executeAllPromises = (promises) => {
  // Wrap all Promises in a Promise that will always "resolve"
  var resolvingPromises = promises.map(function(promise) {
    return new Promise(function(resolve) {
      var payload = new Array(2)
      promise
        .then(function(result) {
          payload[0] = result
        })
        .catch(function(error) {
          payload[1] = error
        })
        .then(function() {
          /* 
           * The wrapped Promise returns an array:
           * The first position in the array holds the result (if any)
           * The second position in the array holds the error (if any)
           */
          resolve(payload)
        })
    })
  })

  var errors = []
  var results = []

  // Execute all wrapped Promises
  return Promise.all(resolvingPromises).then(function(items) {
    items.forEach(function(payload) {
      if (payload[1]) {
        errors.push(payload[1])
      } else {
        results.push(payload[0])
      }
    })

    return {
      errors: errors,
      results: results
    }
  })
}

async function checkTransactionCount(startBlockNumber, endBlockNumber) {
  console.log(
    'Searching for non-zero transaction counts between blocks ' +
      startBlockNumber +
      ' and ' +
      endBlockNumber
  )

  let blocks = []

  for (let i = startBlockNumber; i <= endBlockNumber; i++) {
    console.log(`Getting block ${i}`)
    blocks.push(web3.eth.getBlock(i))
  }

  try {
    const items = await executeAllPromises(blocks) //Promise.all(blocks)
    console.error(
      items.errors
        .map(function(error) {
          return error.message
        })
        .join(',')
    )

    items.results.forEach(async (block) => {
      if (block != null) {
        if (block.transactions != null && block.transactions.length != 0) {
          console.log(
            `Block #${block.number} Date: ${new Date(
              block.timestamp * 1000
            ).toString()} Transactions: ${block.transactions.length}`
          )
          DB.createBlock(
            block.number,
            new Date(block.timestamp * 1000),
            block.transactions.length
          )
          // Read transactions
          if (block.transactions.length > 0) {
            let transactions = []
            block.transactions.forEach((transaction) => {
              console.log(`Getting transaction info ${transaction}`)
              transactions.push(web3.eth.getTransaction(transaction))
            })
            const transactItems = await executeAllPromises(transactions)
            transactItems.results.forEach(async (transaction) => {
              if (transaction === null) {
                return
              }
              const from = await DB.createAccount(
                web3.utils.hexToNumberString(transaction.from)
              )
              const to = await DB.createAccount(
                web3.utils.hexToNumberString(transaction.to)
              )
              DB.createTransaction(
                web3.utils.hexToNumberString(transaction.hash),
                from.id,
                to.id,
                block.number,
                transaction.value
              )
            })

            console.error(
              transactItems.errors
                .map(function(error) {
                  return error.message
                })
                .join(',')
            )
          }
          //console.log('Debug: ' + JSON.stringify(block))
        }
      }
    })
  } catch (err) {
    console.log('Promise error', err)
  }
}

async function run() {
  console.log(`web3.version: ${web3.version}`)
  console.log(
    `balance: ${await web3.eth.getBalance(
      '0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98'
    )}`
  )

  checkTransactionCount(145011, 145012)
}

run()

/*

> eth.getTransaction(eth.getBlock("latest").transactions[1])
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
