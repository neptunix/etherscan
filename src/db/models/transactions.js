module.exports = (sequelize, DataTypes) => {
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
