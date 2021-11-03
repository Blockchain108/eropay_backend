const Sequelize = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE,
  process.env.DATABASE_USER,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    dialect: 'mysql',
    port: process.env.DATABASE_PORT,
    logging: false
  },

);

const models = {
  Users: sequelize.import( './users'),
  // Superadmin: sequelize.import( './superadmin'),
  Session: sequelize.import('./session'),
  // Beneficiaries: sequelize.import('./beneficiaries'),
  // Balance: sequelize.import('./balance'),
  // Organization_kyc: sequelize.import('./organization_kyc'),
  // Personal_kyc: sequelize.import('./personal_kyc'),
  Wallets: sequelize.import('./wallet'),
  // Depositrequest: sequelize.import('./depositrequest'),
  // Withdrawrequest: sequelize.import('./withdrawrequest'),
  // Buyrequest: sequelize.import('./buyrequest'),
  // Sellrequest: sequelize.import('./sellrequest'),
  // Exchangerequest: sequelize.import('./exchangerequest'),
  // Transactions: sequelize.import('./transactions'),
};

Object.keys(models).forEach(key => {
  if ('associate' in models[key]) {
    models[key].associate(models);
  }
});

module.exports = {
  models,
  sequelize
}