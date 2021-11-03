const { Router } = require('express');

const router = Router();

router.post('/check', (req, res) => {
    var sessionKey = Buffer.from(req.body.tokenKey, 'base64').toString();
    req.context.models.Session.findOne({ where: { userid: sessionKey, verify_status: true } })
        .then(session => {
            var cur_date = new Date().getTime();
            var expireTime = parseInt(session.expire_time);
            if(cur_date > expireTime) {
                session.destroy();
                res.send({ status: false });
            } else {
                var expire_time = cur_date + parseInt(process.env.EXPIRE_TIME);
                session.update({ expire_time: expire_time })
                    .then(() => {
                        res.send({ status: true });
                    })
                    .catch((err) => {
                        res.send({ status: false })
                    })
            }
        })
        .catch(error => {
            res.send({status: false});
        })
});


module.exports = router;
