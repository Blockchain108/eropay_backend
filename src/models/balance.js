const balance = (sequelize, DataTypes) => {
  const Balance = sequelize.define('tbl_balances', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    partner_id: {
      type: DataTypes.STRING
    },
    type: {
      type: DataTypes.STRING
    },
    amount: {
      type: DataTypes.STRING
    }
  },{
    timestamps : false,
    freezeTableName: true
  });

  return Balance;
};

module.exports = balance;  