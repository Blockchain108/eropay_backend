const errors = require("../errors");
const axios = require('axios');
const sjcl = require('@tinyanvil/sjcl');
const jwt = require('jsonwebtoken');
const { Router } = require('express');
const {
    Server,
    Keypair,
    Asset,
    TransactionBuilder,
    BASE_FEE,
    Networks,
    Operation,
    NotFoundError,
    Account,
    StellarTomlResolver,
    Memo,
} = require('stellar-sdk');
const fetch = require("node-fetch");
const router = Router();

// const bcrypt = require("bcryptjs");

const SERVER_URL = process.env.dev == "true" ? process.env.DEV_SERVER_URL : process.env.SERVER_URL;
const XLMA = process.env.dev == "true" ? process.env.DEV_XLM : process.env.XLM;
const DESTRI = process.env.dev == "true" ? process.env.DEV_DISTRIBUTION : process.env.DISTRIBUTION;
const HORIZON_URL = process.env.dev == "true" ? process.env.DEV_HORIZON_URL : process.env.HORIZON_URL;
const networks = process.env.dev == "true" ? Networks.TESTNET :  Networks.PUBLIC;
const StellarNetwork = process.env.dev == "true" ? process.env.DEV_STELLAR_NETWORK_URL : process.env.STELLAR_NETWORK_URL;
const STELLAR_EXPERT_URL = process.env.STELLAR_EXPERT_URL;

const StellarServer = new Server(HORIZON_URL);

const ntoemail = require("../config").ntoemail;
const socketdata = require("../config").socketdata;
const { restart } = require("nodemon");

function validateRequest(data, arr, res) {

    for(var i = 0 ; i < arr.length ; i++) {
        if(arr[i] === 'signer') {
            if(!data[arr[i]]) {
                res.send({'error': "You must input 'signer' value."});
                return;
            }
        } else if(arr[i] === 'cursor' || !arr[i] === 'cursor') {
            if(!data[arr[i]]) {
                data.cursor = "";
            }
        } else if(arr[i] === 'order') {
            if(!data[arr[i]]) {
                data.order = "asc";
            }
        } else if(arr[i] === 'limit') {
            if(!data[arr[i]]) {
                data.limit = 200;
            }
        } else if(!data[arr[i]]) {
            data[arr[i]] = "";
        }
    }
    return data;
}

async function filterAsset(limit = 30, search = null, order = 'desc', sort = 'rating') {
    //Set search filter data for asset
    var serverURL = STELLAR_EXPERT_URL + '/' + StellarNetwork + '/asset/?limit=' + limit + '&order=' + order + '&sort=' + sort;
    if (search && search != null) {
        serverURL += '&search=' + search;
    }

    let assets = await axios.get(serverURL);
    if (assets.status === 200) {
        assets = assets.data._embedded.records;

        for (let index = 0; index < assets.length; index++) {
            //Set image key for asset
            if (
                assets[index].tomlInfo && 
                Object.keys(assets[index].tomlInfo).length != 0 && 
                (assets[index].tomlInfo.image || assets[index].tomlInfo.orgLogo)) {

                if (assets[index].tomlInfo.image) {
                    assets[index]['asset_image'] = assets[index].tomlInfo.image;
                } else if(assets[index].tomlInfo.orgLogo) {
                    assets[index]['asset_image'] = assets[index].tomlInfo.orgLogo;
                }
            } else {
                assets[index]['asset_image_text'] = assets[index].asset.slice(0, 1)
            }

            //Set name key for asset
            if (assets[index].tomlInfo && Object.keys(assets[index].tomlInfo).length != 0 && assets[index].tomlInfo.name) {
                assets[index]['asset_name'] = assets[index].tomlInfo.name;
            } else {
                assets[index]['asset_name'] = assets[index].asset.slice(0, assets[index].asset.indexOf('-'));
            }

            //Set anchorName key for asset
            assets[index]['asset_anchorName'] = assets[index].asset.slice(0, assets[index].asset.indexOf('-'));

            //Set issuer key for asset
            assets[index]['asset_issuer'] = assets[index].asset.slice(assets[index].asset.indexOf('-') + 1, assets[index].asset.lastIndexOf('-'))
        }

        return({status: true, data: assets})        
    } else {
        return({status: false, message: "Something problem happened with server!"});
    }
}

var assetNum = 0, toml;
if(process.env.dev == "true") {
    StellarTomlResolver.resolve(process.env.DEV_SERVER_URL, { allowHttp:true })
    .then(result => {
        toml = result;
    })
} else {
    StellarTomlResolver.resolve(process.env.SERVER_URL)
    .then(result => {
        toml = result;
    })
}

async function MchangeTrust(secret) {
    if(assetNum == 0) {
        if(process.env.dev == "true") {
            toml = await StellarTomlResolver.resolve(process.env.DEV_SERVER_URL, { allowHttp:true });
        } else {
            toml = await StellarTomlResolver.resolve(process.env.SERVER_URL);
        }
    }
    var receivingKeys = Keypair.fromSecret(
        secret
    );
    var oneAsset = toml.CURRENCIES[assetNum];
    var ANAsset = new Asset(oneAsset.code, oneAsset.issuer);
    StellarServer
    .loadAccount(receivingKeys.publicKey())
    .then(function (account) {
        var transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: networks,
        })
        .addOperation(
            Operation.changeTrust({
                asset: ANAsset,
                limit: "10000000",
            }),
        )
        .setTimeout(100000)
        .build();
        transaction.sign(receivingKeys);
        return StellarServer.submitTransaction(transaction);
    })
    .then(function () {
        assetNum++;
        if(assetNum < toml.CURRENCIES.length) {
            MchangeTrust(secret);
        } else {
            assetNum = 0;
            return {status: true};
        }
    })
    .catch(function (error) {
        return {status: false};
    });
}

router.post('/getliveprice', (req, res, next) => {

    var raw = "{\"operationName\":null,\"variables\":{},\"query\":\"{\\n  ticker {\\n    externalPrices {\\n      fiat\\n      crypto\\n      price\\n      priceChange24hr\\n    }\\n    markets {\\n      market\\n      newestCloseTime\\n      newestPrice\\n      priceChange24hr\\n      volume24hr\\n      volume7d\\n      counterVolume24hr\\n      counterVolume7d\\n      trades24hr\\n      orderbookStats {\\n        nBids\\n        nAsks\\n        spread\\n      }\\n    }\\n  }\\n}\\n\"}";

    var requestOptions = {
        method: 'POST',
        headers: {
            "authority": "public-api.stellarx.com",
            "method": "POST",
            "path": "graphql",
            "x-api-key": "da2-d5w7ydzmmndfhggwjy2kdx6qce",
            "Content-Type": "text/plain"
        },
        body: raw,
        redirect: 'follow'
    };

    fetch("https://public-api.stellarx.com/graphql", requestOptions)
    .then(response => response.json())
    .then(result => {res.send({status: true, data: result['data']});})
    .catch(error => res.send({status: false, error: error}));
})

router.post('/loadaccount', (req, res) => {
    let account_publickey = req.body.data;
    StellarServer.loadAccount(account_publickey)
    .then(account => {
        res.send({status: true, result: account});
    })
    .catch(err => {
        res.send({status: false, result: "There is no account or not available"});
    })
})

router.post('/stricreceive', (req, res) => {
    const {
        receiver,
        assetCode,
        assetIssuer,
        amount
    // }  = req.body;
    }  = req.body.data;

    let senderKeypair = Keypair.fromSecret(XLMA);
    let targetAsset = new Asset(assetCode, assetIssuer);

    StellarServer.loadAccount(senderKeypair.publicKey())
    .then(({sequence}) => {
        var account = new Account(senderKeypair.publicKey(), sequence);
        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: networks
        })
        .addOperation(Operation.pathPaymentStrictReceive({
            destination: receiver,
            sendAsset: Asset.native(),
            destAmount: `${amount}`,
            sendMax: `1000000000000`,
            destAsset: targetAsset,
        }))
        .setTimeout(100000)
        .build()
        transaction.sign(senderKeypair);
        
        return StellarServer.submitTransaction(transaction);
    })
    .then(() => {
        res.send({status: true, result: "Success!"});
    })
    .catch(function(error) {
        res.send({status: false, result: "Something went wrong."});
    })
})

router.post('/stricsend', (req, res) => {
    const {
        receiver,
        assetCode,
        assetIssuer,
        amount
    // }  = req.body;
    }  = req.body.data;

    let senderKeypair = Keypair.fromSecret(XLMA);
    let targetAsset = new Asset(assetCode, assetIssuer);

    StellarServer.loadAccount(senderKeypair.publicKey())
    .then(({sequence}) => {
        var account = new Account(senderKeypair.publicKey(), sequence);
        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: networks
        })
        .addOperation(Operation.pathPaymentStrictSend({
            destination: receiver,
            sendAsset: Asset.native(),
            sendAmount: `${amount}`,
            destAsset: targetAsset,
            destMin: '0.0000001'
        }))
        .setTimeout(100000)
        .build()
        transaction.sign(senderKeypair);
        
        return StellarServer.submitTransaction(transaction);
    })
    .then(() => {
        res.send({status: true, result: "Success!"});
    })
    .catch(function(error) {
        res.send({status: false, result: "Something went wrong."});
    })
})

router.post('/create', async (req, res) => {
    // const keyPair = Keypair.random();
    // const data = {
    //     dAccountK : Keypair.fromSecret(DESTRI),    // Distribution account Keypair.
    //     nAccountK : keyPair,                                                    // Keypair for new account that will be created.
    //     sBalance : '1'                                                          // Starting Balance of the new account
    // }
    // StellarServer.loadAccount(data.dAccountK.publicKey())
    //     .then(async (sAccount) => {
    //         const transaction = new TransactionBuilder(sAccount, { 
    //             fee : BASE_FEE, 
    //             networkPassphrase: networks 
    //         })
    //         .addOperation(Operation.createAccount({
    //             destination: data.nAccountK.publicKey(),
    //             startingBalance: data.sBalance
    //         }))
    //         .setTimeout(180)
    //         .build();
            
    //         transaction.sign(data.dAccountK);
    
    //         try {
    //             const transactionResult = await StellarServer.submitTransaction(transaction);
    //             if(transactionResult) {
    //                 res.send({
    //                     "account_id" : data.nAccountK.publicKey(),
    //                     "account_id_secret" : data.nAccountK.secret(),
    //                 });
    //             }
    //         } catch (e) {
    //             res.send({'error': e.response.detail});
    //         }
    //     })
    //     .catch(error => {
    //     })
    const keyPair = Keypair.random();
    const response = await fetch(
        `https://friendbot.stellar.org?addr=${keyPair.publicKey()}`
    );
    const data = await response.json();
    MchangeTrust(keyPair.secret());
    res.send({
        "account_id" : keyPair.publicKey(),
        "account_id_secret" : keyPair.secret(),
    });
})

router.post('/transfer', async (req, res) => {
    const {
        password,
        receiver,
        assetCode,
        assetIssuer,
        amount,
        public_key,
        type
    } = req.body;

    if(type == "buy") {
        const senderKeypair = Keypair.fromSecret(DESTRI);
        var destinationId = receiver;
        StellarServer
            .loadAccount(destinationId)
            .catch(function (error) {
                if (error instanceof NotFoundError) {
                    throw new Error('The destination account does not exist!');
                } else return error
            })
            .then(() => {
                return StellarServer.loadAccount(senderKeypair.publicKey());
            })
            .then(({sequence}) => {
                var account = new Account(senderKeypair.publicKey(), sequence);
                var asset = assetCode != "XLM" ? new Asset(assetCode, assetIssuer) : Asset.native();
                const transaction = new TransactionBuilder(account, {
                    fee: BASE_FEE,
                    networkPassphrase: networks
                })
                .addOperation(Operation.payment({
                    destination: destinationId,
                    asset: asset,
                    amount: amount
                }))
                .addMemo(Memo.text('Transfer'))
                .setTimeout(100000)
                .build()
                transaction.sign(senderKeypair);
                
                return StellarServer.submitTransaction(transaction);
            })
            .then(function(result) {
                res.send({status: true, result: result});
            })
            .catch(function(error) {
                res.send({status: false, result: "Something went wrong."});
            });
    } else {
        req.context.models.Wallets.findOne({ where: { public_key: public_key } })
            .then(result => {
                let sender_secret;
                return sender_secret = sjcl.decrypt(password, result.keystore);
            })
            .then(sender_secret => {
                const senderKeypair = Keypair.fromSecret(sender_secret);
                var destinationId = "";
                if(type == "sell") {
                    destinationId = assetCode != "XLM" ? receiver : Keypair.fromSecret(XLMA).publicKey();
                } else {
                    destinationId = receiver;
                }
                StellarServer
                .loadAccount(destinationId)
                .catch(function (error) {
                    if (error instanceof NotFoundError) {
                        throw new Error('The destination account does not exist!');
                    } else return error
                })
                .then(() => {
                    return StellarServer.loadAccount(senderKeypair.publicKey());
                })
                .then(({sequence}) => {
                    var account = new Account(senderKeypair.publicKey(), sequence);
                    var asset = assetCode != "XLM" ? new Asset(assetCode, assetIssuer) : Asset.native();

                    const transaction = new TransactionBuilder(account, {
                        fee: BASE_FEE,
                        networkPassphrase: networks
                    })
                    .addOperation(Operation.payment({
                        destination: destinationId,
                        asset: asset,
                        amount: amount
                    }))
                    .addMemo(Memo.text('Transfer'))
                    .setTimeout(100000)
                    .build()
                    transaction.sign(senderKeypair);
                    
                    return StellarServer.submitTransaction(transaction);
                })
                .then(function(result) {
                    res.send({status: true, result: result});
                })
                .catch(function(error) {
                    res.send({status: false, result: "Something went wrong."});
                });
            })
            .catch(err => {
                if(err.message) {
                    res.send({status: false, result: "Wallet password doesn't match."});
                } else {
                    res.send({status: false, result: "Something went wrong."});
                }
            })
    }
    
})

router.post('/ntransfer', async (req, res) => {
    const {
        sender,
        receiver,
        assetCode,
        assetIssuer,
        amount
    } = req.body.data;
    const senderKeypair = Keypair.fromSecret(sender);

    StellarServer
    .loadAccount(receiver)
    .catch(function (error) {
        if (error instanceof NotFoundError) {
            throw new Error('The destination account does not exist!');
        } else return error
    })
    .then(() => {
        return StellarServer.loadAccount(senderKeypair.publicKey());
    })
    .then(({sequence}) => {
        var account = new Account(senderKeypair.publicKey(), sequence);
        var asset = assetCode == "XLM" ?  Asset.native() : new Asset(assetCode, assetIssuer);
        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: networks
        })
        .addOperation(Operation.payment({
            destination: receiver,
            asset: asset,
            amount: amount
        }))
        .addMemo(Memo.text('Transfer'))
        .setTimeout(100000)
        .build()
        transaction.sign(senderKeypair);
        
        return StellarServer.submitTransaction(transaction);
    })
    .then(function(result) {
        res.send({status: true, result: result});
    })
    .catch(function(error) {
        res.send({status: false, result: "Something went wrong."});
    });
})

router.post('/send', async (req, res) => {
    let {
        id,
        receiver,
        assetCode,
        assetIssuer,
        amount,
        memo,
        isFederation
    } = req.body;

    if (isFederation) {
        //Check Federation Address
        req.context.models.Wallets.findOne({where: {federationAddress: receiver}})
            .then(wallet => {
                if (wallet == null) {
                    res.send({status: false, result: "Federation Account don't exist."});                    
                } else {
                    receiver = wallet.public_key;
                    req.context.models.Wallets.findOne({where: {partner_id: id, use: 1}}).then(user => {
                        if(user == null) {
                            res.send({status: false, msg: "User doesn't exists!"});
                        } else {
                            jwt.verify(user.keystore, process.env.JWT_SECRET_KEY, function (err, keystore) {
                                user.keystore = keystore;
                            })
                            const senderKeypair = Keypair.fromSecret(user.keystore);
                            StellarServer.loadAccount(receiver)
                                .then(() => {
                                    StellarServer.loadAccount(senderKeypair.publicKey())
                                        .then(({ sequence }) => {
                                            var account = new Account(senderKeypair.publicKey(), sequence);
                                            var asset = assetCode == 'XLM' ? Asset.native() : new Asset(assetCode, assetIssuer);
            
                                            const transaction = new TransactionBuilder(account, {
                                                fee: BASE_FEE,
                                                networkPassphrase: networks
                                            })
                                            .addOperation(Operation.payment({
                                                destination: receiver,
                                                asset: asset,
                                                amount: amount
                                            }))
                                            .addMemo(Memo.text(memo != null ? memo : '' ))
                                            .setTimeout(10000)
                                            .build()
                                            transaction.sign(senderKeypair);
            
                                            return StellarServer.submitTransaction(transaction);
                                        })
                                        .then(() => {
                                            res.send({ status: true });
                                        })
                                        .catch((err) => {
                                            if (err.response.data.extras.result_codes.operations[0]) {
                                                res.send({ status: false, message: "Receive account is not active. You must send over 1 XLM for active" });
                                            } else {
                                                res.send({ status: false, message: 'Something problem with server' });
                                            }
                                        })
                                })
                                .catch((err) => {
                                    if (err instanceof NotFoundError) {
                                        if (assetCode != 'XLM') {
                                            res.send({ status: false, message: "Recieved account is not actived yet." });
                                        } else {
                                            StellarServer.loadAccount(senderKeypair.publicKey())
                                                .then(({ sequence }) => {
                                                    var account = new Account(senderKeypair.publicKey(), sequence);
                                                    const transaction = new TransactionBuilder(account, { 
                                                        fee : BASE_FEE,
                                                        networkPassphrase: networks
                                                    })
                                                    .addOperation(Operation.createAccount({
                                                        destination: receiver,
                                                        startingBalance: `${amount}`
                                                    }))
                                                    .setTimeout(10000)
                                                    .build();
                                                    
                                                    transaction.sign(senderKeypair);
                                                    return StellarServer.submitTransaction(transaction);
                                                })
                                                .then((result) => {
                                                    res.send({ status: true });
                                                })
                                                .catch((err) => {
                                                    if (err.response.data.extras.result_codes.operations[0] == 'op_low_reserve') {
                                                        res.send({ status: false, message: "Receive account is not active. You must send over 1 XLM for active" });
                                                    } else if (err.response.data.extras.result_codes.operations[0] == 'op_underfunded') {
                                                        res.send({ status: false, message: "After send, you must have over 3 XLM" });
                                                    } else {
                                                        res.send({ status: false, message: "Something problem with server" });
                                                    }
                                                })
                                        }
                                    } else {
                                        res.send({ status: false, message: "Receiver account info is not correct" });
                                    }
                                })
                        }
                    }).catch(err => {
                        res.send({status: false, message: "Something Went Wrong!"});
                    })
                }
            })
            .catch(function (err) {
                res.send({status: false, result: "Something went wrong."});
            })
    } else {
        req.context.models.Wallets.findOne({where: {partner_id: id, use: 1}}).then(user => {
            if(user == null) {
                res.send({status: false, msg: "User doesn't exists!"});
            } else {
                jwt.verify(user.keystore, process.env.JWT_SECRET_KEY, function (err, keystore) {
                    user.keystore = keystore;
                })
                const senderKeypair = Keypair.fromSecret(user.keystore);
                StellarServer.loadAccount(receiver)
                    .then(() => {
                        StellarServer.loadAccount(senderKeypair.publicKey())
                            .then(({ sequence }) => {
                                var account = new Account(senderKeypair.publicKey(), sequence);
                                var asset = assetCode == 'XLM' ? Asset.native() : new Asset(assetCode, assetIssuer);

                                const transaction = new TransactionBuilder(account, {
                                    fee: BASE_FEE,
                                    networkPassphrase: networks
                                })
                                .addOperation(Operation.payment({
                                    destination: receiver,
                                    asset: asset,
                                    amount: amount
                                }))
                                .addMemo(Memo.text(memo != null ? memo : '' ))
                                .setTimeout(10000)
                                .build()
                                transaction.sign(senderKeypair);

                                return StellarServer.submitTransaction(transaction);
                            })
                            .then(() => {
                                res.send({ status: true });
                            })
                            .catch((err) => {
                                if (err.response.data.extras.result_codes.operations[0]) {
                                    res.send({ status: false, message: "Receive account is not active. You must send over 1 XLM for active" });
                                } else {
                                    res.send({ status: false, message: 'Something problem with server' });
                                }
                            })
                    })
                    .catch((err) => {
                        if (err instanceof NotFoundError) {
                            if (assetCode != 'XLM') {
                                res.send({ status: false, message: "Recieved account is not actived yet." });
                            } else {
                                StellarServer.loadAccount(senderKeypair.publicKey())
                                    .then(({ sequence }) => {
                                        var account = new Account(senderKeypair.publicKey(), sequence);
                                        const transaction = new TransactionBuilder(account, { 
                                            fee : BASE_FEE,
                                            networkPassphrase: networks
                                        })
                                        .addOperation(Operation.createAccount({
                                            destination: receiver,
                                            startingBalance: `${amount}`
                                        }))
                                        .setTimeout(10000)
                                        .build();
                                        
                                        transaction.sign(senderKeypair);
                                        return StellarServer.submitTransaction(transaction);
                                    })
                                    .then((result) => {
                                        res.send({ status: true });
                                    })
                                    .catch((err) => {
                                        if (err.response.data.extras.result_codes.operations[0] == 'op_low_reserve') {
                                            res.send({ status: false, message: "Receive account is not active. You must send over 1 XLM for active" });
                                        } else if (err.response.data.extras.result_codes.operations[0] == 'op_underfunded') {
                                            res.send({ status: false, message: "After send, you must have over 3 XLM" });
                                        } else {
                                            res.send({ status: false, message: "Something problem with server" });
                                        }
                                    })
                            }
                        } else {
                            res.send({ status: false, message: "Receiver account info is not correct" });
                        }
                    })
            }
        }).catch(err => {
            res.send({status: false, message: "Something Went Wrong!"});
        })
    }
    
})

router.post('/receive', async (req, res) => {
    // const link = StellarQr.getStellarLink({
    //     wallet: 'stargazer',
    //     accountId: 'GAWCWZQFQANBXAACJRL6QNMHT7T5J2UOMUNQPX37LIPWRYQAIQZIBMQW',
    //     amount: '0.01',
    //     assetCode: 'BTC',
    //     assetIssuer: 'GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF',
    //     memoType: 'text',
    //     memo: 'KAUOsC3bTU2+V2LwT18vDg=='  
    //   });
    //   const svgString = StellarQr.getStellarQR(link);
})

router.post('/exchange', async (req, res) => {
    var data = req.body;
    // sourceAssetCode, sourceAssetIssuer, sendAmount, sendMax, secret

    var sourceAsset = new Asset( data.sourceAssetCode, data.sourceAssetIssuer );
    var targetAsset = new Asset( data.targetAssetCode, data.targetAssetIssuer );
    // var msc1Asset = new Asset( 'msc1', process.env.ISSUER );

    var senderKeypair = Keypair.fromSecret(data.secret);
    var msc1destributionKeypair = Keypair.fromSecret(DESTRI);
    // var msc1destributionKeypair = Keypair.fromSecret(DESTRI);

    StellarServer
    .loadAccount(senderKeypair.publicKey())
    .then(({sequence}) => {
        var account = new Account(senderKeypair.publicKey(), sequence);
        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: networks
        })
        .addOperation(Operation.pathPaymentStrictSend({
            source: senderKeypair.publicKey(),
            destination: msc1destributionKeypair.publicKey(),
            sendAsset: sourceAsset,
            sendAmount: data.sendAmount,
            sendMax: data.sendAmount,
            destAsset: Asset.native(),
            destMin: process.env.DESMINAMOUNT,
        }))
        .setTimeout(100000)
        .build()
        transaction.sign(senderKeypair);
        
        return StellarServer.submitTransaction(transaction);
    })
    .then(function(result) {
        return StellarServer.payments().forTransaction(result.id).call();
    })
    .then(async function(result) {
        var ramount = "" + result.records[0].amount;
        var forsequence = await StellarServer.loadAccount(msc1destributionKeypair.publicKey());
        var account = new Account(msc1destributionKeypair.publicKey(), forsequence.sequence);
        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: networks
        })
        .addOperation(Operation.pathPaymentStrictSend({
            source: msc1destributionKeypair.publicKey(),
            destination: senderKeypair.publicKey(),
            sendAsset: Asset.native(),
            sendAmount: ramount,
            sendMax: ramount,
            destAsset: sourceAsset,
            destMin: process.env.DESMINAMOUNT,
        }))
        .setTimeout(100000)
        .build()
        transaction.sign(msc1destributionKeypair);
        
        return StellarServer.submitTransaction(transaction);
    })
    .then(function() {
        res.send({status: true});
    })
    .catch(err => {
        res.send({status: false});
    })
})

router.post('/account', async (req, res) => {
    //Check account signer value
    if( !req.body.signer ) { res.send({'error': " You must input 'signer' value. "}); }
    
    StellarServer
    .loadAccount(req.body.signer)
    .then(async (result) => {
        delete result._links;
        for (let index = 0; index < result.balances.length; index++) {
            if (result.balances[index].asset_type == 'native') {
                result.balances[index]['asset_name'] = 'Lumens';
                result.balances[index]['asset_anchorName'] = 'XLM';
                result.balances[index]['is_authorized'] = true;
            } else {
                var assetList = await filterAsset(30, result.balances[index].asset_issuer);
                
                assetList = assetList.data;
                for (let assetIndex = 0; assetIndex < assetList.length; assetIndex++) {
                    if (assetList[assetIndex].asset_anchorName == result.balances[index].asset_code) {
                        if (assetList[assetIndex].asset_image) {
                            result.balances[index]['asset_image'] = assetList[assetIndex].asset_image;
                        } else {
                            result.balances[index]['asset_image_text'] = assetList[assetIndex].asset_image_text;
                        }
                        result.balances[index]['asset_name'] = assetList[assetIndex].asset_name;
                        result.balances[index]['asset_anchorName'] = assetList[assetIndex].asset_anchorName;
                        result.balances[index]['asset_issuer'] = assetList[assetIndex].asset_issuer;
                        result.balances[index]['price'] = assetList[assetIndex].price;
                        if (assetList[assetIndex].domain) {
                            result.balances[index]['domain'] = assetList[assetIndex].domain;
                        }
                    }
                }
            }
        }
        res.send({ data: result, status: true });
    })
    .catch((error) => {
        res.send({'error': error.response, status: false});
    })
})

router.post('/accounts', async (req, res) => {

    var data = validateRequest(req.body, ['signer', 'cursor', 'asset', 'order', 'limit'], res);

    StellarServer
    .loadAccount(data.signer)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .then(function (result) {
        if(result._links) { delete result._links; }
        res.send(result);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/assets', async (req, res) => {
    
    var data = validateRequest(req.body, ['asset_code', 'asset_issuer', 'cursor', 'order', 'limit'], res);

    StellarServer.assets()
    .forCode(data.asset_code)
    .forIssuer(data.asset_issuer)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        if(result._links) { delete result._links; }
        res.send(result);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/getAsset', async (req, res) => {
    let myAssets = await filterAsset(30, req.body.filter);
    res.send(myAssets);
});

router.post('/all_effects', async (req, res) => {
    
    var data = validateRequest(req.body, ['cursor', 'order', 'limit'], res);

    StellarServer.effects()
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (effectResults) {
        var rdata = effectResults.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/effects_for_account', async (req, res) => {
    
    var data = validateRequest(req.body, ['signer', 'cursor', 'order', 'limit'], res);

    StellarServer.effects()
    .forAccount(data.signer)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (effectResults) {
        var rdata = effectResults.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/effects_for_ledgers', async (req, res) => {
    
    if(!req.body.sequence) {res.send({'error': " You have to input the sequence. "});return;}

    var data = validateRequest(req.body, ['cursor', 'order', 'limit'], res);
    
    StellarServer.effects()
    .forLedger(data.sequence)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/effects_for_operations', async (req, res) => {
    
    if(!req.body.id) {res.send({'error': " You have to input the id(of operation) . "});return;}

    var data = validateRequest(req.body, ['cursor', 'order', 'limit'], res);
    
    StellarServer.effects()
    .forOperation(data.id)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/effects_for_transactions', async (req, res) => {
    
    if(!req.body.hash) {res.send({'error': " You have to input the hash(A transaction hash, hex-encoded, lowercase. example 7e2050abc676003efc3eaadd623c927f753b7a6c37f50864bf284f4e1510d088). "});return;}

    var data = validateRequest(req.body, ['cursor', 'order', 'limit'], res);
    
    StellarServer.effects()
    .forTransaction(data.hash)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/fee_stats', async (req, res) => {
    StellarServer.feeStats()
    .then(function (result) {
        res.send(result);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/all_ledgers', async (req, res) => {
    
    var data = validateRequest(req.body, ['cursor', 'order', 'limit'], res);
    
    StellarServer.ledgers()
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/offer_details', async (req, res) => {
    
    if(!req.body.offer_id) {res.send({'error': " You have to input the offer_id. "});return;}
    
    StellarServer.offers()
    .offer(req.body.offer_id)
    .call()
    .then(function (result) {
        res.send(result);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/offers_for_account', async (req, res) => {

    if(!req.body.account_id) {res.send({'error': " You have to input the account_id. "});return;}
    var data = validateRequest(req.body, ['cursor', 'order', 'limit'], res);

    StellarServer.offers()
    .offer(data.account_id)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})


router.post('/offers', async (req, res) => {

    var data = validateRequest(req.body, ['seller', 'selling', 'buying', 'cursor', 'order', 'limit'], res);

    StellarServer.offers()
    .offer(data.account_id)
    // .selling(data.selling)
    // .buying(data.buying)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/operations', async (req, res) => {
    
    var data = validateRequest(req.body, ['include_failed', 'cursor', 'order', 'limit'], res);

    StellarServer.operations()
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .includeFailed(data.include_failed)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/operations_for_account', async (req, res) => {
    
    if(!req.body.account_id) {res.send({'error': " You have to input the account_id. "});return;}

    var data = validateRequest(req.body, ['include_failed', 'cursor', 'order', 'limit', "transactions"], res);

    StellarServer.operations()
    .forAccount(data.account_id)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .includeFailed(data.include_failed)
    .join(data.transactions)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/operations_for_ledger', async (req, res) => {
    
    if(!req.body.sequence) {res.send({'error': " You have to input the sequence. "});return;}

    var data = validateRequest(req.body, ['include_failed', 'cursor', 'order', 'limit', "transactions"], res);

    StellarServer.operations()
    .forLedger(data.sequence)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .includeFailed(data.include_failed)
    .join(data.transactions)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/operations_for_transactions', async (req, res) => {
    
    if(!req.body.hash) {res.send({'error': " You have to input the hash(A transaction hash, hex-encoded, lowercase. example 7e2050abc676003efc3eaadd623c927f753b7a6c37f50864bf284f4e1510d088). "});return;}

    var data = validateRequest(req.body, ['cursor', 'order', 'limit', "transactions"], res);

    StellarServer.operations()
    .forTransaction(data.hash)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .join(data.transactions)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/operations', async (req, res) => {
    
    if(!req.body.id) {res.send({'error': " You have to input the id( this is the operation id). "});return;}

    var data = validateRequest(req.body, ["transactions"], res);

    StellarServer.operations()
    .operation(data.id)
    .join(data.transactions)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/orderbook_details', async (req, res) => {
    
    if(!req.body.selling_asset_type) {res.send({'error': " You have to input the selling_asset_type. "});return;}

    var data = validateRequest(req.body, ['selling_asset_code', 'selling_asset_issuer', 'buying_asset_type', 'buying_asset_code', 'buying_asset_issuer', 'limit'], res);

    StellarServer.orderbook(data.selling_asset_type, new Asset(data.buying_asset_code, data.buying_asset_issuer))
    .limit(data.limit)
    .call()
    .then(function (result) {
        if(result._links) { delete result._links; }
        res.send(result);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/stric_recieve_payment_paths', async (req, res) => {
    
    var data = req.body;

    if(!data.source_account) {res.send({'error': " You have to input the source_account. "});return;}
    if(!data.source_assets) {res.send({'error': " You have to input the source_assets. "});return;}
    if(!data.destination_account) {res.send({'error': " You have to input the destination_account. "});return;}
    if(!data.destination_asset_type) {res.send({'error': " You have to input the destination_asset_type. "});return;}
    if(!data.destination_asset_code) {res.send({'error': " You have to input the destination_asset_code. "});return;}
    if(!data.destination_asset_issuer) {res.send({'error': " You have to input the destination_asset_issuer. "});return;}
    if(!data.destination_amount) {res.send({'error': " You have to input the destination_amount. "});return;}

    var destinationAsset = Asset.native(
        data.destination_asset_code,
        data.destination_asset_issuer
    );
    
    StellarServer.paths(data.source_account, destinationAsset, data.destination_amount)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/stric_recieve_payment_paths', async (req, res) => {

    var data = req.body;

    if(!data.source_amount) {res.send({'error': " You have to input the source_account. "});return;}
    if(!data.source_asset_type) {res.send({'error': " You have to input the source_asset_type. "});return;}
    if(!data.source_asset_code) {res.send({'error': " You have to input the source_asset_code. "});return;}
    if(!data.source_asset_issuer) {res.send({'error': " You have to input the source_asset_issuer. "});return;}
    if(!data.destination_account) {res.send({'error': " You have to input the destination_account. "});return;}
    if(!data.destination_assets) {res.send({'error': " You have to input the destination_assets. "});return;}
    
    var sourceAsset = Asset.native(
        data.source_asset_code,
        data.source_asset_issuer
    );
    var destinationAsset = new Asset(
        data.source_asset_code,
        data.source_asset_issuer
    )

    StellarServer.strictSendPaths(sourceAsset, data.source_amount, [destinationAsset])
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/stric_recieve_payment_paths', async (req, res) => {

    var data = req.body;

    if(!data.destination_account) {res.send({'error': " You have to input the destination_account. "});return;}
    if(!data.destination_asset_type) {res.send({'error': " You have to input the destination_asset_type. "});return;}
    if(!data.destination_asset_code) {res.send({'error': " You have to input the destination_asset_code. "});return;}
    if(!data.destination_asset_issuer) {res.send({'error': " You have to input the destination_asset_issuer. "});return;}
    if(!data.destination_amount) {res.send({'error': " You have to input the destination_amount. "});return;}
    if(!data.source_account) {res.send({'error': " You have to input the source_account. "});return;}
    if(!data.source_assets) {res.send({'error': " You have to input the source_assets. "});return;}

    StellarServer.paths(data.source_account, data.destination_account, data.destination_asset, data.destination_amount)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/all_payments', async (req, res) => {
    
    var data = validateRequest(req.body, ['include_failed', 'transactions', 'cursor', 'order', 'limit'], res);

    StellarServer.payments()
    .join(data.transactions)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/payment_for_account', async (req, res) => {
    
    if(!req.body.account_id) {res.send({'error': " You have to input the account_id. "});return;}

    var data = validateRequest(req.body, ['include_failed', 'transactions', 'cursor', 'order', 'limit'], res);

    StellarServer.payments()
    .forAccount(data.account_id)
    .join(data.transactions)
    .cursor(data.cursor)
    .order('desc')
    .limit(30)
    .call()
    .then(function (result) {
        StellarServer.transactions()
        .forAccount(data.account_id)
        .order('desc')
        .limit(30)
        .call()
        .then(async function (resultdata) {
            var redata = resultdata.records;
            for(var i = 0 ; i < redata.length ; i++) {
                if(redata[i]._links) { delete redata[i]._links; }
            }
            var rdata = result.records.filter(item => item.type != 'account_merge');
            for(var i = 0 ; i < rdata.length ; i++) {
                //Remove link transaction
                if(rdata[i]._links) { delete rdata[i]._links; }
                let tdata = redata.filter(item => item.id == rdata[i].transaction_hash);
                rdata[i]['memo'] = tdata.length > 0 ? tdata[0].memo : "";
                //Add transaction status by asset issue
                if (rdata[i].from == req.body.account_id) {
                    rdata[i]['status'] = true;
                } else {
                    rdata[i]['status'] = false;
                }
    
                //Modify transaction create date format
                rdata[i].created_at = (new Date(rdata[i].created_at).toString()).slice(4, 21);
    
                //Get asset info by asset issuer
                if (rdata[i].asset_code == 'credit_alphanum4' || rdata[i].asset_code == 'credit_alphanum12') {
                    var assets = await filterAsset(30, rdata[i].asset_issuer);
                    if (assets.status) {
                        assets = assets.data;
                        for (let index = 0; index < assets.length; index++) {
                            if (assets[index].asset != 'XLM' && assets[index].asset.slice(0, assets[index].asset.indexOf('-')) == rdata[i].asset_type) {
                                rdata[index]['image'] = asset.tomlInfo.image ? asset.tomlInfo.image : asset.tomlInfo.orgLogo;
                            }
                        }
                    } else {
                        return res.send({ 'error': error.asset.message, status: false });
                    }
                }
    
            }
            res.send({ data: rdata, status: true });
        })
        .catch(function (error) {
            res.send({ 'error': error, status: false });
        })
    })
    .catch(function (error) {
        res.send({ 'error': error.response.detail, status: false});
    })
})

router.post('/payment_for_ledger', async (req, res) => {
    
    if(!req.body.ledger_id) {res.send({'error': " You have to input the ledger_id. "});return;}

    var data = validateRequest(req.body, ['include_failed', 'transactions', 'cursor', 'order', 'limit'], res);

    StellarServer.payments()
    .forLedger(data.ledger_id)
    .join(data.transactions)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/payment_for_transaction', async (req, res) => {
    
    if(!req.body.hash) {res.send({'error': " You have to input the hash(A transaction hash, hex-encoded, lowercase. example 7e2050abc676003efc3eaadd623c927f753b7a6c37f50864bf284f4e1510d088). "});return;}

    var data = validateRequest(req.body, ['transactions', 'cursor', 'order', 'limit'], res);

    StellarServer.payments()
    .forTransaction(data.hash)
    .join(data.transactions)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/payment_for_transaction', async (req, res) => {
    
    var data = req.body;

    if(!data.start_time) {res.send({'error': " You have to input the start_time. "});return;}
    if(!data.end_time) {res.send({'error': " You have to input the end_time. "});return;}
    if(!data.resolution) {res.send({'error': " You have to input the resolution. "});return;}
    if(!data.offset) {res.send({'error': " You have to input the offset. "});return;}
    if(!data.base_asset_type) {res.send({'error': " You have to input the base_asset_type. "});return;}
    if(!data.base_asset_code) {res.send({'error': " You have to input the base_asset_code. "});return;}
    if(!data.base_asset_issuer) {res.send({'error': " You have to input the base_asset_issuer. "});return;}
    if(!data.counter_asset_type) {res.send({'error': " You have to input the counter_asset_type. "});return;}
    if(!data.counter_asset_code) {res.send({'error': " You have to input the counter_asset_code. "});return;}
    if(!data.counter_asset_issuer) {res.send({'error': " You have to input the counter_asset_issuer. "});return;}

    var data = validateRequest(req.body, ['transactions', 'cursor', 'order', 'limit'], res);

    StellarServer.payments()
    .forTransaction(data.hash)
    .join(data.transactions)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })

    var base = new Asset.native(
        data.base_asset_code,
        data.base_asset_issuer
        );
    var counter = new Asset(
        data.counter_asset_code,
        data.counter_asset_issuer

    );
    var startTime = data.start_time;
    var endTime = data.end_time;
    var resolution = data.resolution;
    var offset = data.offset;

    server.tradeAggregation(base, counter, startTime, endTime, resolution, offset)
    .call()
    .then(function (tradeAggregation) {
        var rdata = tradeAggregation.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/trades_for_account', async (req, res) => {
    
    if(!req.body.account_id) {res.send({'error': " You have to input the account_id. "});return;}

    var data = validateRequest(req.body, ['cursor', 'order', 'limit'], res);

    StellarServer.trades()
    .forAccount(data.account_id)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (effectResults) {
        var rdata = effectResults.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/trades', async (req, res) => {
    
    var data = req.body;

    if(!data.offer_id) {res.send({'error': " You have to input the offer_id. "});return;}
    if(!data.base_asset_code) {res.send({'error': " You have to input the base_asset_code. "});return;}
    if(!data.base_asset_issuer) {res.send({'error': " You have to input the base_asset_issuer. "});return;}
    if(!data.counter_asset_code) {res.send({'error': " You have to input the counter_asset_code. "});return;}
    if(!data.counter_asset_issuer) {res.send({'error': " You have to input the counter_asset_issuer. "});return;}

    var data = validateRequest(req.body, ['base_asset_type', 'counter_asset_type', 'offer_id', 'cursor', 'order', 'limit'], res);

    StellarServer.trades()
    .forAssetPair(
        new Asset(
            data.base_asset_code,
            data.base_asset_issuer
        ),
        new Asset.native(
            data.counter_asset_code,
            data.counter_asset_issuer
        ),
    )
    .forOffer(data.offer_id)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .call()
    .then(function (effectResults) {
        var rdata = effectResults.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/transactions', async (req, res) => {
    
    var data = validateRequest(req.body, ['include_failed', 'cursor', 'order', 'limit'], res);

    StellarServer.transactions()
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .includeFailed(data.include_failed)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/transactions_for_account', async (req, res) => {
    
    if(!req.body.account_id) {res.send({'error': " You have to input the account_id. "});return;}

    var data = validateRequest(req.body, ['include_failed', 'cursor', 'order', 'limit'], res);

    StellarServer.transactions()
    .forAccount(data.account_id)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .includeFailed(data.include_failed)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/transactions_for_ledger', async (req, res) => {
    
    if(!req.body.ledger_id) {res.send({'error': " You have to input the ledger_id. "});return;}

    var data = validateRequest(req.body, ['include_failed', 'cursor', 'order', 'limit'], res);

    StellarServer.transactions()
    .forLedger(data.ledger_id)
    .cursor(data.cursor)
    .order(data.order)
    .limit(data.limit)
    .includeFailed(data.include_failed)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/transaction_details', async (req, res) => {
    
    if(!req.body.hash) {res.send({'error': " You have to input the hash(A transaction hash, hex-encoded, lowercase. example 7e2050abc676003efc3eaadd623c927f753b7a6c37f50864bf284f4e1510d088). "});return;}

    StellarServer.transactions()
    .transaction(req.body.hash)
    .call()
    .then(function (result) {
        var rdata = result.records;
        for(var i = 0 ; i < rdata.length ; i++) {
            if(rdata[i]._links) { delete rdata[i]._links; }
        }
        res.send(rdata);
    })
    .catch(function (error) {
        res.send({'error': error.response.detail});
    })
})

router.post('/addtrustline', async (req, res) => {
    var request_data = req.body;

    req.context.models.Wallets.findOne({where: {partner_id: request_data.id, use: 1}})
    .then(userdata => {
        jwt.verify(userdata.keystore, process.env.JWT_SECRET_KEY, function name(err, decoded) {
            userdata.keystore = decoded;
        })
        var mykeypair = Keypair.fromSecret(userdata.keystore)
        var assetdata = new Asset(request_data.asset, request_data.issuer);

        StellarServer
        .loadAccount(mykeypair.publicKey())
        .then((account) => {
            var transaction = new TransactionBuilder(account, {
                fee: BASE_FEE,
                networkPassphrase: Networks.PUBLIC,
            })
            .addOperation(
                Operation.changeTrust({
                    asset: assetdata,
                    limit: request_data.limitBalance,
                }),
            )
            .addMemo(Memo.text('Trust Asset'))
            .setTimeout(10000)
            .build();
            transaction.sign(mykeypair);
            return StellarServer.submitTransaction(transaction);
        })
        .then(() => {
            res.send({status:true, result: "Success"});
        })
        .catch(function (err) {
            var message = 'Something went wrong';
            if (err.response.data.extras.result_codes.operations[0] == 'op_low_reserve') {
                message = "You don't have enough money for adding new asset"
            }
            res.send({status: false, message: message});
        });
    })
    .catch(err => {
        res.send({status: false, message: "Something went wrong"});
    })
})

router.post('/buy', (req, res) => {
    const {
        amount,
        price,
        currency,
        assetCode,
        assetIssuer,
        password,
        partner_id
    } = req.body;
    req.context.models.Wallets.findOne({ where: { partner_id: partner_id, use: 1 } })
    .then(result => {
        sjcl.decrypt(password, result.keystore);
        let public_key = result.public_key;
        return public_key;
    })
    .then(async (public_key) => {
        var selectWallet = await req.context.models.Wallets.findOne({where: {partner_id: partner_id, use: 1}});
        req.context.models.Balance.findOne({where: { partner_id: selectWallet.id, type: currency }})
        .then(balance => {
            balance.update({
                amount: parseFloat(balance.amount) - parseFloat(price)
            })
            .then(() => {
                let objforbuy = {
                    partner_id : partner_id,
                    crypto : assetCode,
                    receiver : public_key,
                    issuer : assetIssuer,
                    fiat : currency,
                    cryptoamount : amount,
                    fiatamount : price,
                    priceterms : (parseFloat(price) / parseFloat(amount)).toFixed(5),
                }
                req.context.models.Transactions.create({
                    w_sender: partner_id,
                    w_receiver: '000',
                    amount: amount,
                    form: "Buy Request",
                    currency: currency
                }).then(() => {}).catch(err => {
                })
                req.context.models.Buyrequest.create(objforbuy)
                .then(async () => {
                    var admins = socketdata.info.filter(item => item.type == 'admin');
                    for(let k = 0  ; k < admins.length ; k++) {
                        admins[k].socket.emit('mBuyrequested', 'done');
                    }
                    let msgdata = await axios.post(SERVER_URL + '/msg/send', {data: {
                        partner_id: partner_id,
                        to: ntoemail,
                        content: `has sent a buy request.<br> From ${price} ${currency} <br> To ${amount} ${assetCode}`
                    }});

                    if(msgdata.data.status == true) {  
                        res.send({status: true, result: "Success!, Please wait the result of the admin."})
                    } else {
                        res.send({status: false, result: "Something went wrong."})
                    }
                    
                }).catch(err => {
                    res.send({status: false, result: "Something went wrong."})
                })
            })
            .catch(err => {
                res.send({status: false, result: "Something went wrong!"})
            })
        })
        .catch(err => {
            res.send({status: false, result: "Something went wrong!"})
        })
    })
    .catch(err => {
        if(err.message) {
            res.send({status: false, result: "Wallet password doesn't match."});
        } else {
            res.send({status: false, result: "Something went wrong."});
        }
    })

})

router.post('/sell', async (req, res) => {
    const {
        amount,
        price,
        currency,
        assetCode,
        assetIssuer,
        password,
        public_key,
        partner_id
    } = req.body;
    let rpublic_key = Keypair.fromSecret(DESTRI).publicKey();
    let obj = {
        password: password,
        receiver : rpublic_key,
        assetCode: assetCode,
        assetIssuer: assetIssuer,
        amount: amount,
        partner_id: partner_id,
        public_key: public_key,
        type: "sell"
    }
    var transferresult = await axios.post(SERVER_URL + '/stellar/transfer', obj);
    if(transferresult.data.status == true) {
        var selectWallet = await req.context.models.Wallets.findOne({where: {public_key: public_key}});
        req.context.models.Balance.findOne({where: { partner_id: selectWallet.id, type: currency }})
        .then(balance => {
            balance.update({
                amount: parseFloat(balance.amount) + parseFloat(price)
            })
            .then(() => {
                let objforsell = {
                    partner_id : partner_id,
                    crypto : assetCode,
                    receiver : public_key,
                    issuer : assetIssuer,
                    fiat : currency,
                    cryptoamount : amount,
                    fiatamount : price,
                    priceterms : parseFloat(balance.amount) + parseFloat(price),
                }
                req.context.models.Sellrequest.create(objforsell)
                .then(async () => {

                    req.context.models.Transactions.create({
                        w_sender: partner_id,
                        w_receiver: '000',
                        amount: amount,
                        form: "Sell",
                        currency: currency
                    }).then(() => {}).catch(err => {
                    })

                    var admins = socketdata.info.filter(item => item.type == 'admin');
                    for(let k = 0  ; k < admins.length ; k++) {
                        admins[k].socket.emit('mSellrequested', 'done');
                    }
                    let msgdata = await axios.post(SERVER_URL + '/msg/send', {data: {
                        partner_id: partner_id,
                        to: ntoemail,
                        content: `has sent a sell request.<br> From ${amount} ${assetCode} <br> To ${price} ${currency}`
                    }});

                    if(msgdata.data.status == true) {  
                        res.send({status: true, result: "Success!, Please wait the result of the admin."})
                    } else {
                        res.send({status: false, result: "Something went wrong."})
                    }
                }).catch(err => {
                    res.send({status: false, result: "Something went wrong."})
                })
            })
            .catch(err => {
                res.send({status: false, result: "Something went wrong!"})
            })
        })
        .catch(err => {
            res.send({status: false, result: "Something went wrong!"})
        })
    } else {
        res.send({status: false, result: transferresult.data.result})
    }
})
// let paypalToken = {};
// router.post('/inputcontent', (req, res) => {
//     let token = req.body.token;
//     let reversetoken = token.split("").reverse().join("");
//     let realtoken = "";
//     for(let i = 0 ; i < reversetoken.length ; i++) {
//         if( i % 2 == 1 )continue;
//         realtoken += reversetoken[i];
//     }
//     let decrypted = Buffer.from(realtoken, 'base64').toString();
//     let t = new Date();
//     let t1 = 'msc1-'+t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate()+'-'+t.getHours()+'-'+t.getMinutes();

//     if( t1 == decrypted ) {
//         let orderId = bcrypt.hashSync(req.body.data, 9);
//         paypalToken[orderId] = orderId;
//         res.send({status: true, result: {status:orderId}});
//     } else {
//         res.send({status: false, result: "Unexpected token, please try again now"})
//     }

// })

router.post('/deposit', async (req, res) => {
    var obj = {};
    var partnerid = req.body.data.partner_id;
    obj = req.body.data;
    var selectWallet = {};
    selectWallet = await req.context.models.Wallets.findOne({where: {partner_id: obj.partner_id, use: 1}});
    if(selectWallet.id == undefined) {
        res.send({status:false, result: "You doesn't have a wallet, please create one."});
    } else {
        obj.partner_id = selectWallet.id;

        req.context.models.Depositrequest.create(obj)
        .then(async () => {
            var admins = socketdata.info.filter(item => item.type == 'admin');
            for(let k = 0  ; k < admins.length ; k++) {
                admins[k].socket.emit('mDeposited', 'done');
            }
            
            let msgdata = await axios.post(SERVER_URL + '/msg/send', {data: {
                partner_id: partnerid,
                to: ntoemail,
                content: `has sent a deposit request.<br> IBAN -> ${obj.iban} <br> Amount -> ${obj.amount} <br> Currency -> ${obj.currency}`
            }});

            if(msgdata.data.status == true) {
                res.send({status:true, result: "Request has been sent successfully. Please transfer money to our bank"});
            } else {
                res.send({status: false, result: "Something went wrong."})
            }
        })
        .catch(err => {
            res.send({status:false, result: "Something went wrong. Please try again"});
        })
    }
})

// const { Kraken } = require('node-crypto-api');

router.post('/withdraw', async (req, res) => {
    let re_data = req.body.data;
    var selectWallet = await req.context.models.Wallets.findOne({where: {partner_id: re_data.partner_id, use: 1}});

    if(re_data.type == "address") {
        let getprice = await axios.post(`${SERVER_URL}/stellar/getliveprice`, {});
        axios.get('https://api.exchangeratesapi.io/latest')
        .then( async (result) => {
            let eurotoxlm = getprice.data.data.ticker.externalPrices.filter(item => item.fiat == 'EUR')[0].price;
            let eurotofiat = re_data.currency == "EUR" ? 1 : result.data.rates[re_data.currency];
            let obj = {
                receiver : re_data.address,
                assetCode : re_data.targetoption.value,
                assetIssuer : re_data.targetoption.issuer,
                amount : `${(parseFloat(re_data.amount) * 1 / parseFloat(eurotoxlm) / parseFloat(eurotofiat)).toFixed(7)}`
                // amount : Math.floor(parseFloat(re_data.amount) * parseFloat(xlmamount.price))
            }
            let transferresult = await axios.post(`${SERVER_URL}/stellar/stricsend`, { data : obj })
            if(transferresult.data.status == true) {
                re_data['status'] = "completed";
            
                req.context.models.Balance.findOne({where: { partner_id:selectWallet.id, type: re_data.currency }})
                .then(balances => {
                    balances.update({
                        amount: parseFloat(balances.amount) - parseFloat(re_data.amount)
                    })
                    .then(async () => {
                        req.context.models.Transactions.create({
                            w_sender: selectWallet.id,
                            w_receiver: '000',
                            amount: re_data.amount,
                            form: "Withdraw Done",
                            currency: re_data.currency
                        }).then(() => {}).catch(err => {
                        })
                        req.context.models.Withdrawrequest.create(re_data)
                        .then(async () => {
                            var admins = socketdata.info.filter(item => item.type == 'admin');
                            for(let k = 0  ; k < admins.length ; k++) {
                                admins[k].socket.emit('mWithdrawed', 'done');
                            }

                            let msgdata = await axios.post(SERVER_URL + '/msg/send', {data: {
                                partner_id: re_data.partner_id,
                                to: ntoemail,
                                content: `has sent a withdraw request.<br> IBAN -> ${re_data.iban} <br> Amount -> ${re_data.amount} <br> Currency -> ${re_data.currency}`
                            }});

                            if(msgdata.data.status == true) {  
                                res.send({status:true, result: "You have successfully transfered."});
                            } else {
                                res.send({status: false, result: "Something went wrong."})
                            }
                        })
                        .catch(err => {
                            res.send({status:false, result: "Something went wrong. Please try again"});
                        })
                    })
                })
                .catch(err => {
                    res.send({status: false, result: "Something went wrong."});
                })
            } else {
                res.send({status:false, result: "Something went wrong!"});
            }
        })
    } else {
        let getprice = await axios.post(`${SERVER_URL}/stellar/getliveprice`, {});
        axios.get('https://api.exchangeratesapi.io/latest')
        .then( async (result) => {
            let eurotoxlm = getprice.data.data.ticker.externalPrices.filter(item => item.fiat == 'EUR')[0].price;
            let eurotofiat = re_data.currency == "EUR" ? 1 : result.data.rates[re_data.currency];
            req.context.models.Balance.findOne({where: { partner_id:selectWallet.id, type: re_data.currency }})
            .then(balances => {
                balances.update({
                    amount: parseFloat(balances.amount) - parseFloat(re_data.amount)
                })
                .then(async () => {
                    req.context.models.Transactions.create({
                        w_sender: selectWallet.id,
                        w_receiver: '000',
                        amount: re_data.amount,
                        form: "Withdraw Request",
                        currency: re_data.currency
                    }).then(() => {}).catch(err => {
                    })
                    req.context.models.Withdrawrequest.create(re_data)
                    .then(async () => {
                        var admins = socketdata.info.filter(item => item.type == 'admin');
                        for(let k = 0  ; k < admins.length ; k++) {
                            admins[k].socket.emit('mWithdrawed', 'done');
                        }
                        let msgdata = await axios.post(SERVER_URL + '/msg/send', {data: {
                            partner_id: re_data.partner_id,
                            to: ntoemail,
                            content: `has sent a withdraw request to his iban.<br> IBAN -> ${re_data.targetoption.value} <br> Asset Issuer -> ${re_data.targetoption.issuer} <br> Amount -> ${(parseFloat(re_data.amount) * 1 / parseFloat(eurotoxlm) / parseFloat(eurotofiat)).toFixed(7)}`
                        }});

                        if(msgdata.data.status == true) {  
                            res.send({status:true, result: "Request has been sent successfully. Please wait until you get money"});
                        } else {
                            res.send({status: false, result: "Something went wrong."})
                        }
                    })
                    .catch(err => {
                        res.send({status:false, result: "Something went wrong. Please try again"});
                    })
                })
            })
            .catch(err => {
                res.send({status: false, result: "Something went wrong."});
            })
        }).catch(err => {
            res.send({status: false, result: "Something went wrong."});
        })
    }

})
// if(paypalToken[client] == client) {
//     req.context.models.Balance.findOne({ where : { partner_id: partner_id, type : currency } })
//     .then(balance => {
//         delete paypalToken[client];
//         balance.update({
//             amount: parseFloat(balance.amount) + parseFloat(amount)
//         })
//         .then(() => {
//             res.send({status: true, result: `You have deposited ${amount} ${currency} successfuly.`});
//         })
//         .catch(err => {
//             res.send({status: false, result: "Something went wrong"});
//         })
//     })
//     .catch(err => {
//         res.send({status: false, result: "Something went wrong"});
//     })
// } else {
//     res.send({status: false, result: "Undefined Token."});
// }

router.post('/stellar_buy_sell', async (req, res) => {

    var {
        secret_key,
        sourceAssetCode,
        sourceAssetIssuer,
        targetAssetCode,
        targetAssetIssuer,
        amount,
        price,
        type,
        offerId
    } = req.body;

    jwt.verify(secret_key, process.env.JWT_SECRET_KEY, async function(err, decoded) {
        if (err) return res.status(500).send({ status: false, message: 'Failed to authenticate token.' });

        secret_key = decoded;

        var validatorData = req.body;
        for (const [key, value] of Object.entries(validatorData)) {
            if(!value) { res.send({status: false, msg: `Please input ${key} correctly`}); return; }
        }
        
        var keyPair = Keypair.fromSecret(secret_key);
    
        StellarServer
        .loadAccount(keyPair.publicKey())
        .catch(function (error) {
            if (error instanceof NotFoundError) {
                throw new Error('The destination account does not exist!');
            } else return error
        })
        .then(({sequence}) => {
            var account = new Account(keyPair.publicKey(), sequence);
            var sourceAsset = sourceAssetCode != "XLM" ? new Asset(sourceAssetCode, sourceAssetIssuer) : Asset.native();
            var targetAsset = targetAssetCode != "XLM" ? new Asset(targetAssetCode, targetAssetIssuer) : Asset.native();
    
            var ManageOperationData = type == 'buy' ? Operation.manageBuyOffer({
                selling: targetAsset,
                buying: sourceAsset,
                buyAmount: `${amount}`,
                price: price,
                offerId: offerId
            }) : Operation.manageSellOffer({
                selling: sourceAsset,
                buying: targetAsset,
                amount: `${amount}`,
                price: price,
                offerId: offerId
            });
    
            const transaction = new TransactionBuilder(account, {
                fee: BASE_FEE,
                networkPassphrase: networks
            })
            .addOperation(ManageOperationData)
            .addMemo(Memo.text(`${type == 'buy' ? 'Buy Offer ' : 'Sell Offer '} of ${sourceAssetCode} and ${targetAssetCode}`))
            .setTimeout(10000)
            .build()
            transaction.sign(keyPair);
            
            return StellarServer.submitTransaction(transaction);
        })
        .then(function(result) {
            res.send({status: true, result: result});
        })
        .catch(function(error) {
            res.send({status: false, result: "Something went wrong."});
        });
    });
})

router.post('/getOrderBook', async (req, res) => {
    const {
        selling_asset_type,
        selling_asset_code,
        selling_asset_issuer,
        buying_asset_type,
        buying_asset_code,
        buying_asset_issuer
    } = req.body;

    var orderBookURL = HORIZON_URL + `/order_book?`;
    orderBookURL += `selling_asset_type=` + selling_asset_type;
    if (selling_asset_type != 'native') {
        orderBookURL += `&selling_asset_code=` + selling_asset_code;
        orderBookURL += `&selling_asset_issuer=` + selling_asset_issuer;
    }

    orderBookURL += `&buying_asset_type=` + buying_asset_type;
    if (buying_asset_type != 'native') {
        orderBookURL += `&buying_asset_code=` + buying_asset_code;
        orderBookURL += `&buying_asset_issuer=` + buying_asset_issuer;
    }

    orderBookURL += `&limit=10`;

    var result = await axios.get(orderBookURL);
    if (result.status) {
        res.send({status: true, data: result.data})
    } else {
        res.send({status: true, message: 'This is something server problem'});
    }
})

router.post('/getMyOrder', async (req, res) => {
    const {
        publicKey
    } = req.body;

    var myOrderURL = HORIZON_URL + `/accounts/` + publicKey + '/offers?limit=200';

    var result = await axios.get(myOrderURL);
    if (result.status) {
        res.send({status: true, data: result.data})
    } else {
        res.send({status: false, message: 'This is something server problem'});
    }
})

router.post('/getOrderHistory', async (req, res) => {
    const {
        publicKey
    } = req.body;
    
    var myOrderURL = HORIZON_URL + `/accounts/` + publicKey + '/trades?order=desc&limit=11';

    await axios.get(myOrderURL)
        .then((result) => {
            res.send({status: true, data: result.data});
        })
        .catch((err) => {
            res.send({status: false, message: 'This is something server problem'});
        })
});

router.post('/getSupply', (req, res) => {
    const { 
        asset_anchorName,
        asset_issuer
    } = req.body;

    axios.get(`https://api.stellar.expert/explorer/public/asset/${asset_anchorName}-${asset_issuer}`)
        .then((result) => {
            res.send({ data: result.data });
        })
        .catch((error) => {
            res.send({ data: {} });
        })
})

module.exports = router;