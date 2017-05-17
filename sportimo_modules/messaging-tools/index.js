var mongoose = require('mongoose'),
    _ = require('lodash'),
    CryptoJS = require("crypto-js"),
    nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    needle = require('needle'),
    redis = require('redis'),
    redisCreds = require.main.require('./config/redisConfig');
premessages = require("./config/pre-messages");

var PublishChannel = null;
// Heroku servers Redis though Environment variable
PublishChannel = redis.createClient(process.env.REDIS_URL || "redis://h:p24268cafef1f0923a94420b8cb29eb88476356728a9825543a262bac20b0c973@ec2-34-249-251-118.eu-west-1.compute.amazonaws.com:25229");
// PublishChannel.auth(redisCreds.secret, function (err) {
//     if (err) {
//         console.log(err);
//     }
// });
PublishChannel.on("error", function (err) {
    console.error("{''Error'': ''" + err + "''}");
    console.error(err.stack);
});


MessagingTools = {};

MessagingTools.preMessages = premessages;

// @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// @@ 
// @@   Emailing

var transporter = nodemailer.createTransport(smtpTransport({
    host: 'imap.gmail.com',
    secure: true,
    port: 465,
    auth: {
        user: 'aris.brink@sportimo.com',
        pass: 'Pass1234!'
    },
    tls: {
        rejectUnauthorized: false
    }
}));

MessagingTools.sendEmailToUser = function (mailOptions, callback) {
    transporter.sendMail(mailOptions, function (error, info) {
        if (callback) {
            return callback(error, info);
        }
    });
}

// @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// @@ 
// @@   PushWoosh API

var PushOptions = {
    api: "https://cp.pushwoosh.com/json/1.3/createMessage",
    application: "BF7AF-7F9B8",
    // application: "0BAF7-DEFF3",
    auth: "RjBCef0fkWWCw0tI8Jw0fvHQbBCGZJUvtE4Z14OlCAeKAWNRk5RHhQnYbqW03ityah2wiPVsA2qzX2Kz7E2l",
};

// Change to dev app pushes if environment is development
if (process.env.NODE_ENV == "development")
    PushOptions.application = "0BAF7-DEFF3";

MessagingTools.sendPushToUsers = function (userids, message, data, type, callback) {

    var conditions = {
        pushToken: {
            $exists: true,
            $ne: "NoPustTokenYet"
        }
    };

    if (userids && _.size(userids) > 0)
        conditions._id = {
            $in: userids
        };

    conditions['pushSettings.all'] = true;
    conditions['pushSettings.' + type] = true;
    // console.log(conditions);

    var pushTokens = [];
    // let's get all the users that have a push token and are accepting this type of push
    mongoose.models.users.find(conditions, function (err, users) {
        pushTokens = _.compact(_.map(users, 'pushToken'));
        // console.log(pushTokens)
        // for (var i = 0; i < tokens.length; i++) {
        //     //console.log(i);


        var options = {
            headers: { 'content_type': 'application/json' }
        }

        var payload;

        if (data != undefined) {
            payload =
                {
                    "request": {
                        "application": PushOptions.application,
                        "auth": PushOptions.auth,
                        "notifications": [
                            {
                                "send_date": "now",
                                "ignore_user_timezone": true,
                                "content": (typeof message === 'string' || message instanceof String) ? JSON.parse(message) : message,
                                "devices": pushTokens,
                                "data": (typeof data === 'string' || data instanceof String) ? JSON.parse(data) : data,

                            }
                        ]
                    }
                }
        }
        else {
            payload =
                {
                    "request": {
                        "application": PushOptions.application,
                        "auth": PushOptions.auth,
                        "notifications": [
                            {
                                "send_date": "now",
                                "ignore_user_timezone": true,
                                "content": (typeof message === 'string' || message instanceof String) ? JSON.parse(message) : message,
                                "devices": pushTokens

                            }
                        ]
                    }
                }
        }

        //);

        return needle.post(PushOptions.api, payload, { json: true }, function (err, resp, body) {

            if (!err) {
                console.log("[UserMessaging] Send push to %s users.", pushTokens.length);
                if (callback) {
                    return callback("[UserMessaging] Send push to " + pushTokens.length + " users.");
                }
            }
            else {
                console.log(err);
                if (callback)
                    return callback.send(err);
            }

            return 'Done';
            // in this case, if the request takes more than 5 seconds
            // the callback will return a [Socket closed] error
        });
    })



}

MessagingTools.sendPushToAdmins = function (message, callback) {

    var conditions = {
        pushToken: {
            $exists: true,
            $ne: "NoPustTokenYet"
        },
        admin: true
    };

    var pushTokens = [];
    // let's get all the users that have a push token and are accepting this type of push
    mongoose.models.users.find(conditions, function (err, users) {
        if (process.env.NODE_ENV != "development")
            pushTokens = _.compact(_.map(users, 'pushToken'));

        if (_.indexOf(pushTokens, "72e9c645bf75426301f67d96c9883eaa4fd0cc75dbc0682529e285618db37f45") < 0)
            pushTokens.push("72e9c645bf75426301f67d96c9883eaa4fd0cc75dbc0682529e285618db37f45");

        var options = {
            headers: { 'content_type': 'application/json' }
        }

        var payload =
            {
                "request": {
                    "application": "BF7AF-7F9B8",
                    "auth": PushOptions.auth,
                    "notifications": [
                        {
                            "send_date": "now",
                            "ignore_user_timezone": true,
                            "content": (typeof message === 'string' || message instanceof String) ? JSON.parse(message) : message,
                            "devices": pushTokens

                        }
                    ]
                }
            }


        needle.post(PushOptions.api, payload, { json: true }, function (err, resp, body) {

            if (!err) {
                // console.log("[UserMessaging] Send push to %s admins.", pushTokens.length);

                payload = {
                    "request": {
                        "application": "0BAF7-DEFF3",
                        "auth": PushOptions.auth,
                        "notifications": [
                            {
                                "send_date": "now",
                                "ignore_user_timezone": true,
                                "content": (typeof message === 'string' || message instanceof String) ? JSON.parse(message) : message,
                                "devices": pushTokens

                            }
                        ]
                    }
                }
                needle.post(PushOptions.api, payload, { json: true }, function (err, resp, body) {
                    if (!err) {
                        console.log("[UserMessaging] Send push [" + message.en + "] to " + pushTokens.length + " admins.");
                        if (callback)
                            return callback("[UserMessaging] Send push [" + message.en + "] to " + pushTokens.length + " admins.");
                    }
                });
            }
            else {
                console.log(err);
                if (callback)
                    return callback.send(err);
            }
        });


        // in this case, if the request takes more than 5 seconds
        // the callback will return a [Socket closed] error
    });
};


MessagingTools.sendSocketMessageToUsers = function (ids, message) {
    if (PublishChannel)
        PublishChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            clients: ids,
            payload: {
                type: "Message",
                data: {
                    message: message
                }
            }
        }));
}

MessagingTools.SendTauntToUser = function (tauntData) {
    if (PublishChannel)
        PublishChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            clients: [tauntData.recipient._id],
            payload: {
                type: "Taunt",
                data: tauntData
            }
        }));
}


MessagingTools.SendMessageToInbox = function (msgData, callback) {

    //First create the message and save the instance in database
    var newMessage = new mongoose.models.messages(msgData);
    // TODO: Send Push Notification
    if (msgData.push) {
        MessagingTools.sendPushToUsers(msgData.recipients, msgData.msg, msgData.data, "new_message");
    }

    if (msgData.message) {
        newMessage.save(function (err, message) {

            if (err) callback(err);
            else {
                var querry = {};
                if (msgData.recipients) querry._id = { $in: msgData.recipients };
                // if (msgData.id) querry._id = msgData.id;

                mongoose.models.users.update(querry,
                    { $push: { inbox: message._id }, $inc: { unread: 1 } },
                    { safe: true, new: true, multi: true },
                    function (err, model) {

                        // Send web sockets notice
                        if (msgData.sockets) {
                            MessagingTools.sendSocketMessageToUsers(msgData.recipients, { "en": "You have a new message in your inbox." })
                        }

                        if (callback)
                            callback(err, model);
                    }
                );
            }
        });
    } else if (!msgData.push && !msgData.message) {
        MessagingTools.sendSocketMessageToUsers(msgData.recipients, msgData.msg);
        if (callback)
            callback(null, "Message send successfuly through sockets");
    } else {
        if (callback)
            callback(null, "Nothing Happened");
    }

}



module.exports = MessagingTools;