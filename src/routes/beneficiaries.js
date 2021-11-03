const { Router } = require('express');
// const md5 = require('md5');
// const fetch = require("node-fetch");
const router = Router();

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

router.post('/getusers', async(req, res) => {
  sequelizex.query(`select ue.id as partner_id, ue.*, tw.* from tbl_users AS ue LEFT JOIN tbl_beneficiaries AS be ON be.beneficiary_id = ue.id LEFT JOIN tbl_wallets as tw ON ue.id = tw.partner_id WHERE be.partner_id='${req.body.id}'`, { type: sequelizex.QueryTypes.SELECT})
  .then(function(data) {
    res.send({result: data});
  })
});

router.post('/getusersexept', async(req, res) => {
  sequelizex.query(`select * from tbl_users where id not in ( select beneficiary_id from tbl_beneficiaries where partner_id = '${req.body.id}' ) and id != '${req.body.id}'`, { type: sequelizex.QueryTypes.SELECT})
  .then(function(data) {
    sequelizex.query(`select firstname, lastname, email, phone from tbl_users where id in ( select beneficiary_id from tbl_beneficiaries where partner_id = '${req.body.id}' )`, { type: sequelizex.QueryTypes.SELECT})
    .then((result) => {
      res.send({result: data, child: result});
    })
  })
});

router.post('/adduser', async(req, res) => {
  req.context.models.Beneficiaries.findAll({where : { partner_id: req.body.id, beneficiary_id: req.body.targetId }}).then(resultdata => {
    if(resultdata.length == 0) {
      req.context.models.Beneficiaries.create({ partner_id: req.body.id, beneficiary_id: req.body.targetId }).then(dt => {
        if(dt) {
          sequelizex.query(`select * from tbl_users where id not in ( select beneficiary_id from tbl_beneficiaries where partner_id = '${req.body.id}' ) and id != '${req.body.id}'`, { type: sequelizex.QueryTypes.SELECT})
          .then(function(data) {
              res.send({status: true, result: data});
          }).catch(err => {
            res.send({status: false, result: data});
          })
        } else {
          res.send({status: false, result: "Something went wrong!"});
        }
      })
    }
  })
});

module.exports = router;