/*
 *  LiveMatches Module
 *  Created by MasterBug on 28/11/15.
 *
 *  Module usage:
 *  From the dashboard this module receives an event to create a match with the appropriate
*/

/*  Libraries   */
var mongoose = require('mongoose');
var redis = require('redis');
var needle = require('needle');
var moment = require('moment');
var _ = require('underscore');
var bodyParser = require('body-parser');
var winston = require('winston');


 
/*   Module Variables  */
var app;
var activeMatches = [];


/*  MONGODB SCHEMAS */
var _match = mongoose.Schema({});
var _LiveMatches = mongoose.model("LiveMatches", _match);



var LiveMatches = {
   redisclient: null,
   setMongoConnection: function (uri) {
        mongoose.connect(uri);
        log("Connected to MongoDB","core"); 
    },
    setRedisPubSub: function (RedisIP, RedisPort, RedisAuth, RedisChannel) {
        // Initialize and connect to the Redis datastore
        this.redisclient = redis.createClient(RedisPort, RedisIP);


       this. redisclient.auth(RedisAuth, function (err) {
            if (err) { throw err; }
        });

        this.redisclient.on("error", function (err) {
            log("{''Error'': ''" + err + "''}");
        });

        this.redisclient.on("subscribe", function (channel, count) {
            log("Subscribed to Sportimo Events PUB/SUB channel");
        });

        this.redisclient.on("unsubscribe", function (channel, count) {
            log("Subscribed from Sportimo Events PUB/SUB channel");
        });

        this.redisclient.on("end", function () {
            log("{Connection ended}");
        });

        this.redisclient.subscribe(RedisChannel);

        this.redisclient.on("message", function (channel, message) {
            if (message == "ping")
                return;

            var obj = JSON.parse(JSON.parse(message).data);
            log(obj,"debug");
        });
    },
    setServerForRoutes: function (server) {
        app = server;
        app.use(bodyParser.json());
        app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            next();
        });

        app.put('/v1/notifications/users/', function (req, res) {

            req.body.last_action_time = moment();


            return Users.findOne({ userid: req.body.userid }, function (err, user) {


                if (user) {

                    //console.log("Found User");

                    var update = 0;

                    for (var i = 0; i < user.matches_visited.length; i++) {
                        if (user.matches_visited[i].match == req.body.last_match_visited) {
                            update = 1;
                            user.name = req.body.name;
                            user.matches_visited[i].afterKickoff = req.body.visit_after_kickoff;

                            //console.log("Found match: "+ req.body.last_match_visited+". updating it to: "+ user.matches_visited[i].afterKickoff);
                        }
                    }

                    if (update == 0) user.matches_visited.push({ match: req.body.last_match_visited, afterKickoff: req.body.visit_after_kickoff });

                    user.markModified('matches_visited');

                     user.last_match_visited = req.body.last_match_visited;
                     user.pushtoken = req.body.pushtoken;
                     user.last_action_time = moment();

                    user.save(function (err) {
                        if (!err)
                            return res.sendStatus(200);
                    })
                } else {
                    req.body.matches_visited = [];
                    req.body.matches_visited.push({ match: req.body.last_match_visited, afterKickoff: req.body.visit_after_kickoff });
                    Users.update({ userid: req.body.userid }, req.body, { upsert: true }, function () {
                        return res.sendStatus(200);
                    });
                }

            });



        });

        app.get('/v1/notifications/users/', function (req, res) {
            log("Get Users");
            Users.find({}, function (err, list) {

                return res.send(list);
            })
        });


     
    }
}



/*  Winston Logger  */
var logger = new (winston.Logger)({
    levels: {
        prompt: 6,
        debug: 5,
        info: 4,
        core: 3,
        warn: 1,
        error: 0
    },
    colors: {
        prompt: 'grey',
        debug: 'blue',
        info: 'green',
        core: 'grey',
        warn: 'yellow',
        error: 'red'
    }
});

logger.add(winston.transports.Console, { timestamp: true, level: process.env.LOG_LEVEL || 'debug', prettyPrint: true, colorize: 'level' });

logger.add(winston.transports.File, {
    prettyPrint: true,
    level: 'core',
    silent: false,
    colorize: false,
    timestamp: true,
    filename: 'debug.log',
    maxsize: 40000,
    maxFiles: 10,
    json: false
});

function log(text, level) {
    var loglevel = level || 'core';
    logger.log(loglevel, "[Live Matches Module] " + text);
}

module.exports = LiveMatches;