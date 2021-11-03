const { Router } = require('express');
const router = Router();
const { socketdata } = require('../config');

router.post('/check', async (req, res) => {
    if(socketdata.info.filter(item => item.socketid == req.body.data.socketID).length > 0) {
        res.send({status: true});
    } else {
        res.send({status: false});
    }
});


module.exports = router;
