module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'accounts',
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      account: {
        type: DataTypes.DOUBLE,
        allowNull: false
      }
    },
    {
      tableName: 'accounts',
      timestamps: false
    }
  )
}
