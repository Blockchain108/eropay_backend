const withdrawrequest = (sequelize, DataTypes) => {
    const Withdrawrequest = sequelize.define('tbl_withdrawrequest', {
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
        address: {
            type: DataTypes.STRING
        },
        iban: {
            type: DataTypes.STRING
        },
        amount: {
            type: DataTypes.STRING
        },
        currency: {
            type: DataTypes.STRING
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'pending'
        },
    });

    return Withdrawrequest;
};

module.exports = withdrawrequest;