/*
 *  Moderation Module
 *  Created by MasterBug on 28/11/15.
 *
 *  Module usage:
 *  This is a core module tha handles all things related to matches that are going to be live in the game.
 */

/*  Libraries   */
var path = require('path'),
    fs = require('fs'),
    needle = require('needle');

var moment = require('moment');
require("moment-duration-format");

var _ = require('lodash');
var bodyParser = require('body-parser');
var winston = require('winston');



// Sportimo Moderation sub-Modules
var match_module = require('./lib/match-module.js');
//var StatsHelper = require('./lib/events-stats-analyzer');
//var Sports = require('./lib/sports-settings');

/*   Module Variables  */
var MatchTimers = [];


/*Bootstrap models*/
var team = null,
    scheduled_matches = null;



/**
 * Redis Pub/Sub Channels
 */
var RedisClientPub;
var RedisClientSub;


/** 
 * CORE MODERATION SERVICE
 * Handles outside interaction and hold the list
 * of active matches schedule.
 */
var ModerationModule = {
    ModeratedMatches: [],
    testing: false,
    callback: null,
    mongoose: null,
    mock: false,
    count: function () {
        return _.size(this.ModeratedMatches);
    },
    init: function(done){
        initModule(done);
    },
     SetupMongoDB: function (mongooseConnection) {
        if (this.mock) return;
        this.mongoose = mongooseConnection;
        var modelsPath = path.join(__dirname, 'models');
        fs.readdirSync(modelsPath).forEach(function (file) {
            require(modelsPath + '/' + file);
        });
        team = this.mongoose.models.team;
        scheduled_matches = this.mongoose.models.scheduled_matches;
        log("Connected to MongoDB", "core");
    },
    SetupRedis: function (Pub, Sub, Channel) {

        if (this.mock) return;

        // Initialize and connect to the Redis datastore
        RedisClientPub = Pub;
        RedisClientSub = Sub;

        setInterval(function () {

            RedisClientPub.publish("socketServers", JSON.stringify({
                server: "[GameServer] Active matches: " + this.ModeratedMatches.length
            }));

        }, 30000);

        RedisClientPub.on("error", function (err) {
            log("{''Error'': ''" + err + "''}");
        });

        RedisClientSub.on("error", function (err) {
            log("{''Error'': ''" + err + "''}");
        });

        RedisClientSub.on("subscribe", function (channel, count) {
            log("Subscribed to Sportimo Events PUB/SUB channel");
        });

        RedisClientSub.on("unsubscribe", function (channel, count) {
            log("Subscribed from Sportimo Events PUB/SUB channel");
        });

        RedisClientSub.on("end", function () {
            log("{Connection ended}");
        });

        RedisClientSub.subscribe(Channel);

        RedisClientSub.on("message", function (channel, message) {
            if (JSON.parse(message).server)
                return;

            log("[Redis] : Event has come through the channel.", "info");
            log("[Redis] :" + message, "debug");
        });
    },
    SetupAPIRoutes: function (server) {
        // Load up the Rest-API routes
        server.use(bodyParser.json());
        server.use(bodyParser.urlencoded({
            extended: true
        }));
        server.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            next();
        });

        log("Setting up [Manual] moderation routes");
        var apiPath = path.join(__dirname, 'api');
        fs.readdirSync(apiPath).forEach(function (file) {
            server.use('/', require(apiPath + '/' + file)(ModerationModule, log));
        });
    },
    create: function (mongoMatchID, callbackres) {
        if (!mongoMatchID) {
            return callbackres.status(404).send("Match ID cannot be empty");
        }

        var oldMatch = ModerationModule.GetMatch(mongoMatchID);
        // safeguard for duplicates
        if (oldMatch) {
            log("Match with the same ID already exists. Hooking.", "info");

            if (callbackres)
                callbackres.send(oldMatch);
        } else {

            ModerationModule.LoadMatchFromDB(mongoMatchID, callbackres);

        }
    },
    LoadMatchFromDB: function (matchid, res) {
        if (!this.mock) {
            // remove match in case it already exists
            _.remove(this.ModeratedMatches, {
                id: matchid
            });
            scheduled_matches
                .findOne({
                    _id: matchid
                })
                .populate('home_team')
                .populate('away_team')
                .exec(function (err, match) {

                    if (err) return log(err, "error");

                    if (match) {
                        var hookedMatch = match_module(match, MatchTimers, RedisClientPub, log);
                        this.ModeratedMatches.push(hookedMatch);
                        if (res)
                            res.send(hookedMatch);
                        log("Found match with ID [" + hookedMatch.id + "]. Hooking on it.", "info");
                        return hookedMatch;
                    } else {
                        console.log(ModerationModule.count, "info");
                        res.status(404).send("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches");
                        return null;
                    }
                });
        } else {
            var match = new scheduled_matches(mockMatch);
            var hookedMatch = match_module(match, MatchTimers, RedisClientPub, log);
            this.ModeratedMatches.push(hookedMatch);

            if (res)
                res.send(hookedMatch);

            log("Found match with ID [" + hookedMatch.id + "]. Hooking on it.", "info");
            return hookedMatch;
        }
    },
    GetMatch: function (matchID) {
        return _.findWhere(this.ModeratedMatches, {
            id: matchID
        });
    }
    //    InjectEvent: function (evnt, res) {
    //        ModerationModule.GetMatch(evnt.id).AddEvent(evnt.data, res);
    //    },
   

}

/* The basic match class.
    This is where everything related to the active match happens. The timers,
    the timeline, reponsibility to sync with database, etc.
    We pass the mongodb ID so the class can hook to the database for updates.
*/
// var Match = function (mongodbID, res) {

//     scheduled_matches
//         .findOne({
//             _id: mongodbID
//         })
//         .populate('home_team')
//         .populate('away_team')
//         .exec(function (err, match) {
//             if (err) return log(err, "error");

//             if (match) {

//                 if (res) {
//                     res.send(match);
//                 }
//                 match = match_module(match, MatchTimers, RedisClientPub, log);
//                 ModerationModule.add(match);
//                 log("Found match with ID [" + match.id + "]. Hooking on it.");
//                 return match;
//             } else {
//                 console.log(ModerationModule.count, "info");
//                 res.status(404).send("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches");
//                 return null;
//             }
//         });

// }

function initModule(done){
     if (!this.mock) {
            /* We load all scheduled/active matches from DB on server initialization */
            scheduled_matches
                .find({
                    state: {
                        $gt: -1
                    }
                })
                .populate('home_team')
                .populate('away_team')
                .exec(function (err, matches) {
                    if (err) return log(err, "error");
                    if (matches) {
                        /*For each match found we hook platform specific functionality and add it to the main list*/
                        _.forEach(matches, function (match) {
                            var hookedMatch = match_module(match, MatchTimers, RedisClientPub, log);
                            ModerationModule.ModeratedMatches.push(hookedMatch);
                            log("Found match with ID [" + hookedMatch.id + "]. Creating match instance", "info");
                        })
                    } else {
                        log("No scheduled matches could be found in the database.");
                    }

                    // Callback we are done for whomever needs it
                    if (ModerationModule.callback != null)
                        ModerationModule.callback();

                });


        } else {


            var match = new scheduled_matches(mockMatch);

            var hookedMatch = match_module(match, MatchTimers, RedisClientPub, log);
            this.ModeratedMatches.push(hookedMatch);
            log("Mock match created with ID [" + hookedMatch.id + "].", "info");

            // Callback we are done for whomever needs it
            if (ModerationModule.callback != null)
                ModerationModule.callback();
        }
};

// A Mock Match object in case we need it for testing
var mockMatch = require('./mocks/mock-match');

/*  Winston Logger  */
var logger = new(winston.Logger)({
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
        core: 'magenta',
        warn: 'yellow',
        error: 'red'
    }
});

logger.add(winston.transports.Console, {
    timestamp: true,
    level: ModerationModule.testing?'warn':( process.env.LOG_LEVEL || 'info'),
    prettyPrint: true,
    colorize: 'level'
});

if (process.env.NODE_ENV == "production") {
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
}

function log(text, level) {
    if(!ModerationModule.testing)
    console.log("[Moderation Module] " + text);
    // var loglevel = level || 'core';
    // logger.log(loglevel, "[Moderation Module] " + text);
}

module.exports = ModerationModule;
