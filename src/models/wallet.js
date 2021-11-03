const wallets = (sequelize, DataTypes) => {
    const Wallets = sequelize.define('tbl_wallets', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        partner_id: {
            type: DataTypes.STRING
        },
        walletname: {
            type: DataTypes.STRING
        },
        federationAddress: {
            type: DataTypes.STRING
        },
        public_key: {
            type: DataTypes.STRING
        },
        keystore: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.BOOLEAN
        },
        use: {
            type: DataTypes.BOOLEAN
        },
    });

    Wallets.Usewallet = async (parentid) => {
        let wallet = await Wallets.findOne({
            where: { partner_id: parentid, use: 1 }
        });
        return wallet;
    }

    return Wallets;
};
  
module.exports = wallets;