// @flow
import models from './models'
const blocks = models.blocks
const accounts = models.accounts
const transactions = models.transactions

export default class DB {
  static createBlock = async (id: number, date: Date, transactions: number) => {
    try {
      const result = await blocks.create(
        { id, date, transactions },
        { returning: false }
      )
      //console.log(result)
    } catch (error) {
      console.error('Block create error', error.message)
    }
  }

  static createAccount = async (account: string) => {
    try {
      const result = await accounts.findOrCreate({ where: { account } })
      console.log('createAccount result', result)
      //return Promise.resolve(result)
      return result[0]
    } catch (error) {
      console.error('Account create error', error.message)
    }
  }

  /*
 .findOrCreate({where: {username: 'sdepold'}, defaults: {job: 'Technical Lead JavaScript'}})
  .spread((user, created) => {
    console.log(user.get({
      plain: true
    }))
    console.log(created)
  */

  static createTransaction = async (
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
      console.log(result)
    } catch (error) {
      console.error('Transaction create error', error.message)
    }
  }
}
