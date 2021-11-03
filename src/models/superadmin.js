module.exports = (sequelize, DataTypes) => {
  return sequelize.define('tbl_superadmins', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    firstname: {
      type: DataTypes.STRING
    },
    lastname: {
      type: DataTypes.STRING
    },
    email: {
      type: DataTypes.STRING
    },
    password: {
      type: DataTypes.STRING
    }
  },{
    timestamps : false,
    freezeTableName: true
  });
};