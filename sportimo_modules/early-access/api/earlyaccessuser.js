// Module dependencies.
var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    eau = mongoose.models.earlyAccessUser,
    shortid = require('shortid'),
    nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    needle = require('needle'),
    _ = require('lodash'),
    api = {};

shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

/*
========= [ CORE METHODS ] =========
*/
api.getAll = function (req, res) {
    var q = eau.find();
    q.sort({ "createdAt": -1 });
    q.exec(function (err, result) {
        if (!err)
            return res.send(result);
        else
            return res.status(500).send(err);
    });
};


// POST
api.addentry = function (req, res) {
    if (!req.body.email)
        return res.status(500).send("Email is mandatory. It is the only way to reach you.");

    // Create the entry model
    var entry = new eau(req.body);

    // Create the unique code
    entry.code = shortid.generate();

    entry.save(function (err, result) {
        if (!err)
            return res.send(result);
        else
            return res.status(500).send(err);
    });
};

// DELETE
api.deleteentry = function (req, res) {
    return eau.findById(req.params.eauid, function (err, entry) {
        return eau.remove(function (err) {
            if (err)
                return res.status(500).send(err);
            return res.send('Delete ' + req.params.eauid + ': Done');
        })

    });
};

/*
========= [ UTILITY METHODS ] =========
*/

api.consumecode = function (req, res) {
    var code = req.body.code;

    if (code == "bbug")
        return res.send("Code consumed successfully. Welcome to the Early Access!");

    if (!code)
        return res.status(500).send("The code propery is mandatory.");

    eau.findOne({ code: code }, function (err, result) {

        if (!result)
            return res.status(404).send("Code not found.");

        if (result.verified)
            return res.status(422).send("This Code has already been consumed.");

        result.verified = true;

        result.save(function (e, r) {
            return res.send("Code consumed successfully. Welcome to the Early Access!");
        })

    })
}

api.verifyCode = function (req, res) {
    var code = req.body.code;

    if (code == "bbug")
        return res.send("Code found. Proceed to Early Access.");

    if (!code)
        return res.status(500).send("The code propery is mandatory.");

    eau.findOne({ code: code }, function (err, result) {

        if (!result)
            return res.status(404).send("Code not found. Access Denied.");

        if (result.verified)
            return res.send("Code found. Proceed to Early Access.");

        return res.send("Code found but is not verified.");

    })
}

api.sendEmail = function (req, res) {

    if (!Array.isArray(req.body)) return res.status(500).send("Request body is not an array as it should.")

    var CodeEmails = req.body;
    var failedUsers = [];
    _.each(CodeEmails, function (emailToSend) {
        if (!emailToSend._id || !emailToSend.email || !emailToSend.code) {
            failedUsers.push(emailToSend);
            return;
        };
        var mailOptions = {
            from: 'info@sportimo.com', // sender address
            to: emailToSend.email, // list of receivers
            subject: 'Your code for Sportimo Early Access', // Subject line
            // text: 'Hello world 🐴', // plaintext body
            html: 'You are receiving this email because you requested an early access code. <br/><br/>Here is your code:<br/><b>' + emailToSend.code + '</b><br/><br/>'
        };
        api.sendEmailToUser(mailOptions, function (error, info) {
            if (error) {
                return console.log(error);
            }

            eau.findOneAndUpdate({ _id: emailToSend._id }, { email_sent: true }, function (e, r) {
                console.log(e);
                console.log(r);
            })

        });
    })

    return res.send({ failed: failedUsers });

}

var transporter = nodemailer.createTransport(smtpTransport({
    host: 'bedbugstudiocom.ipage.com',
    secure: false,
    port: 587,
    auth: {
        user: 'sender@bedbugstudio.com',
        pass: 'a21th21_A21'
    },
    tls: {
        rejectUnauthorized: false
    }
}));

api.sendEmailToUser = function (mailOptions, callback) {
    transporter.sendMail(mailOptions, function (error, info) {
        if (callback) {
            return callback(error, info);
        }
    });
}

/** Callback Helper
 * @param  {Function} - Callback Function
 * @param  {Object} - The Error Object
 * @param  {Object} - Data Object
 * @return {Function} - Callback
 */

var cbf = function (cb, err, data) {
    if (cb && typeof (cb) == 'function') {
        if (err) cb(err);
        else cb(false, data);
    }
};

/*
=====================  ROUTES  =====================
*/
router.get('/v1/early-access/', api.getAll);

router.post('/v1/early-access/', api.addentry);

router.route('/v1/early-access/:eauid')
    // 	.put(api.editentry)
    .delete(api.deleteentry);

router.post('/v1/early-access/action/sendemail', api.sendEmail);

/** The consume action allows the client to store the code and use it for access */
router.post('/v1/early-access/action/consume', api.consumecode);

/** The verify action allows the client to proceed if the code is valid */
router.post('/v1/early-access/action/verify', api.verifyCode);

module.exports = router;
