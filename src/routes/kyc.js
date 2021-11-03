const { Router } = require('express');
const router = Router();
const webhookHelper = require("./webhookController");

router.post('/personal_kyc_save', async (req, res) => {
    var request_data = req.body.data;
    // processWebhook(request_data.passbase);
    let getkyc = await req.context.models.Personal_kyc.findOne({ where: { partner_id : request_data.partner_id} });
    if(getkyc) {
        res.send({status: false, result: "You have submitted before."});
    } else {
        req.context.models.Personal_kyc.create(request_data)
        .then((result) => {
            req.context.models.Users.findOne({ where: { id: request_data.partner_id } })
            .then( (parent_record) => {
                if (parent_record) {
                    parent_record.update({
                        kyc_status: true
                    })
                    .then(function () {
                        res.send({status: true, result: result});
                    })
                } else {
                    res.send({status: false, result: "Database Error"});
                }
            })
        })
        .catch(err => {
            res.send({status: false, result: "Database Error"});
        })
    }
});

router.post('/personal_kyb_save', async (req, res) => {
    var request_data = req.body.data;
    // processWebhook(request_data.passbase);
    let getkyc = await req.context.models.Personal_kyc.findOne({ where: { partner_id : request_data.partner_id} });
    if(getkyc.passbase == "true") {
        let getkyb = await req.context.models.Organization_kyc.findOne({ where: { partner_id : request_data.partner_id} });
        if(getkyb) {
            res.send({status: false, result: "You have submitted before."});
        } else {
            req.context.models.Organization_kyc.create(request_data)
            .then((result) => {
                req.context.models.Users.findOne({ where: { id: request_data.partner_id } })
                .then( (parent_record) => {
                    if (parent_record) {
                        parent_record.update({
                            kyb_status: true
                        })
                        .then(function () {
                            res.send({status: true, result: result});
                        })
                    } else {
                        res.send({status: false, result: "Database Error"});
                    }
                })
            })
            .catch(err => {
                res.send({status: false, result: "Database Error"});
            })
        }
    } else {
        res.send({status: false, result: "You must be allowed from KYC"})
    }   
});

router.post('/kycCheck', (req, res) => {
    var request_data = req.body.data;
    req.context.models.Users.findOne({ where: { id : request_data, kyc_status: true} })
    .then(getkyc => {
        if(getkyc == null) { 
            res.send({status: false});
        } else {
            res.send({status: true});
        }
    })
    .catch(err => {
        res.send({status: false});
    })
});

router.post('/passbase-webhooks', (req, res) => {
    const webhook = webhookHelper.decryptWebhookIfNeeded(req);
    if(webhook.event == "VERIFICATION_COMPLETED") {
        res.status(200).send("Success");
    } else if (webhook.event == "VERIFICATION_REVIEWED") {
        res.status(200).send("Success");
    } else {
        res.status(500).send("False");
    }
});


module.exports = router;