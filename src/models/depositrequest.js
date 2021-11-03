const depositrequest = (sequelize, DataTypes) => {
    const Depositrequest = sequelize.define('tbl_depositrequest', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        partner_id: {
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

    return Depositrequest;
};

module.exports = depositrequest;