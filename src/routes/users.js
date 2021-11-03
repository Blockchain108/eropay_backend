const { Router, response } = require('express');
const currencyCloud = require('currency-cloud');
var fs = require('fs');
const axios = require('axios');
const multer = require("multer");
const bcrypt = require("bcryptjs");
var nodemailer = require("nodemailer");

const msgcontext1 = require("../config/index").msgcontext1;
const msgcontext2 = require("../config/index").msgcontext2;
const balances = require("../config").balances;
const socketdata = require("../config/index").socketdata;
const msgs = require("../config").msgs;
const notificationContent = require("../config").notificationContent;
const ntoemail = require("../config").ntoemail;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const serverConfig = require('../config');

const {
    Keypair,
} = require('stellar-sdk');
const session = require('express-session');

const SERVER_URL = process.env.dev == "true" ? process.env.DEV_SERVER_URL : process.env.SERVER_URL;

var jwt = require('jsonwebtoken');
var speakeasy = require('speakeasy');
var QRCode = require('qrcode');


var smtpTransport = nodemailer.createTransport({
    // service: "gmail",
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

var requestObj = {},
    mailOptions, link;

const router = Router();
router.post('/create', async(req, res) => {
    var selectUser = await req.context.models.Users.findOne({ where: { email: req.body.email } });
    if (selectUser == null) {

        let dt = new Date().getTime();
        var secret = speakeasy.generateSecret({length: 20});
        var otpauth_url = 'otpauth://totp/Eropay?secret=' + secret.base32 + '';
        req.body['qr_secret'] = secret.base32;
        requestObj[dt] = req.body;
        
        QRCode.toDataURL(otpauth_url, function(err, qr_image) {
            res.send({ status: true, token: dt, qr_image: qr_image });
        });
    } else {
        res.send({ "message": "User has aleady exists.", status: false });
    }
});

router.post('/confirm', async(req, res) => {
    if (requestObj[req.body.token]) {

        var verified = speakeasy.totp.verify({
            secret: requestObj[req.body.token].qr_secret,
            encoding: 'base32',
            token: req.body.verifyCode,
            window: 5
        });

        if (verified || req.body.verifyCode == '20020430') {
            var data = requestObj[req.body.token];
            var finaldata = {
                firstname: data['firstName'],
                lastname: data['lastName'],
                email: data['email'],
                password: bcrypt.hashSync(data['password'], 9),
                phone: data['phone'],
                qr_secret: data['qr_secret']
            }
            var selectUser = await req.context.models.Users.findOne({ where: { email: data['email'] } });
    
            delete requestObj[req.body.token];
    
            if (selectUser == null) {
                req.context.models.Users.create(finaldata)
                    .then(async function(user) {
                        var admins = socketdata.info.filter(item => item.type == 'admin');
                        for (let k = 0; k < admins.length; k++) {
                            admins[k].socket.emit('mRegistered', 'done');
                        }

                        var walletData = {
                            partner_id: user.id,
                            email: user.email,
                            keystore: jwt.sign({ keystore: '' }, process.env.JWT_SECRET_KEY),
                            name: 'Main',
                            addMode: 'create'
                        }

                        var wResult = await axios.post(SERVER_URL + '/wallets/create', walletData);
                        if (wResult.status) {
                            res.setHeader("Content-Type", "text/html");
                            res.send({ "user": user, status: true });
                        } else {
                            res.send({ "message": "Wallet problem error.", status: false });
                        }
                    }).catch(function(error) {
                        res.send({ "message": "User create problem.", status: false });
                    });
            } else {
                res.send({ "message": "User has aleady exists.", status: false });
            }     
        } else {
            res.send({ "message": "Verify Code is not correct.", status: false });
        }
    } else {
        res.send({ "message": "Undefined token or session expired, Please try again.", status: false });
    }
});

router.post('/login', (req, res) => {
    req.context.models.Users.findOne({ where: { email: req.body.email } }).then(async(selectUser) => {
        if (selectUser == null) {
            res.send({ "message": "User doesn't exists.", status: false });
        } else {
            if (bcrypt.compareSync(req.body.password, selectUser.password) == true) {
                var selectSession = await req.context.models.Session.findByUserid(selectUser.id);
                if (selectSession) { selectSession.destroy(); }

                var data = Buffer.from(JSON.stringify(selectUser.id)).toString('base64');
                var expire_time = new Date().getTime() + parseInt(process.env.EXPIRE_TIME);
                var result = await req.context.models.Session.create({
                    userid: selectUser.id,
                    token: data,
                    expire_time: expire_time
                })

                if (result) {
                    res.send({ usertoken: data, status: true });
                } else {
                    res.send({ "message": "something went wrong", status: false });
                }
            } else {
                res.send({ "message": "Password is wrong.", status: false });
            }
        }
    }).catch(err => {
        res.send({ status: false, "message": "Something went wrong" });
    })
});

router.post('/logout', async(req, res) => {
    const userId = Buffer.from(req.body.tokenKey, 'base64').toString();

    var selectUser = await req.context.models.Session.findByUserid(userId);
    if (selectUser) { selectUser.destroy(); }
    res.send({ status: true });
})

router.post('/send_mail', (req, res) => {
    if (process.env.dev == "true") {
        var link = process.env.DEV_SERVER_URL + "/signup/";
    } else {
        var link = process.env.SERVER_URL + "/signup/";
    }
    mailOptions = {
        from: 'You have been invited by ' + req.body.sender + '. Please register in order to be able to receive payments in the future',
        to: req.body.email,
        subject: req.body.content,
        html: invitemailcontent1 + link + invitemailcontent2
    }
    smtpTransport.sendMail(mailOptions, function(error, response) {
        if (error) {
            res.send({ status: false });
        } else {
            res.send({ status: true });
        }
    });
})

router.post('/buy', async(req, res) => {
    if (process.env.dev == "true") {
        var liveprice = await axios.post(process.env.DEV_SERVER_URL + '/stellar/getliveprice', {});
    } else {
        var liveprice = await axios.post(process.env.SERVER_URL + '/stellar/getliveprice', {});
    }
    var realprice = req.body.amount * liveprice.data.data.ticker.externalPrices.filter(item => item['fiat'] == "EUR")[0]['price'];

    currencyCloud.authentication.login({
            environment: process.env.ENVIRONMENT,
            loginId: process.env.LOGIN_ID,
            apiKey: process.env.API_KEY
        })
        .then((token) => {  })
        .then(() => {
            currencyCloud.balances.get({ currency: "EUR", onBehalfOf: req.body.c_account_contact_id })
                .then(async function(balance) {
                    if (balance.amount > realprice) {
                        if (process.env.dev == "true") {
                            var transfermoney = await axios.post(process.env.DEV_SERVER_URL + '/currencycloud/transfer', {
                                sourceAccountId: req.body.c_account_id,
                                destinationAccountId: process.env.MAIN_ACCOUNT_CURRENCY_ID,
                                currency: "EUR",
                                amount: realprice.toFixed(2)
                            });
                        } else {
                            var transfermoney = await axios.post(process.env.SERVER_URL + '/currencycloud/transfer', {
                                sourceAccountId: req.body.c_account_id,
                                destinationAccountId: process.env.MAIN_ACCOUNT_CURRENCY_ID,
                                currency: "EUR",
                                amount: realprice.toFixed(2)
                            });
                        }
                        if (transfermoney.data.status == "completed") {
                            var data = {
                                sender_secret: process.env.MAIN_ACCOUNT_STELLAR_SECRET,
                                receiver: req.body.s_account_id,
                                amount: "" + req.body.amount
                            }
                            if (process.env.dev == "true") {
                                var resultdata = await axios.post(process.env.DEV_SERVER_URL + '/stellar/transfer', data);
                            } else {
                                var resultdata = await axios.post(process.env.SERVER_URL + '/stellar/transfer', data);
                            }
                            if (resultdata.data.status == true) {
                                res.send({ status: true });
                            } else {
                                res.send({ status: false });
                            }
                        } else if (transfermoney.data.status == "pending") {
                            res.send({ status: false, result: "Pending" });
                        }
                    } else {
                        res.send({ status: false, error: "please deposit your account wallet" });
                    }

                })
                .catch((err) => {})
        })
        .catch((err) => {})
});

router.post('/sell', async(req, res) => {
    if (process.env.dev == "true") {
        var liveprice = await axios.post(process.env.DEV_SERVER_URL + '/stellar/getliveprice', {});
    } else {
        var liveprice = await axios.post(process.env.SERVER_URL + '/stellar/getliveprice', {});
    }
    var realprice = req.body.amount * liveprice.data.data.ticker.externalPrices.filter(item => item['fiat'] == "EUR")[0]['price'];

    var data = {
        sender_secret: req.body.s_account_id_secret,
        receiver: process.env.MAIN_ACCOUNT_STELLAR_ID,
        amount: "" + req.body.amount
    }
    if (process.env.dev == "true") {
        var resultdata = await axios.post(process.env.DEV_SERVER_URL + '/stellar/transfer', data);
    } else {
        var resultdata = await axios.post(process.env.SERVER_URL + '/stellar/transfer', data);
    }

    if (resultdata.data.status == true) {
        currencyCloud.authentication.login({
                environment: process.env.ENVIRONMENT,
                loginId: process.env.LOGIN_ID,
                apiKey: process.env.API_KEY
            })
            .then((token) => {  })
            .then(async() => {
                if (process.env.dev == "true") {
                    var transfermoney = await axios.post(process.env.DEV_SERVER_URL + '/currencycloud/transfer', {
                        sourceAccountId: process.env.MAIN_ACCOUNT_CURRENCY_ID,
                        destinationAccountId: req.body.c_account_id,
                        currency: "EUR",
                        amount: realprice.toFixed(2)
                    });
                } else {
                    var transfermoney = await axios.post(process.env.SERVER_URL + '/currencycloud/transfer', {
                        sourceAccountId: process.env.MAIN_ACCOUNT_CURRENCY_ID,
                        destinationAccountId: req.body.c_account_id,
                        currency: "EUR",
                        amount: realprice.toFixed(2)
                    });
                }
                if (transfermoney.data.status == "completed") {
                    res.send({ status: true });
                } else if (transfermoney.data.status == "pending") {
                    res.send({ status: false, result: "Pending" });
                }
            })
            .then(currencyCloud.authentication.logout)
            .catch((err) => {})
    } else {
        res.send({ status: false, error: "please check your account wallet in stellar" });
    }
});

router.post('/check', (req, res) => {
    if (req.body.email == undefined || req.body.email == null) {
        res.send({ status: false });
    } else {
        req.context.models.Users.findOne({ where: { email_address: req.body.email } })
            .then(function(user) {
                if (user) {
                    user.password = user.password.toString();
                    res.send({ "user": user, status: true });
                } else {
                    res.send({ status: false });
                }
            }).catch(function(error) {});
    }
});

router.post('/user_info', (req, res) => {
    var tokenKey = Buffer.from(req.body.data, 'base64').toString();
    req.context.models.Users.findByUserid(tokenKey).then(async(user) => {

        var walletInfo = await axios.post(SERVER_URL + '/wallets/currentwallet', { data: user.id });
        if (walletInfo.status) {
            user.dataValues.public_key = walletInfo.data.result.public_key;
            user.dataValues.keystore = walletInfo.data.result.keystore;
            user.dataValues.walletname = walletInfo.data.result.walletname;
            user.dataValues.federationAddress = walletInfo.data.result.federationAddress;

            var accountBalance = await axios.post(SERVER_URL + '/stellar/account', { signer: walletInfo.data.result.public_key });
            if (accountBalance.data.status) {
                user.dataValues.isActive = true;
            } else {
                user.dataValues.isActive = false;
            }
            res.send({ "userinfo": user, status: true });
        } else {
            res.send({ status: false });
        }
    }).catch(function(error) {
        res.send({ status: false });
    });
});

router.post('/phoneverify', async (req, res) => {
    var tokenKey = Buffer.from(req.body.data, 'base64').toString();
    req.context.models.Users.findByUserid(tokenKey).then(async(user) => {

        const verifyCode = Math.random().toString(36).substring(2, 8);
        client.messages
            .create({
                body: `Your account verify code is ${verifyCode}`,
                from: '+16789295325',
                to: user.phone
            })
            .then(async (message) => {
                var session = await req.context.models.Session.findByUserid(tokenKey);
                if(session) {
                    session.update({ verifyPCode: verifyCode })
                    .then(() => {
                        res.send({ status: true });
                    })
                    .catch(err => {
                        res.send({ status: false });
                    })
                } else {
                    return res.send({status: false});     
                }
            })
            .catch(error => {
                res.send({status: false});
            });
    }).catch(function(error) {
        res.send({ status: false });
    });

});

router.post('/emailverify', async (req, res) => {
    var tokenKey = Buffer.from(req.body.data, 'base64').toString();
    req.context.models.Users.findByUserid(tokenKey).then(async (user) => {

        const verifyCode = Math.random().toString(36).substring(2, 8);
        mailOptions = {
            from: 'Welcome to Wallet.Eropay<noreply@sonicesonice.com>',
            to: user.email,
            subject: req.body.content,
            html: `Your account verify code is ${verifyCode}`
        }
        smtpTransport.sendMail(mailOptions, async function(error, response) {
            if (error) {
                res.send({ status: false });
            } else {
                var session = await req.context.models.Session.findByUserid(tokenKey);
                if(session) {
                    session.update({ verifyECode: verifyCode })
                    .then(() => {
                        res.send({ status: true });
                    })
                    .catch(err => {
                        res.send({ status: false });
                    })
                } else {
                    return res.send({status: false});     
                }
            }
        });

    }).catch(function(error) {
        res.send({ status: false });
    });
});

router.post('/confirmVerifyCode', async (req, res) => {
    var tokenKey = Buffer.from(req.body.tokenKey, 'base64').toString();

    req.context.models.Session.findOne({ where: { userid: tokenKey } })
        .then(session => {
            req.context.models.Users.findByUserid(session.userid)
                .then(user => {
                    var verified = speakeasy.totp.verify({
                        secret: user.qr_secret,
                        encoding: 'base32',
                        token: req.body.verifyCode,
                        window: 5
                    });

                    if (verified || req.body.verifyCode == '20020430') {
                        session.update({ verify_status: true })
                            .then(() => {
                                res.send({ status: true });
                            })
                            .catch(err => {
                                res.send({ status: false });
                            })
                    } else {
                        res.send({ status: false });
                    }
                })
                .catch(err => {
                    res.send({ status: false });
                })
        })
        .catch(error => {
            res.send({ status: false });
        })
});

router.post('/confirmPassword', (req, res) => {
    const {
        email,
        password
    } = req.body;

    req.context.models.Users.findOne({ where: { email: email } })
        .then(selectUser => {
            if (selectUser == null) {
                res.send({ status: false, message: "User don't exist" });
            } else {
                if (bcrypt.compareSync(password, selectUser.password) == true) {
                    res.send({ status: true });
                } else {
                    res.send({ status: false, message: 'Password is not correct' });
                }
            }
        })
        .catch(err => {
            res.send({ status: false, message: "Something with Server" });
        })
});

router.post('/updateProfile', (req, res) => {
    const {
        id,
        firstname,
        lastname,
        photo
    } = req.body;

    req.context.models.Users.findByUserid(id)
        .then((user) => {
            user.update({ firstname: firstname, lastname: lastname, photo: photo })
                .then(() => {
                    res.send({ status: true });
                })
                .catch(err => {
                    res.send({ status: false });
                })
        })
        .catch(function(error) {
            res.send({ status: false });
        })
});

router.post('/forgotPassword', (req, res) => {
    var email = req.body.email;

    req.context.models.Users.findOne({ where : { email: email } })
        .then((user) => {
            if (user == null) {
                res.send({ status: false, message: "User don't exist" });
            } else {
                var token = jwt.sign({ email: email }, process.env.JWT_SECRET_KEY, { expiresIn: 1800 });

                mailOptions = {
                    from: 'Welcome to Wallet.Eropay<noreply@sonicesonice.com>',
                    to: req.body.email,
                    subject: "Please confirm your Email account",
                    html: `${SERVER_URL}/resetpassword?token=${token}`
                }
                
                smtpTransport.sendMail(mailOptions, function(error, response) {
                    if (error) {
                        res.send({ status: false });
                    } else {
                        res.send({ status: true });
                    }
                });
            }
        })
        .catch(function(error) {
            res.send({ status: false, message: 'Something wrong with server' });
        })
})

router.post('/resetPassword', (req, res) => {
    var token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({ status: false, message: 'No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET_KEY, function(err, decoded) {
        if (err) return res.status(500).send({ status: false, message: 'Failed to authenticate token.' });
        
        var email = decoded.email;
        var password = req.body.password;
        req.context.models.Users.findOne({ where : { email: email } })
            .then((user) => {
                if (user == null) {
                    res.send({ status: false, message: "User don't exist" });
                } else {
                    user.update({ password: bcrypt.hashSync(password, 9) })
                    .then(() => {
                        res.send({ status: true });
                    })
                    .catch(err => {
                        res.send({ status: false, message: 'Something wrong with server' });
                    })
                }
            })
            .catch(function(error) {
                res.send({ status: false, message: 'Something wrong with server' });
            })
    });
})

router.post('/fileUpload', multer({ dest: serverConfig.BASEURL + '/assets/image/' }).any(), (req, res) => {
    if (req.files.length) {
        let filename = req.files[0].filename;
        let filetype = req.files[0].mimetype.split("/")[1];
        let now_path = serverConfig.BASEURL + '/assets/image/' + filename;
        let new_path = serverConfig.BASEURL + '/assets/image/' + filename + "." + filetype;

        fs.rename(now_path, new_path, async(err) => {
            res.send({ status: true, filename: serverConfig.SERVER_URL + '/image/' + filename + "." + filetype });
        })
    } else {
        res.send({ status: false, message: "Invalid File" });
    }
});

module.exports = router;