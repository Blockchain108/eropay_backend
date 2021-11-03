const { Router } = require('express');
const { StellarTomlResolver } = require('stellar-sdk');
const axios = require("axios");
const REALTIME_PRICE_URL = process.env.REALTIME_PRICE_URL;

const router = Router();

router.post('/getliveprice', async (req, res) => {
    try {

        const rp = require('request-promise');
        const requestOptions = {
          method: 'GET',
          uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
          qs: {
            'start': '1',
            'limit': '5000',
            'convert': 'USD'
          },
          headers: {
            'X-CMC_PRO_API_KEY': process.env.API_KEY_FOR_MARKET
          },
          json: true,
          gzip: true
        };
        
        rp(requestOptions).then(response => {
            res.send(response);
        }).catch((err) => {
        });



        // const rp = require('request-promise');
        // const requestOptions1 = {
        //     method: 'GET',
        //     uri: 'https://pro-api.coinmarketcap.com/v1/exchange/map',
        //     qs: {
        //         // 'id': '1',
        //         // 'symbol': 'BTC',
        //         // 'time_start': '021-05-07T10:14:22.401Z',
        //         // 'time_end': '021-05-07T12:14:22.401Z',
        //         // 'slug': 'bitcoin',    
        //         'start': '1',
        //         'limit': '5000',
        //         'sort': 'volume_24h',
        //         // 'sort_dir': 'desc',
        //         // 'matched_symbol': 'USD/BTC',
        //         // 'interval': '1h',
        //         // 'convert': 'EUR',
        //         // 'crypto_id': '1',
        //     },
        //     headers: {
        //         'X-CMC_PRO_API_KEY': process.env.API_KEY_FOR_MARKET
        //     },
        //     json: true,
        //     gzip: true
        // };
        
        // rp(requestOptions1).then(response => {
        //     return res.send(response);
        // }).catch((err) => {
        //     return res.send(err.message);
        // });


        // let tomlResult = await StellarTomlResolver.resolve(process.env.TOML_URL);
        // let currencies = tomlResult.CURRENCIES.filter(item => item.anchor_asset_type == "fiat");
    
        // // const rp = require('request-promise');
        // const requestOptions = {
        //     method: 'GET',
        //     uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
        //     qs: {
        //         'convert': 'EUR'
        //     },
        //     headers: {
        //         'X-CMC_PRO_API_KEY': process.env.API_KEY_FOR_MARKET
        //     },
        //     json: true,
        //     gzip: true
        // };
        // let prices = {};
        // let europrice = "";
        // for(let i = 0 ; i < currencies.length ; i++) {
        //     if(currencies[i].code != "EUR") {
        //         if(europrice == "") {
        //         europrice += currencies[i].code;
        //         } else {
        //         europrice += `,${currencies[i].code}`;
        //         }
        //     }

        //     requestOptions.qs.convert = currencies[i].code;
        //     let XLM_PRICE = await rp(requestOptions);
        //     prices[currencies[i].code] = XLM_PRICE.data.filter(item => item.symbol == "XLM")[0].quote[currencies[i].code].price;
        // }
        // var config = {
        //     method: 'get',
        //     url: 'https://api.coinranking.com/v2/coins?symbols[]=EUR',
        //     headers: { 
        //         'x-access-token': 'coinrankingdbf445d31d2ea0a5fae4382451c53d6fa84ea451e74605be'
        //     }
        // };
        
        // var redata = await axios(config);
        // let reuroprice = await axios.get(`${process.env.EUROPRICE}/latest?symbols=${europrice}`);
        // reuroprice = reuroprice.data.rates;
        // res.send({prices: prices, europrice : reuroprice});
    } catch(err) {
        res.status(500);
    }
});

router.post('/getLumensPrice', async (req, res) => {
    const rp = require('request-promise');
    const requestOptions = {
        method: 'GET',
        uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
        qs: {
            'convert': 'USD'
        },
        headers: {
            'X-CMC_PRO_API_KEY': process.env.API_KEY_FOR_MARKET
        },
        json: true,
        gzip: true
    };
    let AllPrice = await rp(requestOptions);
    res.send({ status: true, data: AllPrice.data.filter(item => item.symbol == "XLM") });
})

router.post('/getCurrencyChangeByPeriod', async (req, res) => {
    const {
        base_asset_type,
        base_asset_code,
        base_asset_issuer,
        counter_asset_type,
        counter_asset_code,
        counter_asset_issuer,
        start_time,
        end_time,
        resolution 
    } = req.body;

    var realtimePriceURL = `https://horizon.stellar.org/trade_aggregations?`;
    if (base_asset_type == 'native') {
        realtimePriceURL += `base_asset_type=native`;
    } else {
        realtimePriceURL += `base_asset_type=` + base_asset_type + `&base_asset_code=` + base_asset_code + `&base_asset_issuer=` + base_asset_issuer;
    }

    if (counter_asset_type == 'native') {
        realtimePriceURL += `&counter_asset_type=native`;
    } else {
        realtimePriceURL += `&counter_asset_type=` + counter_asset_type + `&counter_asset_code=` + counter_asset_code + `&counter_asset_issuer=` + counter_asset_issuer;
    }

    realtimePriceURL += `&start_time=` + start_time;
    realtimePriceURL += `&end_time=` + end_time;
    realtimePriceURL += `&resolution=` + resolution;
    realtimePriceURL += `&limit=200`;

    var result = await axios.get(realtimePriceURL);
    const priceData = result.data._embedded.records;
    res.send({data: priceData, status: true});
});

module.exports = router;