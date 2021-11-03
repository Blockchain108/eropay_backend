const express = require('express');
const http = require("http");
const cors = require('cors');
const bodyParser = require('body-parser');

// .env allow
const dotenv = require('dotenv');
dotenv.config();

const mainModel = require("./src/models");
const sequelize = mainModel.sequelize;
const models = mainModel.models;
const routes = require('./src/routes');
const { socketdata } = require('./src/config');

// app configuration
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(async (req, res, next) => {
  req.context = {
    models
  };
  next();
});
app.get('/.well-known/stellar.toml', (req, res) => {

  res.setHeader('content-type', 'text/plain');
  if(process.env.dev == "true") {
    res.sendFile(__dirname + '/src/public/.well-known/dev_stellar.toml');
  } else {
    res.sendFile(__dirname + '/src/public/.well-known/stellar.toml');
  }
});
app.get('/schedule', (req, res) => {
  const file = `${__dirname}/src/public/schedule.xlsx`;
  res.download(file);
});

app.use(express.static(__dirname + '/src/public'));
app.use(express.static(__dirname + '/src/assets'));

app.use('/meme', routes.wallets);
app.use('/users', routes.users);
app.use('/stellar', routes.stellarapi);
app.use('/beneficiaries', routes.beneficiaries);
app.use('/session', routes.session);
app.use('/wallets', routes.wallets);
app.use('/kyc', routes.kyc);
app.use('/admin', routes.admin);
app.use('/currencies', routes.currencies);
app.use('/socket', routes.socket);
app.use('/msg', routes.msges);
app.use('/federation', routes.federation);

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/src/public/index.html');
});

const server = http.createServer(app);

// Socket Server Create
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.dev == "true" ? process.env.DEV_CLIENT_URL : process.env.SERVER_URL,
    methods: ["GET", "POST"]
  }
});

// Socket content
io.on("connection", (socket) => {
  socket.on('getid', (data) => {
    if(socketdata.info.filter(item => item.socketid == socket.id).length == 0) {
      let obj = {
        type: data.type,
        userid: data.userid,
        socketid: socket.id,
        socket: socket,
      }
      socketdata.info.push(obj);
    }
    io.to(socket.id).emit('sendid', socket.id);
  })

  socket.on("disconnect", () => {
    var socketdt = socketdata.info.filter(function (e) { return e.socketid != socket.id; });
    socketdata.info = socketdt;
  });

});

// Client info
let superadmininfo = {
  firstname: "Sotiris",
  lastname: "Melioumis",
  email: "stellar001@u-paid-m.com",
  password: "$2a$10$u8RkRoDL8tiNWzmdEk.HUOdrTl8JZ4vmxZl9.NUbSoHkyTblXu0ce"
};

// Tables create and start server
sequelize.sync({ force: false }).then(async () => {
  // sequelize.models.tbl_superadmins.findOne({ where : { email: superadmininfo.email } })
  // .then((data) => {
  //   if(data == null) {
  //     sequelize.models.tbl_superadmins.create(superadmininfo)
  //     .then(() => {
  //       console.log("Superadmin has created successfully.");
  //     }).catch(err => console.log(err))
  //   }
  // }).catch(err => console.log(err))

  server.listen(process.env.SERVER_PORT, () => console.log(`Listening on port ${process.env.SERVER_PORT}`));
});