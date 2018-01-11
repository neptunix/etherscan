// @flow

import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'

const Op = Sequelize.Op
const basename = path.basename(__filename)
const env = process.env.NODE_ENV || 'development'
const db = {}
const config = {
  username: 'postgres',
  password: 'etherscan-etherscan-etherscan',
  database: 'etherscan',
  host: '127.0.0.1',
  port: 18401,
  dialect: 'postgres',
  operatorsAliases: Op,
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
}

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
)

db.accounts = sequelize.import('accounts')
db.blocks = sequelize.import('blocks')
db.settings = sequelize.import('settings')
db.transactions = sequelize.import('transactions')

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

db.sequelize = sequelize
db.Sequelize = Sequelize

const accounts = db.accounts
const blocks = db.blocks
const settings = db.settings
const transactions = db.transactions

export default db
export { accounts, blocks, settings, transactions }
