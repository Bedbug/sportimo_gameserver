// =======================
// get the packages we need 
// =======================
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');

var jsonwebtoken = require('jsonwebtoken'); // used to create, sign, and verify tokens
var jwtDecode = require('jwt-decode');
var config = require('./config'), // get our config file
    User = mongoose.models.users, // get our mongoose model
    Message = require('../models/message'), // get our mongoose model
    UserActivities = mongoose.models.useractivities, // get our mongoose model
    Scores = mongoose.models.scores,
    Achievements = mongoose.models.achievements,
    CryptoJS = require("crypto-js");
_ = require('lodash');

var needle = require('needle');

var MessagingTools = require.main.require('./sportimo_modules/messaging-tools');

var app = null;
var tools = {};


try {
    app = require('./../../server');
    module.exports = tools;
    // console.log(app.PublishChannel)
} catch (ex) {
    // Start server
    app = module.exports = exports.app = express.Router();
    var port = process.env.PORT || 3000;
    app.listen(port, function () {
        console.log('Express server listening on port %d in %s mode', port, app.get('env'));
    });
}

app.set('superSecret', config.secret); // secret variable


app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Access-Token");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});


// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


// ================
// API ROUTES -------------------
// ================
app.get('/v1/users/setup', function (req, res) {

    // create a sample user
    var nick = new User({
        name: 'Nick Cerminara',
        username: 'nickG',
        password: 'password',
        admin: true
    });

    // save the sample user
    nick.save(function (err) {
        if (err) throw err;

        console.log('User saved successfully');
        res.json({ success: true });
    });
});



// get an instance of the router for api routes
var apiRoutes = express.Router();



// route middleware to verify a token
var jwtMiddle = function (req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['x-access-token'];

    // decode token
    if (token) {

        // verifies secret and checks exp
        jsonwebtoken.verify(token, app.get('superSecret'), function (err, decoded) {
            if (err) {
                return res.json({ success: false, message: 'Failed to authenticate token.' });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });

    } else {

        // if there is no token
        // return an error
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });

    }
};

// Route to create a new user (POST /v1/users)
apiRoutes.post('/v1/users', function (req, res) {
    // save the sample user
    var newUser = new User(req.body);
    newUser.save(function (err, user) {
        if (err) res.status(500).send(err);
        else {
            var token = jsonwebtoken.sign(user, app.get('superSecret'), {
                expiresIn: 1440 * 60 // expires in 24 hours
            });
            user = user.toObject();
            user.token = token;
            user.success = true;
            // return the information including token as JSON
            res.status(200).send(user);
        }
    });
});

//Route to authenticate a user (POST /v1/users/authenticate)
apiRoutes.post('/v1/users/authenticate/social', function (req, res) {

    // find the user
    User.findOne({
        social_id: req.body.social_id
    }, function (err, user) {

        if (err) throw err;

        if (!user) {
            res.json({ success: false, message: 'Authentication failed. User not found.' });
        } else if (user) {
            user = user.toObject();
            var token = jsonwebtoken.sign(user, app.get('superSecret'), {
                expiresIn: 1440 * 60 // expires in 24 hours
            });

            delete user.rankingStats;

            user.token = token;
            user.success = true;
            // return the information including token as JSON
            res.status(200).send(user);

        }

    });
});

//Route to authenticate a user (POST /v1/users/authenticate)
apiRoutes.post('/v1/users/authenticate', function (req, res) {

    // find the user
    User.findOne({
        username: req.body.username
    }, function (err, user) {

        if (err) throw err;

        if (!user) {
            res.json({ success: false, message: 'Authentication failed. User not found.' });
        } else if (user) {

            // check if password matches
            user.comparePassword(req.body.password, function (err, isMatch) {
                if (!isMatch || err) {
                    res.json({ success: false, message: 'Authentication failed. Wrong password.' });
                } else {

                    // if user is found and password is right
                    // create a token
                    user = user.toObject();
                    var token = jsonwebtoken.sign(user, app.get('superSecret'), {
                        expiresIn: 1440 * 60 // expires in 24 hours
                    });

                    delete user.rankingStats;

                    user.token = token;
                    user.success = true;
                    // return the information including token as JSON
                    res.status(200).send(user);
                }
            });
        }

    });
});

// Route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/v1/users', jwtMiddle, function (req, res) {
    User.find({}, function (err, users) {
        res.json(users);
    });
});

// Route to return specific user (GET http://localhost:8080/api/users)
apiRoutes.get('/v1/users/:id', jwtMiddle, function (req, res) {
    // apiRoutes.get('/v1/users/:id',  function (req, res) {
    var token = req.body.token || req.query.token || req.headers['x-access-token'];

    var decoded = {};

    if (jwtDecode && token)
        decoded = jwtDecode(token);
    console.log(decoded);
    if (decoded.admin) {
        // Full user Profile
        User.findById(req.params.id, function (err, user) {
            res.json(user);
        });
    }
    else {
        // Mini Profile
        User.findById(req.params.id, '-inbox', function (err, user) {
            res.json(user);
        });
    }
});

apiRoutes.get('/v1/users/:id/reset', function (req, res) {

    User.findById(req.params.id, function (err, user) {
        var token = CryptoJS.SHA1(req.params.id + user.username + Date.now()).toString();
        user.resetToken = token;
        user.save(function (err, result) {
            if (!err)
                res.json({ "success": true, "text": "Reset email will be sent soon but anyway since I see you are in a hurry, here is your...", "token": token });
            else
                res.json({ "success": false });
        })
    });
});

apiRoutes.post('/v1/users/reset', function (req, res) {

    User.findOne({ email: req.body.email }, function (err, user) {
        var token = CryptoJS.SHA1(req.params.id + user.username + Date.now()).toString();
        user.resetToken = token;
        user.save(function (err, result) {
            if (!err) {
                res.json({ "success": true, "redirect": false, "text": { en: "An email with a link to reset your password will be sent to you shortly." }, "token": token });
                // setup e-mail data with unicode symbols
                var mailOptions = {
                    from: 'info@sportimo.com', // sender address
                    to: req.body.email, // list of receivers
                    subject: 'Reset link from Sportimo ✔', // Subject line
                    // text: 'Hello world 🐴', // plaintext body
                    html: '<b>Here is your link:</b><br>http://sportimo_reset_password.mod.bz/#/reset/' + token // html body
                };

                // send mail with defined transport object
                MessagingTools.sendEmailToUser(mailOptions, function (error, info) {
                    if (error) {
                        return console.log(error);
                    }
                    console.log('Message sent: ' + info.response);
                });
            } else
                res.json({ "success": false });
        })
    });
});


apiRoutes.get('/v1/users/:utoken/token', function (req, res) {
    User.findOne({ resetToken: req.params.utoken }, function (err, user) {
        res.json(user);
    })
});

apiRoutes.post('/v1/users/:utoken/password/reset', function (req, res) {
    User.findOne({ resetToken: req.params.utoken }, function (err, user) {
        user.password = req.body.password;
        user.save(function (err, response) {
            if (err)
                res.send({ success: false })
            else
                res.send({ success: true });
        })
    })
});

apiRoutes.post('/v1/users/token', function (req, res) {
    if (req.body.token == null)
        return res.status(404).send();

    User.findOne({ resetToken: req.body.token }, function (err, user) {
        res.json(user);
    })
});


// Allowed mini user obejct
apiRoutes.get('/v1/user/:id', function (req, res) {

    User.findById(req.params.id, '-inbox', function (err, user) {
        res.json(user);
    });

});

// Update specific user (PUT /v1/users)
apiRoutes.put('/v1/users/:id', function (req, res) {

    if (req.body["picture"] != null)
        Scores.update({ user_id: req.params.id }, { $set: { 'pic': req.body["picture"] } }, { multi: true }, function (err, result) {
            console.log("users.index.js:320 Pic changed");
        });

    User.findOneAndUpdate({ _id: req.params.id }, req.body, function (err) {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send({ success: true });
        }
    });
});

//Get user messages
apiRoutes.get('/v1/users/update/achievements/:recalculate', function (req, res) {
    var recalc = req.params.recalculate;
    Achievements.find({}, function (err, achievs) {
        var achievsCount = achievs.length;

        _.each(achievs, function (achievement) {
            User.update({ 'achievements._id': achievement._id }, { $set: { 'achievements.$.text': achievement.text, 'achievements.$.title': achievement.title, 'achievements.$.total': achievement.total, 'achievements.$.value': achievement.value } }, { multi: true }, function (err) {
                User.update({ 'achievements._id': { '$ne': achievement._id } }, { $addToSet: { 'achievements': achievement } }, { multi: true }, function (err) {
                    achievsCount--;
                    if (achievsCount == 0)
                        recalculate();
                });
            });
        })
        if (err) {
            return res.status(500).send(err);
        } else {
            return res.send({ success: true });
        }
    })

    function recalculate() {

        if (recalc == "true") {
            console.log("Recalculating: " + req.params.recalculate);
            User.find({}, function (err, allUsers) {
                _.each(allUsers, function (eachUser) {
                    var total = _.sumBy(eachUser.achievements, function (o) {
                        return _.multiply(o.total, o.value);
                    });

                    var has = _.sumBy(eachUser.achievements, function (o) {
                        if (o.has == o.total) o.completed = true; else o.completed = false;
                        return _.multiply(o.has, o.value);
                    });


                    eachUser.level = has / total;
                    eachUser.save(function (err, result) { });
                })
            })
        }
    }


});

// Search users abses on string and return list of mini user objects
apiRoutes.get('/v1/users/search/:val', function (req, res) {
    User.find({ $or: [{ "username": { "$regex": req.params.val, "$options": "i" } }, { "email": { "$regex": req.params.val, "$options": "i" } }] })
        .select('username email')
        .limit(20)
        .exec(function (err, docs) {
            res.send(docs);
        })
});

//Sends message to routers
apiRoutes.post('/v1/users/messages', function (req, res) {

    return MessagingTools.SendMessageToInbox(req.body, function (err, data) {
        if (!err)
            return res.send(data);
        else
            return res.sendStatus(500).send(err);
    })

});

//Get user messages
apiRoutes.get('/v1/users/:id/messages', function (req, res) {

    var q = User.findById(req.params.id);
    q.populate('inbox', '-recipients');

    q.exec(function (err, user) {
        if (!err) {
            res.status(200).send(user.inbox);

            user.unread = 0;
            user.save(function (err, result) {
                if (err) console.log(err);
            });
        } else
            res.status(500).send(err);
    })
});

// Delete message from user
apiRoutes.delete('/v1/users/:id/messages/:mid', function (req, res) {

    var q = User.findById(req.params.id);

    q.exec(function (err, user) {
        if (!err) {

            user.inbox = _.without(user.inbox, req.params.mid);
            res.status(200).send(user.inbox);

            user.unread = 0;
            user.save(function (err, result) {
                if (err) console.log(err);
                res.status(200).send(result);
            });
        } else
            res.status(500).send(err);
    })
});

//Get user messages
apiRoutes.get('/v1/users/:id/unread', function (req, res) {

    var q = User.findById(req.params.id);
    q.select('unread');
    q.exec(function (err, result) {
        // console.log(unreadCount);
        if (!err) {
            res.status(200).send({ "unread": result.unread });
        } else
            res.status(500).send(err);
    })


});

// tools.SendMessageToInbox = function (msgData, callback) {

//     //First create the message and save the instance in database
//     var newMessage = new Message(msgData);

//     // TODO: Maybe we should remove recipients property from model to save wasted space
//     if (msgData.message)
//         newMessage.save(function (err, message) {

//             if (err) callback(err);
//             else {
//                 var querry = {};
//                 if (msgData.recipients) querry._id = { $in: msgData.recipients };
//                 // if (msgData.id) querry._id = msgData.id;

//                 User.update(querry,
//                     { $push: { inbox: message._id }, $inc: { unread: 1 } },
//                     { safe: true, new: true, multi: true },
//                     function (err, model) {

//                         // Send web sockets notice
//                         if (msgData.sockets) {
//                             app.PublishChannel.publish("socketServers", JSON.stringify({
//                                 sockets: true,
//                                 clients: msgData.recipients,
//                                 payload: {
//                                     type: "Message",
//                                     data: {
//                                         message: { "en": "You have a new message in your inbox." }
//                                     }
//                                 }
//                             }));
//                         }

//                         // TODO: Send Push Notification
//                         if (msgData.push) {
//                             MessagingTools.sendPushToUsers(msgData.recipients, msgData.msg, msgData.data, "new_message");
//                         }

//                         callback(err, model);
//                     }
//                 );




//             }
//         });

// }


// This is a route used by clients to set the eligility of the user for match prizes 
// apiRoutes.get('/v1/users/:uid/match/:mid/prizeseligible/:prelbool', jwtMiddle, function (req, res) {
apiRoutes.get('/v1/users/:uid/match/:mid/prizeseligible/:prelbool', function (req, res) {
    Scores.findOne({ game_id: req.params.mid, user_id: req.params.uid }, function (err, scoreEntry) {
        scoreEntry.prize_eligible = req.params.prelbool;
        scoreEntry.save(function (err, result) {
            res.send(result);
        })
    });
});

// @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// @@ 
// @@   User Taunts

// This is a route used by clients to taunt other users 
apiRoutes.get('/v1/taunts', function (req, res) {
    mongoose.models.taunts.find({}, function (err, result) {
        if (!err) {
            res.send(result);
        }
        else
            res.status(500).send(err);
    })
});

// This is a route used by clients to taunt other users 
apiRoutes.post('/v1/users/:uid/taunt', function (req, res) {
    var tauntData = req.body;
    
    if(!tauntData.sender._id || tauntData.recipient._id)
        return res.status(500).send("Sender and/or recipient is missing.");
    
    var q = User.findById(req.params.uid);
    q.exec(function (err, result) {
        if (!err) {

            var exists = _.find(result.blockedusers, function (o) {
                return o === tauntData.sender._id;
            });

            // Check first if the user is blocked
            if (exists)
                return res.status(500).send("The user has blocked your taunts");
            else {
                var usertaunt = mongoose.models.usertaunts(tauntData);

                usertaunt.save(function (err, result) {
                    if (!err) {
                        MessagingTools.SendTauntToUser(tauntData);
                        res.send(result);
                    }
                    else
                        res.status(500).send(err);
                })
            }
        }
    });
});

apiRoutes.get('/v1/users/:uid/block/:buid/:state', function (req, res) {
    var q = User.findById(req.params.uid);

    q.exec(function (err, result) {
        if (!err) {

            // if set block to true
            if (req.params.state === "true") {
                var exists = _.find(result.blockedusers, function (o) {
                    return o === req.params.buid;
                });
                if (exists)
                    return res.status(500).send("User already blocked");
                else
                    result.blockedusers.push(req.params.buid);
            } else {
                result.blockedusers = _.without(result.blockedusers, req.params.buid);
            }

            result.save(function (err, result) {

                if (!err)
                    return res.send({ "blocked": req.params.state })
                else
                    return res.status(500).send(err);
            })


        } else
            res.status(500).send(err);
    })



});



// @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// @@ 
// @@   User Activities

apiRoutes.get('/v1/users/activity/:matchid', function (req, res) {

    UserActivities.find({ room: req.params.matchid })
        .populate('user')
        // .populate('away_team', 'name logo')
        .exec(function (err, users) {
            // console.log(req.params.matchid);
            res.send(users);
        });
});


apiRoutes.get('/v1/users/:uid/stats', function (req, res) {
    var stats = {};
    User.findById(req.params.uid)
        .select("username picture level stats achievements rankingStats")
        .populate({
            path: 'rankingStats.bestRankMatch',
            select: 'home_team away_team home_score away_score start',
            model: 'scheduled_matches',
            populate: {
                path: 'home_team away_team',
                model: 'teams',
                select: 'name logo'
            }
        })
        .exec(function (err, result) {
            if (err)
                return res.status(500).send(err);
            stats.user = result;

            Scores.find({ user_id: req.params.uid, score: { $gt: 0 } })
                .sort({ score: -1 })
                .populate({
                    path: 'game_id',
                    model: 'scheduled_matches',
                    select: 'home_team away_team home_score away_score start',
                    populate: {
                        path: 'home_team away_team',
                        model: 'teams',
                        select: 'name logo'
                    }
                })
                .limit(1)
                .exec(function (err, bestscore) {
                    if (!err && bestscore[0]) {
                        stats.user.rankingStats.bestScoreMatch = bestscore[0].game_id;
                        stats.user.rankingStats.bestScore = bestscore[0].score;
                    }

                    Scores.find({ user_id: req.params.uid, score: { $gt: 0 } })
                        .limit(5)
                        .sort({ lastActive: -1 })
                        // .populate('away_team', 'name logo')
                        .exec(function (err, scores) {
                            if (err)
                                return res.status(500).send(err);

                            stats.lastmatches = _.map(scores, 'score');

                            var sum = 0;
                            var count = 0;
                            for (var i = 0; i < stats.lastmatches.length; ++i) {
                                sum += stats.lastmatches[i];
                                ++count;
                            }
                            var avg = Math.round(sum / count);
                            stats.pointsPerGame = avg || 0;

                            UserActivities.aggregate({ $match: {} },
                                {
                                    $group: {
                                        _id: null,
                                        cardsPlayed: { $sum: "$cardsPlayed" },
                                        cardsWon: { $sum: "$cardsWon" },
                                        overallCardsPlayed: { $sum: "$overallCardsPlayed" },
                                        overallCardsWon: { $sum: "$overallCardsWon" },
                                        instantCardsPlayed: { $sum: "$instantCardsPlayed" },
                                        instantCardsWon: { $sum: "$instantCardsWon" }
                                    }
                                }, function (err, result) {
                                    if (err)
                                        return res.status(500).send(err);

                                    stats.all = result[0];
                                    delete stats.all._id;


                                    stats.all.successPercent = (stats.all.cardsWon / stats.all.cardsPlayed) * 100 || 0;
                                    stats.all.overallSuccessPercent = (stats.all.overallCardsWon / stats.all.overallCardsPlayed) * 100 || 0;
                                    stats.all.instantSuccessPercent = (stats.all.instantCardsWon / stats.all.instantCardsPlayed) * 100 || 0;
                                    res.status(200).send(stats);
                                });
                        });
                })
        })



});

/* =========================
    * -----------------------------------
    *   PUSH ENDPOINTS
    * -----------------------------------
    =========================*/

/**
 * @api {post} api/tests/push/:token Send  push to Token
 * @apiName SendPush
 * @apiGroup Pushes
 * @apiVersion 0.0.1
 * @apiParam [String] tokens    The tokens list for the devices to push the message
 * @apiParam [String] messages  {"language":"message"}
 * @apiParam [String] data      data payload for the notification
 *
 *
 */

apiRoutes.post('/v1/users/push', function (req, res) {
    console.log("Push request received");
    /*
    *   NotificationMessage can be multilingual in the form of
    *   {
    *      "en": ENGLISH_MESSAGE,
    *      "ru": RUSIAN_MESSAGE
    *   }
    */
    var PushRequest = {
        message: req.body.message,
        data: req.body.data,
        ids: req.body.ids,
        application: req.body.application
    }
    return MessagingTools.sendPushToUsers(PushRequest.ids, PushRequest.message, PushRequest.data, "all", res);
    // return res.status(200).send(JSON.stringify(PushRequest));
});



// apply the routes to our application with the prefix /api
app.use('/', apiRoutes);