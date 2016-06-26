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
PublishChannel = redis.createClient(redisCreds.port, redisCreds.url);
PublishChannel.auth(redisCreds.secret, function (err) {
    if (err) {
        console.log(err);
    }
});
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
    auth: "RjBCef0fkWWCw0tI8Jw0fvHQbBCGZJUvtE4Z14OlCAeKAWNRk5RHhQnYbqW03ityah2wiPVsA2qzX2Kz7E2l",
};


MessagingTools.sendPushToUsers = function (userids, message, data, type, callback) {

    var conditions = {
        pushToken: {
            $exists: true
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
                        "application": application || PushOptions.application,
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
                if (callback) {
                    console.log("[UserMessaging] Send push to %s users.", pushTokens.length);
                    return callback("[UserMessaging] Send push to "+pushTokens.length+" users.");
                }
            }
            else {
                // console.log(err);
                if (callback)
                    return callback.send(err);
            }

            return 'Done';
            // in this case, if the request takes more than 5 seconds
            // the callback will return a [Socket closed] error
        });
    })



}

MessagingTools.sendSocketMessageToUsers = function (ids, message) {
    PublishChannel.publish("socketServers", JSON.stringify({
        sockets: true,
        clients: msgData.recipients,
        payload: {
            type: "Message",
            data: {
                message: message
            }
        }
    }));
}

MessagingTools.SendMessageToInbox = function (msgData, callback) {

    //First create the message and save the instance in database
    var newMessage = new Message(msgData);

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

                    // TODO: Send Push Notification
                    if (msgData.push) {
                        MessagingTools.sendPushToUsers(msgData.recipients, msgData.msg, msgData.data, "new_message");
                    }

                    if (callback)
                        callback(err, model);
                }
            );
        }
    });

}



module.exports = MessagingTools;