const serverConfig = require('../config');

module.exports = (sequelize, DataTypes) => {
    const Users = sequelize.define('tbl_users', {
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
        phone: {
            type: DataTypes.STRING
        },
        photo: {
            type: DataTypes.STRING,
            defaultValue: serverConfig.SERVER_URL + '/image/default.jpg'
        },
        qr_secret: {
            type: DataTypes.STRING
        },
        kyc_status: {
            type: DataTypes.BOOLEAN
        },
        kyb_status: {
            type: DataTypes.BOOLEAN
        },
        role: {
            type: DataTypes.INTEGER,
            defaultValue: '2'
        },
        password: {
            type: DataTypes.STRING
        }
    });

    Users.findByUserid = async (userid) => {
        let user = await Users.findOne({
            where: { id: userid },
        });
        delete user.password;
        return user;
    };

    return Users;
};