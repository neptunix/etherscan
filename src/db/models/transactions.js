// @flow
import Sequelize from 'sequelize'

export default (sequelize: Sequelize, DataTypes) => {
  return sequelize.define(
    'transactions',
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      transaction_hash: {
        type: DataTypes.DOUBLE,
        allowNull: false
      },
      from_account: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id'
        }
      },
      to_account: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id'
        }
      },
      block_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'blocks',
          key: 'id'
        }
      },
      gas_limit: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      gas_used: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      tx_status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        default: true
      },
      wei: {
        type: DataTypes.DOUBLE,
        allowNull: false
      }
    },
    {
      tableName: 'transactions',
      timestamps: false
    }
  )
}
