module.exports = {
    BASEURL: __dirname,
    SERVER_URL: process.env.dev == "true" ? "https://wallet.eropay.com" : "https://wallet.eropay.com",
}