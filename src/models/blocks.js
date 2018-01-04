module.exports = (sequelize, DataTypes) => {
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
      }
    },
    {
      tableName: 'blocks'
    }
  )
}
