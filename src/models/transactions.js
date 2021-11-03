const Sequelize = require('sequelize');
const transactions = (sequelize, DataTypes) => {
    const Transactions = sequelize.define('tbl_transactions', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        w_sender: {
            type: DataTypes.STRING
        },
        w_receiver: {
            type: DataTypes.STRING
        },
        amount: {
            type: DataTypes.STRING
        },
        // asset_code: {
        //     type: DataTypes.STRING
        // },
        // asset_issuer: {
        //     type: DataTypes.STRING
        // },
        form: {
            type: DataTypes.STRING
        },
        currency: {
            type: DataTypes.STRING
        }
    });

    Transactions.getById = async (walletid) => {
        var Op = Sequelize.Op;
        let t_history = await Transactions.findAll({ where : {
            [Op.or]: [
                { w_sender: walletid },
                { w_receiver: walletid }
            ]
        }})
        return t_history;
    }

    return Transactions;
};

module.exports = transactions;