// @flow
import Sequelize from 'sequelize'

export default (sequelize: Sequelize, DataTypes) => {
  return sequelize.define(
    'settings',
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      latest_block: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '0'
      }
    },
    {
      tableName: 'settings',
      timestamps: false
    }
  )
}
