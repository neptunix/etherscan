// @flow
import Sequelize from 'sequelize'

export default (sequelize: Sequelize, DataTypes) => {
  return sequelize.define(
    'blocks',
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      date: {
        type: DataTypes.DATE,
        allowNull: false
      },
      transactions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '0'
      }
    },
    {
      tableName: 'blocks',
      timestamps: false
    }
  )
}
