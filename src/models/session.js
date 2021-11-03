const session = (sequelize, DataTypes) => {
    const Session = sequelize.define('tbl_sessions', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        userid: {
            type: DataTypes.STRING
        },
        token: {
            type: DataTypes.STRING
        },
        verify_status: {
            type: DataTypes.BOOLEAN
        },
        expire_time: {
            type: DataTypes.STRING
        }
    },{
        timestamps : false,
        freezeTableName: true
      });

    Session.findByUserid = async (userid) => {
        let session = await Session.findOne({
            where: { userid: userid },
        });

        return session;
    };

    return Session;
};

module.exports = session;