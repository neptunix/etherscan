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
  console.log(await scanner.getBlock(1450000))
  //console.log('getbalance', res)
  //await scanner.testTransaction(
  //  '0x2385153b0d268f62ea44148f7d52f4fb1b664a047c854007b40b44d2bf89f44d'
  //)

  //await scanner.processBlocks(147201, 147300)
  //await scanner.runSync(1000)
  //checkTransactionCount(145011, 145012)
}

run()
