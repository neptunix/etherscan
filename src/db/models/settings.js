// @flow

export default (sequelize, DataTypes) => {
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
