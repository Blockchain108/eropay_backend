const { Router } = require('express');
const router = Router();
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { socketdata } = require('../config');

const SERVER_URL = process.env.dev == "true" ? process.env.DEV_SERVER_URL : process.env.SERVER_URL;

const Sequelize = require('sequelize');

var sequelizex = new Sequelize(
    process.env.DATABASE,
    process.env.DATABASE_USER,
    process.env.DATABASE_PASSWORD,
    {
      host: process.env.DATABASE_HOST,
      dialect: 'mysql',
      port: process.env.DATABASE_PORT
    },
);

router.post('/check', async (req, res, next) => {
    var request_data = req.body.data;
    // res.send({status: true, })
    res.status(200).json({data: "success"});
    return next();
});

router.post('/depositsget', (req, res, next) => {
    sequelizex.query(`SELECT de.id, de.partner_id, us.firstname, us.email, de.iban, de.amount, de.currency, de.status, de.createdAt, de.updatedAt FROM tbl_depositrequests AS de LEFT JOIN tbl_wallets AS wa ON de.partner_id = wa.id LEFT JOIN tbl_users AS us ON wa.partner_id = us.id WHERE wa.id=9;`, { type: sequelizex.QueryTypes.SELECT}).then(depositdata => {
        res.send({status:true, result: depositdata});
        return next();
    })
    .catch(err => {
        res.send({status:false, result: []});
    })
});

router.post('/d_change', async (req, res, next) => {
    let re_data = req.body.data;
    if(re_data.status == "completed") {
        let wallet = await req.context.models.Wallets.findOne({where: { id:re_data.partner_id }});
        req.context.models.Balance.findOne({where: { partner_id:wallet.id, type: re_data.currency }})
        .then(balances => {
            balances.update({
                amount: parseFloat(balances.amount) + parseFloat(re_data.amount)
            })
            .then(() => {
                req.context.models.Depositrequest.findOne({ where : { id:re_data.id } })
                .then(depositdata => {
                    depositdata.update({
                        status: re_data.status
                    })
                    .then(() => {
                        req.context.models.Transactions.create({
                            w_sender: '000',
                            w_receiver: re_data.partner_id,
                            amount:re_data.amount,
                            form: "Deposit",
                            currency: re_data.currency
                        }).then(() => {
                            let socketinfo = socketdata.info.filter(item => item.userid == re_data.partner_id);
                            if(socketinfo.length > 0) {
                                socketinfo.filter(function (e) {
                                    e.socket.emit('getDepositdone', true);
                                })
                            }
                            res.send({status:true, result: "Success!"});
                        }).catch(err => {
                            res.send({status:false, result: "Something went wrong!"});
                        })
                    })
                    .catch(err => {
                        res.send({status:false, result: "Something went wrong!"});
                    })
                })
                .catch(err => {
                    res.send({status:false, result: "Something went wrong!"});
                })
            })
        })
        .catch(err => {
            res.send({status: false, result: "Something went wrong."});
        })
    } else if(re_data.status == "failed") {
        req.context.models.Depositrequest.findOne({ where : { id:re_data.id } })
        .then(depositdata => {
            depositdata.update({
                status: re_data.status
            })
            .then(() => {
                let socketinfo = socketdata.info.filter(item => item.userid == re_data.partner_id);
                if(socketinfo.length > 0) {
                    socketinfo.filter(function (e) {
                        e.socket.emit('getDepositdone', false);
                    })
                }
                res.send({status:true, result: "Success!"});
            })
        })
        .catch(err => {
            res.send({status:false, result: "Something went wrong!"});
        })
    }
    
});

router.post('/withdrawget', (req, res, next) => {

    sequelizex.query(`SELECT wi.id, wi.partner_id, us.firstname, us.email, wi.iban, wi.amount, wi.currency, wi.status, wi.createdAt, wi.updatedAt FROM tbl_withdrawrequests AS wi LEFT JOIN tbl_wallets AS wa ON wi.partner_id = wa.id LEFT JOIN tbl_users AS us ON wa.partner_id = us.id WHERE wa.id=9;`, { type: sequelizex.QueryTypes.SELECT}).then(withdrawdata => {
        res.send({status:true, result: withdrawdata});
        return next();
    })
    .catch(err => {
        res.send({status:false, result: []});
    })
});

router.post('/w_change', async (req, res, next) => {
    let re_data = req.body.data;
    if(re_data.status == "completed") {
        req.context.models.Withdrawrequest.findOne({ where : { id:re_data.id } })
        .then( async (withdrawdata) => {
            withdrawdata.update({
                status: re_data.status
            })
            .then(() => {
                let socketinfo = socketdata.info.filter(item => item.userid == re_data.partner_id);
                if(socketinfo.length > 0) {
                    socketinfo.filter(function (e) {
                        e.socket.emit('getWithdrawdone', true);
                    })
                }
                res.send({status:true, result: "Success!"});
            })
            .catch(err => {
                res.send({status:false, result: "Something went wrong!"});
            })
        })
        .catch(err => {
            res.send({status:false, result: "Something went wrong!"});
        })
    } else if(re_data.status == "failed") {
        let wallet = await req.context.models.Wallets.findOne({where: { id:re_data.partner_id }});
        req.context.models.Balance.findOne({where: { partner_id:wallet.id, type: re_data.currency }})
        .then(balances => {
            balances.update({
                amount: parseFloat(balances.amount) + parseFloat(re_data.amount)
            })
            .then(() => {
                req.context.models.Withdrawrequest.findOne({ where : { id:re_data.id } })
                .then(withdrawdata => {
                    withdrawdata.update({
                        status: re_data.status
                    })
                    .then(() => {
                        req.context.models.Transactions.create({
                            w_sender: re_data.partner_id,
                            w_receiver: '000',
                            amount:re_data.amount,
                            form: "Withdraw Request Failed",
                            currency: re_data.currency
                        }).then(() => {
                            let socketinfo = socketdata.info.filter(item => item.userid == re_data.partner_id);
                            if(socketinfo.length > 0) {
                                socketinfo.filter(function (e) {
                                    e.socket.emit('getWithdrawdone', false);
                                })
                            }
                            res.send({status:true, result: "Success!"});
                        }).catch(err => {
                            res.send({status:false, result: "Something went wrong!"});
                        })
                    })
                })
                .catch(err => {
                    res.send({status:false, result: "Something went wrong!"});
                })
            })
        })
        .catch(err => {
            res.send({status: false, result: "Something went wrong."});
        })
    }
    
});

router.post('/getusers', async (req, res, next) => {
    let users = await req.context.models.Users.findAll(
        { attributes: ['id', 'firstname', 'lastname', 'email', 'phone'] },
        { where: { $not : { role: 1 } } });
    res.send({status: true, data: users});
    return next();
});

router.post('/buyget', async (req, res, next) => {

    let Users = req.context.models.Users;
    let Buyrequest = req.context.models.Buyrequest;

    Users.hasMany(Buyrequest, {foreignKey: 'id'});
    Buyrequest.belongsTo(Users, {foreignKey: 'partner_id'});

    Buyrequest.findAll({include: [Users]})
    .then(data => {
        res.send({status:true, result: data});
        return next();
    })
    .catch(err => {
        res.send({status:false, result: "Something went wrong!"});
    })

});

router.post('/b_change', (req, res, next) => {
    let re_data = req.body.data;
    if(re_data.status == "completed") {
        req.context.models.Buyrequest.findOne({where : {id : re_data.id}}).then(buyre => {
            let obj = {
                receiver : buyre.receiver,
                assetCode: buyre.crypto,
                assetIssuer: buyre.issuer,
                amount: buyre.cryptoamount,
                partner_id: buyre.partner_id,
                type: "buy"
            }    
            axios.post(SERVER_URL + '/stellar/transfer', obj)
            .then(transferresult => {
                if(transferresult.data.status == true) {
                    buyre.update({status: re_data.status}).then(() => {
                        let socketinfo = socketdata.info.filter(item => item.userid == re_data.partner_id);
                        if(socketinfo.length > 0) {
                            socketinfo.filter(function (e) {
                                e.socket.emit('getBuydone', true);
                            })
                        }
                        res.send({status:true, result: "Success!"});
                        return next();
                    }).catch(err => {
                        res.send({status: false, result: transferresult.data.result})
                    })
                } else {
                    res.send({status: false, result: transferresult.data.result})
                }
            })
            .catch(err => {
                res.send({status: false, result: "Something went wrong!"})
            })
        }).catch(err => {
            res.send({status: false, result: "Something went wrong!"})
        })
    } else if(re_data.status == "failed") {
        req.context.models.Buyrequest.findOne({where : {id : re_data.id}}).then(buyre => {
            req.context.models.Balance.findOne({where: { partner_id: buyre.partner_id, type: buyre.fiat }})
           .then(balances => {
               balances.update({
                   amount: parseFloat(balances.amount) + parseFloat(buyre.fiatamount)
               })
               .then(() => {
                    buyre.update({status: re_data.status}).then(() => {
                        req.context.models.Transactions.create({
                            w_sender: '000',
                            w_receiver: buyre.partner_id,
                            amount: buyre.fiatamount,
                            form: "Buy Request Failed",
                            currency: buyre.fiat
                        }).then(() => {})
                        .catch(err => {})
                        let socketinfo = socketdata.info.filter(item => item.userid == re_data.partner_id);
                        if(socketinfo.length > 0) {
                            socketinfo.filter(function (e) {
                                e.socket.emit('getBuydone', true);
                            })
                        }
                        res.send({status:true, result: "Success!"});
                        return next();
                    }).catch(err => {
                        res.send({status: false, result: transferresult.data.result})
                    })
               })
           })
           .catch(err => {
               res.send({status: false, result: "Something went wrong."});
           })
        }).catch(err => {
            res.send({status: false, result: "Something went wrong!"})
        })
    }
    
});

router.post('/deleteHistoryBuy', async (req, res, next) => {
    req.context.models.Users.destroy({where: { id : req.body.data }})
    .then(async () => {
        let Users = req.context.models.Users;
        let Buyrequest = req.context.models.Buyrequest;
    
        Users.hasMany(Buyrequest, {foreignKey: 'id'});
        Buyrequest.belongsTo(Users, {foreignKey: 'partner_id'});
    
        Buyrequest.findAll({include: [Users]})
        .then(buydata => {
            res.send({status:true, result: buydata});
            return next();
        })
        .catch(err => {
            res.send({status:false, result: "Something went wrong!"});
        })
    })
    .catch(err => {
        res.send({status: false, result: "Something went Wrong!"});
    })
});

router.post('/sellget', async (req, res, next) => {

    let Users = req.context.models.Users;
    let Sellrequest = req.context.models.Sellrequest;

    Users.hasMany(Sellrequest, {foreignKey: 'id'});
    Sellrequest.belongsTo(Users, {foreignKey: 'partner_id'});

    Sellrequest.findAll({include: [Users]})
    .then(data => {
        res.send({status:true, result: data});
        return next();
    })
    .catch(err => {
        res.send({status:false, result: "Something went wrong!"});
    })

});

// router.post('/s_change', (req, res, next) => {
//     let re_data = req.body.data;
//     if(re_data.status == "completed") {
//         req.context.models.Buyrequest.findOne({where : {id : re_data.id}}).then(buyre => {
//             let obj = {
//                 receiver : buyre.receiver,
//                 assetCode: buyre.crypto,
//                 assetIssuer: buyre.issuer,
//                 amount: buyre.cryptoamount,
//                 partner_id: buyre.partner_id,
//                 type: "buy"
//             }
    
//             axios.post(SERVER_URL + '/stellar/transfer', obj)
//             .then(transferresult => {
//                 if(transferresult.data.status == true) {
                    
//                     let socketinfo = socketdata.info.filter(item => item.userid == re_data.partner_id);
//                     if(socketinfo.length > 0) {
//                         socketinfo.filter(function (e) {
//                             e.socket.emit('getBuydone', true);
//                         })
//                     }
//                     res.send({status:true, result: "Success!"});
//                     return next();
                    
//                 } else {
//                     res.send({status: false, result: transferresult.data.result})
//                 }
//             })
//             .catch(err => {
//                 res.send({status: false, result: "Something went wrong!"})
//             })
//         }).catch(err => {
//             res.send({status: false, result: "Something went wrong!"})
//         })
//     } else if(re_data.status == "failed") {
//         req.context.models.Buyrequest.findOne({where : {id : re_data.id}}).then(buyre => {
//             req.context.models.Balance.findOne({where: { partner_id: buyre.partner_id, type: buyre.fiat }})
//            .then(balances => {
//                balances.update({
//                    amount: parseFloat(balances.amount) + parseFloat(buyre.fiatamount)
//                })
//                .then(() => {
//                     let socketinfo = socketdata.info.filter(item => item.userid == buyre.partner_id);
//                     if(socketinfo.length > 0) {
//                         socketinfo.filter(function (e) {
//                             e.socket.emit('getBuydone', false);
//                         })
//                     }
//                     res.send({status:true, result: "Success!"});
//                })
//            })
//            .catch(err => {
//                res.send({status: false, result: "Something went wrong."});
//            })
//         }).catch(err => {
//             res.send({status: false, result: "Something went wrong!"})
//         })
//     }
    
// });

// router.post('/deleteHistorySell', async (req, res, next) => {
//     req.context.models.Users.destroy({where: { id : req.body.data }})
//     .then(async () => {
//         let Users = req.context.models.Users;
//         let Buyrequest = req.context.models.Buyrequest;
    
//         Users.hasMany(Buyrequest, {foreignKey: 'id'});
//         Buyrequest.belongsTo(Users, {foreignKey: 'partner_id'});
    
//         Buyrequest.findAll({include: [Users]})
//         .then(buydata => {
//             res.send({status:true, result: buydata});
//             return next();
//         })
//         .catch(err => {
//             res.send({status:false, result: "Something went wrong!"});
//         })
//     })
//     .catch(err => {
//         res.send({status: false, result: "Something went Wrong!"});
//     })
// });

router.post('/deleteuser', async (req, res, next) => {
    req.context.models.Users.destroy({where: { id : req.body.data }})
    .then(async () => {
        let Users = await req.context.models.Users.findAll({attributes: ['id', 'firstname', 'lastname', 'email', 'phone', 'kyc_status', 'createdAt']});
        let Wallets = await req.context.models.Wallets.findAll({ attributes: ['partner_id', 'walletname', 'public_key'], where: { use : 1 }});
        res.send({status: true, result: {users: Users, wallets: Wallets}});
        return next();
    })
    .catch(err => {
        res.send({status: false, result: "Something went Wrong!"});
    })
});

router.post('/edituser', async (req, res, next) => {
    
    const {
        id,
        firstname,
        lastname,
        email,
        phone
    } = req.body.data;

    let objuser = {
        'firstname' : firstname,
        'lastname' : lastname,
        'email' : email,
        'phone' : phone
    };

    req.context.models.Users.findOne({ where : { id: id } })
    .then((Users) => {
        Users.update(objuser)
        .then( async () => {
            let Users = await req.context.models.Users.findAll({attributes: ['id', 'firstname', 'lastname', 'email', 'phone', 'kyc_status', 'createdAt']});
            let Wallets = await req.context.models.Wallets.findAll({ attributes: ['partner_id', 'walletname', 'public_key'], where: { use : 1 }});
            res.send({status: true, result: {users: Users, wallets: Wallets}});
            return next();
        })
        .catch(err => {
            res.send({status: false, result: "Database error"});
        })
    })
    .catch(err => {
        res.send({status: false, result: "Database error"});
    })
});

router.post('/adminsignin', async (req, res, next) => {
    let data =  req.body.data;
    req.context.models.Superadmin.findOne({where: { email: data.email }})
    .then(superadmin => {
        if(superadmin) {
            bcrypt.compareSync(data.password, superadmin.password );
            if(bcrypt.compareSync(data.password, superadmin.password) == true) {
                res.send({status: true, result: superadmin.email});
                return next();
            } else {
                res.send({status: false, result: "Password doesn't match"});
                return next();
            }
        } else {
            res.send({status: false, result: "Superadmin doesn't exists."});
        }
    })
    .catch(err => {
        res.send({status: false, result: "Superadmin doesn't exists."});
        return next();
    })
});

module.exports = router;