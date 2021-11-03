const exchangerequest = (sequelize, DataTypes) => {
    const Exchangerequest = sequelize.define('tbl_exchangerequest', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        partner_id: {
            type: DataTypes.STRING
        },
        from: {
            type: DataTypes.STRING
        },
        request: {
            type: DataTypes.STRING
        },
        to: {
            type: DataTypes.STRING
        },
        target: {
            type: DataTypes.STRING
        }
    });

    return Exchangerequest;
};

module.exports = exchangerequest;