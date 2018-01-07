// @flow
import DB from './db'
import Scanner from './scanner'

const rpcApi = 'https://mainnet.infura.io/Oxgvoj8dFruRa6YCekfU' // Mainnet

async function run() {
  const scanner = new Scanner(rpcApi, 3)

  await scanner.init()
  //let res = await scanner.getBalance(
  //  '0x32BE343B94F860124DC4FEE278FDCBD38C102D88'
  //)
  //console.log('getbalance', res)
  //await scanner.testTransaction(
  //  '0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d'
  //)

  //await scanner.processBlocks(147201, 147300)
  await scanner.runSync(1000)
  //checkTransactionCount(145011, 145012)
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
