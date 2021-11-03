var nodemailer = require("nodemailer");
const { Router } = require('express');

const msgcontext1 = require("../config").msgcontext1;
const msgcontext2 = require("../config").msgcontext2;
const msgs = require("../config").msgs;
const notificationContent = require("../config").notificationContent;
const ntoemail = require("../config").ntoemail;

var smtpTransport = nodemailer.createTransport({
  // service: "gmail",
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
  }
});

const router = Router();

// https://hellenium.com/msg/send

router.post('/send', async (req, res) => {

	const {
		partner_id,
		to,
		subject,
		html,
		content
	} = req.body.data;

	req.context.models.Users.findByUserid(partner_id).then((user) => {
		if(user) {
			var msgdata = notificationContent;
		
			if(to == ntoemail) {
				msgdata.html = `${msgs.con1} ${user.firstname} ${user.lastname} ${msgs.con2} ${content}. ${msgs.con3}`;
			} else {
				msgdata.from = `${user.firstname} ${user.lastname}`;
				msgdata.to = to;
				msgdata.subject = subject;
				msgdata.html = html;
			}

			smtpTransport.sendMail(msgdata, function(error, response){
				if(error) {
					res.setHeader("Content-Type", "text/html");
					res.send({ status: false, result : error });
				} else {
					res.setHeader("Content-Type", "text/html");
					res.send({ status: true, result : 'Success' });
				}
			});
		} else {
			res.send({ status: false, result : error });
		}
	}).catch(error => {
		res.setHeader("Content-Type", "text/html");
		res.send({ status: false, result : error });
	})

});

module.exports = router;