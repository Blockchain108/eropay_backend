const { Router } = require('express');
const {
    Server,
    TransactionBuilder,
    // StellarTomlResolver,
    BASE_FEE,
    Networks,
    Operation,
    Keypair,
    Account
} = require('stellar-sdk');
const StellarBase =  require('stellar-base');
const axios = require('axios');
const sjcl = require('@tinyanvil/sjcl');
var jwt = require('jsonwebtoken');

const XLMA = process.env.dev == "true" ? process.env.DEV_XLM : process.env.XLM;
const HORIZON_URL = process.env.dev == "true" ? process.env.DEV_HORIZON_URL : process.env.HORIZON_URL;
const SERVER_URL = process.env.dev == "true" ? process.env.DEV_SERVER_URL : process.env.SERVER_URL;
const networks = process.env.dev == "true" ? Networks.TESTNET :  Networks.PUBLIC;
const DOMAIN_NAME = process.env.DOMAIN_NAME;

const StellarServer = new Server(HORIZON_URL);
const router = Router();

const { socketdata, balances } = require('../config');

function correctnum(num) {
    var arr = num.split('.');
    return `${arr[0]}.${arr[1].slice(0,7)}`;
}

router.post('/create', async (req, res) => {
    var data = req.body;
    var obj = {
        partner_id: data.partner_id,
        email: data.email,
        public_key: null,
        keystore: data.keystore,
        walletname: data.name,
        addMode: data.addMode,
        status: 1,
    }

    obj['federationAddress'] = obj.email.slice(0, obj.email.indexOf('@')) + '_' + obj.walletname.toLowerCase().replace(' ', '') + '*' + DOMAIN_NAME;

    jwt.verify(obj.keystore, process.env.JWT_SECRET_KEY, async function(err, decoded) {
        if (err) return res.status(500).send({ status: false, message: 'Failed to authenticate token.' });

        if (obj.addMode == 'create') {
            const newStellarAccount = Keypair.random();
            obj.public_key = newStellarAccount.publicKey();
            obj.keystore = newStellarAccount.secret();

            obj.keystore = jwt.sign(obj.keystore, process.env.JWT_SECRET_KEY);

            //Check wallet account from database
            var selectWallet = await req.context.models.Wallets.findOne({where: {public_key: obj.public_key}});
            if (selectWallet) {
                return res.send({status: false, message: "The wallet account is already exists!"});
            } else {
                //Confirm existed active account
                var selectedWallet = await req.context.models.Wallets.findOne({where: {partner_id: obj.partner_id, use:1}});
                if(selectedWallet == null) {
                    obj['use'] = 1;
                }
    
                req.context.models.Wallets.create(obj).then(() => {
                    res.send({status: true});
                }).catch((err) => {
                    res.send({status: false, message: "Database error!"});
                })
            }
        } else if (obj.addMode == 'import') {
            
            //Confirm stellar secretkey validation
            if (StellarBase.StrKey.isValidEd25519SecretSeed(decoded.keystore)) {
                const newStellarAccount = Keypair.fromSecret(decoded.keystore);
                obj.public_key = newStellarAccount.publicKey();
                obj.keystore = newStellarAccount.secret();

                obj.keystore = jwt.sign(obj.keystore, process.env.JWT_SECRET_KEY);
    
                //Check wallet account from database
                var selectWallet = await req.context.models.Wallets.findOne({where: {public_key: obj.public_key}});
                if (selectWallet) {
                    res.send({status: false, message: "The wallet account is already exists!"});
                } else {
    
                    //Create new account
                    req.context.models.Wallets.create(obj).then(() => {
                        res.send({status: true});
                    }).catch((err) => {
                        res.send({status: false, message: "Database error!"});
                    })
                }
            } else {
                res.send({status: false, message: "Wrong SecretKey!"});
            }
        } else {
            res.send({status: false, message: "You can create and import wallet, Something else wrong!"});
        }
    });
});

router.post('/remove', async (req, res) => {
    var walletInfo = {
        userId: req.body.userId,
        publicKey: req.body.publicKey
    }

    //Confirm wallet account info
    req.context.models.Wallets.findOne({where: {partner_id: walletInfo.userId, public_key: walletInfo.publicKey}})
    .then(selectedWallet => {
        if (selectedWallet) {
            
            //Confirm active wallet account
            req.context.models.Wallets.findOne({where: {partner_id: walletInfo.userId, public_key: walletInfo.publicKey, use: 1}})
            .then(activeWallet => {
                if (activeWallet == null) {
                    selectedWallet.destroy()
                    .then(() => {
                        res.send({status: true});
                    })
                    .catch(err => {
                        res.send({status: false, message: "Server Error!"});
                    })
                } else {
                    res.send({status: false, message: "You can't remove active wallet!"});
                }
            })
            .catch(err => {
                res.send({status: false, message: "Server Error!"});
            })
        } else {
            res.send({status: false, message: "Wallet account don't exist"});
        }
    })
    .catch(err => {
        res.send({status: false, message: "Server Error!"});
    })
});

router.post('/edit', async (req, res) => {
    var walletInfo = {
        userId: req.body.partner_id,
        walletname: req.body.name,
        publicKey: req.body.publicKey
    }
    
    //Check wallet name
    if (!walletInfo.walletname) { return res.send({status: false, message: "Please enter walletname"}); }

    //Confirm wallet account info
    req.context.models.Wallets.findOne({where: {partner_id: walletInfo.userId, public_key: walletInfo.publicKey}})
    .then(selectedWallet => {
        if (selectedWallet) {

            //Update wallet account name
            selectedWallet.update({ walletname: walletInfo.walletname })
            .then(() => {
                res.send({status: true});
            })
            .catch(err => {
                res.send({status: false, message: "Server Error!"});
            })
        } else {
            res.send({status: false, message: "Wallet account don't exist"});
        }
    })
    .catch(err => {
        res.send({status: false, message: "Server Error!"});
    })
});

router.post('/mywallets', async (req, res) => {
    var id = req.body.data;
    var selectWallets = await req.context.models.Wallets.findAll({attributes: ['id', 'walletname', 'federationAddress', 'public_key', 'keystore', 'use', 'createdAt'], where: { partner_id: id }});
    if(selectWallets == null) {
        res.send({status: true, result: []});
    } else {
        res.send({status: true, result: selectWallets});
    }
});

router.post('/getcurencies', (req, res) => {
    var id = req.body.data;
    req.context.models.Balance.findAll({where: { partner_id : id }})
    .then(balances => {
        res.send({
            status: true,
            result: balances
        })
    })
    .catch(err => {
        res.send({
            status: false
        })
    })
});

router.post('/currentwallet', async (req, res) => {
    var partner_id = req.body.data;
    var selectWallets = await req.context.models.Wallets.findOne({where: {partner_id: partner_id, use: 1}});
    if(selectWallets == null) {
        res.send({status: true, result: {}});
    } else {
        res.send({status: true, result: selectWallets});
    }
});

router.post('/activewallet', async (req, res) => {
    let request_data = req.body;
    req.context.models.Wallets.findOne({ where: { partner_id: request_data.partner_id, use: 1 } })
    .then(result => {
        if(result == null) {
            req.context.models.Wallets.findOne({ where: { public_key: request_data.public_key } })
            .then(wallet => {
                wallet.update({use: 1})
                .then(() => {
                    res.send({status: true, result: wallet});
                }).catch(err => {res.send({status: false, result: err});})
            })
        } else {
            result.update({use: 0})
            .then(() => {
                req.context.models.Wallets.findOne({ where: { public_key: request_data.public_key } })
                .then(wallet => {
                    wallet.update({use: 1})
                    .then(() => {
                        res.send({status: true, result: wallet});
                    }).catch(err => {res.send({status: false, result: err});})
                })
            }).catch(err => { res.send({status: false, result: err});})
        }
    })
    .catch(err => {
        res.send({status: false, result: err});
    })
});

router.post('/exchange', async (req, res) => {
    let request_data = req.body.data;
    var selectWallet = await req.context.models.Wallets.findOne({where: {partner_id: request_data.partner_id, use: 1}});
    req.context.models.Balance.findOne({where: { partner_id: selectWallet.id, type: request_data.sourceAssetCode }})
    .then(balance => {
        balance.update({
            amount: parseFloat(balance.amount) - parseFloat(request_data.exchangeAmount)
        })
        .then(() => {
            req.context.models.Balance.findOne({where: { partner_id: selectWallet.id, type: request_data.targetAssetCode }})
            .then(tbalance => {
                tbalance.update({
                    amount: parseFloat(tbalance.amount) + parseFloat(request_data.targetAmount)
                })
                .then(() => {
                    let obj = {
                        partner_id: selectWallet.id,
                        from: request_data.sourceAssetCode,
                        request: request_data.exchangeAmount,
                        to: request_data.targetAssetCode,
                        target: request_data.targetAmount,
                    }
                    req.context.models.Transactions.create({
                        w_sender: selectWallet.id,
                        w_receiver: selectWallet.id,
                        amount: `${request_data.exchangeAmount} => ${request_data.targetAmount}`,
                        form: "Exchange",
                        currency: `${request_data.sourceAssetCode} => ${request_data.targetAssetCode}`
                    }).then(() => {}).catch(err => {})
                    req.context.models.Exchangerequest.create(obj).then(() => {
                        res.send({status: true, result: "Success"});
                    }).catch(err => {
                        res.send({status: false, result: "Something went wrong"});
                    })
                })
                .catch(err => {
                    res.send({status: false, result: "Something went wrong"});
                })
            })
        })
        .catch(err => {
            res.send({status: false, result: "Something went wrong"});
        })
    })
    .catch(err => {
        res.send({status: false, result: "Something went wrong"});
    })
});

router.post('/createpay', async (req, res) => {
    let request_data = req.body.data;
    var selectWallet = await req.context.models.Wallets.findOne({where: {partner_id: request_data.partner_id, use: 1}});
    req.context.models.Balance.findOne({where: { partner_id: selectWallet.id, type: request_data.assetCode }})
    .then(balance => {
        balance.update({
            amount: parseFloat(balance.amount) - parseFloat(request_data.amount)
        })
        .then(async () => {
            var realselectWallet = await req.context.models.Wallets.findOne({where: {partner_id: request_data.realid, use: 1}});
            req.context.models.Balance.findOne({where: { partner_id: realselectWallet.id, type: request_data.assetCode }})
            .then(tbalance => {
                tbalance.update({
                    amount: parseFloat(tbalance.amount) + parseFloat(request_data.amount)
                })
                .then(async () => {
                    req.context.models.Transactions.create({
                        w_sender: request_data.partner_id,
                        w_receiver: realselectWallet.id,
                        amount: request_data.amount,
                        form: "Create a payment",
                        currency: request_data.assetCode
                    }).then(() => {}).catch(err => {})
                    let sender = await req.context.models.Users.findOne({where : {id : request_data.partner_id}});
                    var users = socketdata.info.filter(function (item) {
                        if(item.type == 'customer' && item.userid != request_data.partner_id) {
                            return item;
                        }
                    });
                    let obj = {
                        sender: `${sender.firstname} ${sender.lastname}`,
                        asset: request_data.assetCode,
                        amount : request_data.amount
                    }
                    for(let k = 0  ; k < users.length ; k++) {
                        users[k].socket.emit('mCreateapayment', obj);
                    }
                    res.send({status: true, result: "Success"});
                })
                .catch(err => {
                    res.send({status: false, result: "Something went wrong"});
                })
            }).catch(err => {
                res.send({status: false, result: "Something went wrong"});
            })
        })
        .catch(err => {
            res.send({status: false, result: "Something went wrong"});
        })
    })
    .catch(err => {
        res.send({status: false, result: "Something went wrong"});
    })
});

router.post('/transactions', async (req, res) => {
    var re_data = req.body.data;
    req.context.models.Wallets.findOne({where: {id: re_data.id}}).then(async (walllet) => {
        axios.post(SERVER_URL + '/stellar/payment_for_account', { account_id : walllet.public_key }).then(stellar_transaction => {
            req.context.models.Transactions.getById(re_data.id).then(async (transactions) => {

                var sd = stellar_transaction.data;
                var wdata = [];

                var Tusers = req.context.models.Users;
                var Twal = req.context.models.Wallets;

                Tusers.hasMany(Twal, {foreignKey: 'id'});
                Twal.belongsTo(Tusers, {foreignKey: 'partner_id'});

                for(let i = 0 ; i  < sd.length ; i++) {
                    var tp_key = "", amount = 0, assetcode = "", aissuer = "";
                    if(sd[i].type == "payment") {
                        tp_key = sd[i].to;
                        amount = sd[i].amount;
                        if(sd[i].asset_type == "native") {
                            assetcode = "XLM";
                        } else {
                            assetcode = sd[i].asset_code;
                            aissuer = sd[i].asset_issuer;
                        }
                    } else {
                        assetcode = "XLM";
                        tp_key = sd[i].account;
                        amount = sd[i].starting_balance;
                    }
                    var wallet1 = {}, wallet2 = {};
                    wallet1 = await Twal.findOne({include: [Tusers], where : { public_key: sd[i].source_account }});
                    wallet2 = await Twal.findOne({include: [Tusers], where : { public_key: tp_key }});

                    var obj = {};
                    obj.no = wdata.length + 1;
                    if(wallet1 == null) {
                        obj.sender = `UnRegistered`;
                        obj.s_email = `UnRegistered`;
                        obj.s_wallet = `UnRegistered`;
                    } else {
                        obj.sender = `${wallet1.tbl_user.firstname} ${wallet1.tbl_user.lastname}`;
                        obj.s_email = wallet1.tbl_user.email;
                        obj.s_wallet = wallet1.public_key;
                    }
                    if(wallet2 == null) {
                        obj.receiver = `UnRegistered`;
                        obj.r_email = `UnRegistered`;
                        obj.r_wallet = `UnRegistered`;
                    } else {
                        obj.receiver = `${wallet2.tbl_user.firstname} ${wallet2.tbl_user.lastname}`;
                        obj.r_email = wallet2.tbl_user.email;
                        obj.r_wallet = wallet2.public_key;
                    }
                    obj.amount = amount;
                    obj.asset_code = assetcode;
                    obj.asset_issuer = aissuer;
                    obj.form = sd[i].type;
                    obj.type = 'Crypto';
                    obj.time = sd[i].created_at;
                    wdata.push(obj);
                }

                var wallet1 = {}, wallet2 = {};
                for(let i = 0 ; i < transactions.length ; i++) {
                    wallet1 = await Twal.findOne({include: [Tusers], where : { id: transactions[i].w_sender }});
                    wallet2 = await Twal.findOne({include: [Tusers], where : { id: transactions[i].w_receiver }});

                    var obj = {};
                    obj.no = wdata.length + 1;
                    if(wallet1 == null) {
                        obj.sender = `UnRegistered`;
                        obj.s_email = `UnRegistered`;
                        obj.s_wallet = `UnRegistered`;
                    } else {
                        obj.sender = `${wallet1.tbl_user.firstname} ${wallet1.tbl_user.lastname}`;
                        obj.s_email = wallet1.tbl_user.email;
                        obj.s_wallet = wallet1.public_key;
                    }
                    if(wallet2 == null) {
                        obj.receiver = `UnRegistered`;
                        obj.r_email = `UnRegistered`;
                        obj.r_wallet = `UnRegistered`;
                    } else {
                        obj.receiver = `${wallet2.tbl_user.firstname} ${wallet2.tbl_user.lastname}`;
                        obj.r_email = wallet2.tbl_user.email;
                        obj.r_wallet = wallet2.public_key;
                    }
                    obj.amount = transactions[i].amount;
                    obj.form = transactions[i].form;
                    obj.asset_code = transactions[i].currency;
                    obj.type = 'Fiat';
                    obj.time = transactions[i].createdAt;
                    wdata.push(obj);
                }

                wdata.sort(function(a,b){
                    return new Date(b.time) - new Date(a.time);
                })

                res.send({status : true, result : wdata});
            }).catch(err => {
                res.send({status: false, msg: "Something went wrong!"});
            })
        }).catch(err => {
            res.send({status: false, msg: "Something went wrong!"});
        })
    }).catch(err => {
        res.send({status: false, msg: "Something went wrong!"});
    })
});

// Meme Hyperlink

// https://hellenium.com/meme/gtransactions?attractor=4035501000000009
router.post('/gtransactions', (req, res) => {
    var redata = req.query;
    req.context.models.Wallets.findOne({where : {card_num: redata.attractor}}).then( async (wallet) => {
        axios.post(SERVER_URL + '/wallets/transactions', {data: { id : wallet.id}}).then((result) => {
            res.send(result.data);
        }).catch(err => {
            res.send({status: false, result: "Something went wrong"});
        })
    }).catch(err => {
        res.send({status: false, result: "Something went wrong"});
    })
})

// https://hellenium.com/meme/pay
// Required post data 
// {
//     attractor:aaa,
//     merchant:bbb,
//     partner:ccc,
//     amount:ddd,
//     type:eee,
//     password:fff,
//     currency:ggg,
//     deposit:hhh
// }
// 
// aaa => card number
// bbb => machant wallet id
// ccc => EDPS wallet id
// ddd => amount
// eee => type e.g. fiat or crypto
// fff => password of the wallet
// ggg => currency e.g. USD, EUR, GBP and CHF
// hhh => flag of the deposit e.g. true or false

// https://hellenium.com/meme/pay
// Required post data 
// {
//     attractor:aaa,
//     merchant:bbb,
//     partner:ccc,
//     amount:ddd,
//     type:eee,
//     password:fff,
//     assetCode:ggg,
//     assetIssuer:hhh
//     deposit:yyy
// }
// aaa => card number
// bbb => machant wallet id
// ccc => EDPS wallet id
// ddd => amount
// eee => type e.g. fiat or crypto
// fff => password of the wallet
// ggg => asset code that you are going to deposit or transfer
// hhh => asset issuer that you are going to deposit or transfer
// yyy => flag of the deposit e.g. true or false


router.post('/pay', async (req, res) => {
    var redata = req.body;
    
    var Wtbl = req.context.models.Wallets;
    var Btbl = req.context.models.Balance;

    if(redata.type == "fiat") {
        Wtbl.findOne({where : {card_num: redata.attractor}}).then(CurrentUserW => {
            if(CurrentUserW == null) {
                res.send({status: false, msg: "Wallet doesn't exists or Expired, please contact with Support team"});
            } else {
                if(redata.deposit == 'true') {
                    Btbl.findOne({where : {partner_id : redata.merchant, type: redata.currency }}).then(mbalance => {
                        if(parseFloat(mbalance.amount) < parseFloat(redata.amount)) {
                            res.send({status: false, msg: "Machant wallet balance doesn't enough."});
                        } else {
                            let amount = parseFloat(mbalance.amount) - parseFloat(redata.amount);
                            mbalance.update({amount : amount}).then(() => {
                                req.context.models.Transactions.create({
                                    w_sender: redata.merchant,
                                    w_receiver: CurrentUserW.id,
                                    amount: redata.amount,
                                    form: "Card Pay",
                                    currency: redata.currency
                                }).then(() => {}).catch(err => {})
                                Btbl.findOne({where : {partner_id : CurrentUserW.id, type: redata.currency}}).then(Cbalance => {
                                    let amount = parseFloat(redata.amount) + parseFloat(Cbalance.amount);
                                    Cbalance.update({amount : amount}).then(() => {
                                        res.send({status: true, msg: "Success"});
                                    }).catch(err => {
                                        res.send({status: false, result: "Something went wrong"});
                                    })
                                }).catch(err => {
                                    res.send({status: false, result: "Something went wrong"});
                                })
                            }).catch(err => {
                                res.send({status: false, result: "Something went wrong"});
                            })
                        }
                    }).catch(err => {
                        res.send({status: false, result: "Something went wrong"});
                    })
                } else if(redata.deposit == 'false') {
                    try {
                        let trustedsecret = sjcl.decrypt(redata.password, CurrentUserW.keystore);
                        // var ourAmount = parseFloat(redata.amount) * 0.0047;
                        Btbl.findOne({where : {partner_id : CurrentUserW.id, type: redata.currency}}).then(Cbalance => {
                            if(parseFloat(Cbalance.amount) < parseFloat(redata.amount)) {
                                res.send({status: false, msg: "User wallet balance doesn't enough."});
                            } else {
                                let amount = parseFloat(Cbalance.amount) - parseFloat(redata.amount);
                                Cbalance.update({amount : amount}).then(() => {
                                    Btbl.findOne({where : {partner_id : redata.merchant, type: redata.currency }}).then((machantB) => {
                                        var machantAmount = parseFloat(machantB.amount) + parseFloat(redata.amount) * process.env.MACHANT_STOKE;
                                        machantB.update({amount : machantAmount}).then(() => {
                                            Btbl.findOne({where : {partner_id : redata.partner, type: redata.currency }}).then((edpsB) => {
                                                req.context.models.Transactions.create({
                                                    w_sender: CurrentUserW.id,
                                                    w_receiver: redata.merchant,
                                                    amount: redata.amount,
                                                    form: "Card Pay",
                                                    currency: redata.currency
                                                }).then(() => {}).catch(err => {})
                                                var edpsAmount = parseFloat(edpsB.amount) + parseFloat(redata.amount) * process.env.EDPS_STOKE;
                                                edpsB.update({amount: edpsAmount}).then(() => {
                                                    res.send({status: true, msg: "Success"});
                                                }).catch(err => {
                                                    res.send({status: false, result: "Something went wrong"});
                                                })
                                            }).catch(err => {
                                                res.send({status: false, result: "Something went wrong"});
                                            })
                                        }).catch(err => {
                                            res.send({status: false, result: "Something went wrong"});
                                        })
                                    }).catch(err => {
                                        res.send({status: false, result: "Something went wrong"});
                                    })
                                }).catch(err => {
                                    res.send({status: false, result: "Something went wrong"});
                                })
                            }
                        }).catch(err => {
                            res.send({status: false, result: "Something went wrong"});
                        })
                    } catch(err) {
                        res.send({status: false, msg: "Wallet password is wrong."});
                    }
                } else {
                    res.send({status: false, msg: "Please use the deposit flag."});
                }
            }
        }).catch(err => {
            res.send({status: false, msg: "Invalid attractor number"});
        })
    } else if (redata.type == "crypto") {
        Wtbl.findOne({where : {card_num: redata.attractor}}).then(async (CurrentUserW) => {
            if(CurrentUserW == null) {
                res.send({status: false, msg: "Invalid attractor number"});
            } else {
                if(redata.deposit == "true") {
                    var obj = {
                        receiver: CurrentUserW.public_key,
                        assetCode: redata.assetCode,
                        assetIssuer: redata.assetIssuer,
                        amount: redata.amount,
                        type: "buy"
                    };
                    axios.post(`${SERVER_URL}/stellar/transfer`, obj).then(() => {
                        res.send({status: true, msg: "Success"});
                    }).catch(err => {
                        res.send({status: false, msg: "Something went wrong"});
                    })
                } else {
                    try {
                        let trustedsecret = sjcl.decrypt(redata.password, CurrentUserW.keystore);
                        var merwall = await Wtbl.findOne({where: {id : redata.merchant }});
                        var parwall = await Wtbl.findOne({where: {id : redata.partner }});
                        var ourwallet = Keypair.fromSecret(XLMA).publicKey();
                        var amount = parseFloat(redata.amount);
                        var obj = {
                            sender: trustedsecret,
                            receiver: merwall.public_key,
                            assetCode: redata.assetCode,
                            assetIssuer: redata.assetIssuer,
                            amount: correctnum(`${amount * process.env.MACHANT_STOKE}`)
                        };
                        axios.post(`${SERVER_URL}/stellar/ntransfer`, { data: obj }).then(() => {
                            obj.receiver = parwall.public_key;
                            obj.amount = correctnum(`${amount * process.env.EDPS_STOKE}`);
                            axios.post(`${SERVER_URL}/stellar/ntransfer`, { data: obj }).then(() => {
                                obj.receiver = ourwallet;
                                obj.amount = correctnum(`${amount * process.env.SN2_STOKE}`);
                                axios.post(`${SERVER_URL}/stellar/ntransfer`, { data: obj }).then(() => {
                                    res.send({status: true, msg: "Success"});
                                }).catch(err => {
                                    res.send({status: false, msg: "Something went wrong"});
                                })
                            }).catch(err => {
                                res.send({status: false, msg: "Something went wrong"});
                            })
                        }).catch(err => {
                            res.send({status: false, msg: "Something went wrong"});
                        })
                    } catch(err) {
                        res.send({status: false, msg: "Password is wrong"});
                    }
                }
            }
        }).catch(err => {
            res.send({status: false, msg: "Invalid attractor number"});
        })
    } else {
        res.send({status: false, msg: "Invalid Type"});
    }
});


// https://hellenium.com/meme/getbalance?attractor=4035501000000009

router.post('/getbalance', async (req, res) => {
    var redata = req.query;

    var Wtbl = req.context.models.Wallets;
    var Btbl = req.context.models.Balance;

    Wtbl.hasMany(Btbl, {foreignKey: 'partner_id'});
    Btbl.belongsTo(Wtbl, {foreignKey: 'id'});

    Wtbl.findOne({include: [Btbl], where: { card_num: redata.attractor }}).then(CurrentUserW => {
        if(CurrentUserW == null) {
            res.send({status: false, msg: "Wallet doesn't exists or Expired, please contact Support team"});
        } else {
            axios.post(SERVER_URL + '/stellar/account', {signer: CurrentUserW.public_key}).then((stellarBalance) => {
                var wbal = [], ebal, wsbal = stellarBalance.data.balances, waball = CurrentUserW.tbl_balances;
                for(let i = 0 ; i < wsbal.length ; i++) {
                    ebal = {};
                    ebal.asset_code = wsbal[i].asset_code ? wsbal[i].asset_code : "XLM" ;
                    ebal.asset_issuer = wsbal[i].asset_issuer;
                    ebal.amuont = wsbal[i].balance;
                    ebal.type = 'crypto';
                    wbal.push(ebal);
                }
                for(let i = 0 ; i < waball.length ; i++) {
                    ebal = {};
                    ebal.asset_code = waball[i].type;
                    ebal.amount = waball[i].amount;
                    ebal.type = 'fiat';
                    wbal.push(ebal);
                }
                res.send({status: true, result: wbal});
            }).catch(err => {
                res.send({status: false, msg: "Wallet doesn't exists or Expired, Please contact Support team"});
            })
        }
    }).catch(err => {
        res.send({status: false, msg: "Invalid attractor number"});
    })
});


router.post('/setFederationAddress', async (req, res) => {
    const {
        originAddress,
        federationAddress
    } = req.body;

    var isWallet = await req.context.models.Wallets.findOne({where: {federationAddress: federationAddress}});
    if (isWallet) {
       res.send({ status: false, message: 'FederationAddress name exist!' }) ;
    } else {
        var selectWallet = await req.context.models.Wallets.findOne({where: {federationAddress: originAddress}});
        if (selectWallet) {
            selectWallet.update({ federationAddress: federationAddress })
                .then(() => { res.send({ status: true }); })
                .catch(() => { res.send({ status: false }); })
        } else {
            res.send({ status: false });
        }
    }
})

module.exports = router;
