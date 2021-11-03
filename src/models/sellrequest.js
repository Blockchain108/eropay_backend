module.exports = (sequelize, DataTypes) => {
  return sequelize.define('tbl_sellrequests', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    partner_id: {
      type: DataTypes.STRING
    },
    crypto: {
      type: DataTypes.STRING
    },
    issuer: {
      type: DataTypes.STRING
    },
    receiver: {
      type: DataTypes.STRING
    },
    fiat: {
      type: DataTypes.STRING
    },
    cryptoamount: {
      type: DataTypes.STRING
    },
    fiatamount: {
      type: DataTypes.STRING
    },
    priceterms: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending'
    }
  });
};