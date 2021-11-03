
// LOGIN_ID=111@mail.ru
// API_KEY=956b4840496e5bee64c63f8df2606eae5fd20404ee6e2a9867901356d5ba53c1
// ENVIRONMENT=demo


// import { Router } from 'express';
// import currencyCloud from 'currency-cloud';

// const router = Router();

// // accounts

// router.post('/createaccount', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.accounts.create(req.body)
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {
//         res.send(err);
//     })
// })

// // create contact
// router.post('/createcontact', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.contacts.create(req.body)
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {
//         res.send(err);
//     })
// })

// // Beneficiares

// router.post('/findbeneficiaries', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.beneficiaries.find()
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {
//         res.send(err);
//     })
// })

// router.post('/createbeneficiaries', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.beneficiaries.create(req.body)
//         .then((data) => {
//             res.send({result: 'success', data:data});
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {
//         res.send(err);
//     })
// })

// // balances

// router.post('/getbalances', (req, res) => {
//     if(!req.body.currency) {res.send({"error": "currency is required"})}
//     var obj = {
//         currency: req.body.currency, 
//     }
//     if(req.body.onBehalfOf) {
//         obj['onBehalfOf'] = req.body.onBehalfOf;
//     }
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.balances.get(obj)
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//         })
//     })
//     .catch((err) => {
//     })
// })

// router.post('/findbalances', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.balances.find()
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {})
//     })
//     .catch((err) => {})
// })

// router.post('/addbalance', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then(() => {
//         currencyCloud.balances.find()
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {})
//     })
//     .catch((err) => {})
// })

// router.post('/transfer', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.transfers.create(req.body)
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {})
//     })
//     .catch((err) => {})
// })

// router.post('/pay', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.payments.create(req.body)
//         .then(function(data) {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {})
//     })
//     .catch((err) => {})
// })

// // convert
// router.post('/convert', (req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.conversions.create(req.body)
//         .then((data) => {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {})
// })

// router.post('/find_transactions', async(req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.transactions.find()
//         .then((data) => {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {})
// });

// router.post('/create_payment', async(req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.payments.create(req.body)
//         .then((data) => {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {})
// });

// router.post('/find_payment', async(req, res) => {
//     currencyCloud.authentication.login({
//         environment: process.env.ENVIRONMENT,
//         loginId: process.env.LOGIN_ID,
//         apiKey: process.env.API_KEY
//     })
//     .then((token) => {})
//     .then(() => {
//         currencyCloud.payments.find()
//         .then((data) => {
//             res.send(data);
//         })
//         .then(currencyCloud.authentication.logout)
//         .catch((err) => {
//             res.send(err);
//         })
//     })
//     .catch((err) => {})
// });

// module.exports = router;