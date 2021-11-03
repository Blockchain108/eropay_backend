const beneficiaries = (sequelize, DataTypes) => {
    const Beneficiaries = sequelize.define('tbl_beneficiaries', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        partner_id: {
            type: DataTypes.STRING
        },
        beneficiary_id: {
            type: DataTypes.STRING
        },
    },{
        timestamps : false,
        freezeTableName: true
      });

    return Beneficiaries;
};

module.exports = beneficiaries;  