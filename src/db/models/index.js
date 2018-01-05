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
  logging: false
}

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
)

fs
  .readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js'
    )
  })
  .forEach((file) => {
    const model = sequelize['import'](path.join(__dirname, file))
    db[model.name] = model
  })

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

db.sequelize = sequelize
db.Sequelize = Sequelize

module.exports = db
