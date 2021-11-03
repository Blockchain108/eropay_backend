const { Router } = require('express');
const queryString = require('query-string');

const router = Router();

router.get('*', async (req, res) => {
    const parsed = queryString.parse(req._parsedOriginalUrl.query);

    if (!parsed.type) { return res.send({ error: 'Parameter type is required.' }) };
    if (!parsed.q) { return res.send({ error: 'Parameter q is required.' }) };

    if (parsed.type == 'id') {
        var walletData = await req.context.models.Wallets.findOne({ where: { public_key: parsed.q } });
        if (walletData == null) {
            res.send({ error: 'Not found.' });
        } else {
            res.send({ federationAddress: walletData.federationAddress, publicKey: walletData.public_key });
        }
    } else if (parsed.type == 'name') {
        var walletData = await req.context.models.Wallets.findOne({ where: { federationAddress: parsed.q } });
        if (walletData == null) {
            res.send({ error: 'Not found.' });        
        } else {
            res.send({ federationAddress: walletData.federationAddress, publicKey: walletData.public_key });
        }
    } else {
        res.send({ data: 'Parameter type invalid.' });
    }
});

module.exports = router;