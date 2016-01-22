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
var AllMatches = [];
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
    callback: null,
    mongoose: null,
    mock: false,
    count: function () {
        return _.size(AllMatches);
    },
    init: function (done) {
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
                            AllMatches.push(hookedMatch);
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
            AllMatches.push(hookedMatch);
            log("Mock match created with ID [" + hookedMatch.id + "].", "info");

            // Callback we are done for whomever needs it
            if (ModerationModule.callback != null)
                ModerationModule.callback();
        }
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
            _.remove(AllMatches, {
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
                        AllMatches.push(hookedMatch);
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
            AllMatches.push(hookedMatch);

            if (res)
                res.send(hookedMatch);

            log("Found match with ID [" + hookedMatch.id + "]. Hooking on it.", "info");
            return hookedMatch;
        }
    },
    GetMatch: function (matchID) {
        return _.findWhere(AllMatches, {
            id: matchID
        });
    },
    //    InjectEvent: function (evnt, res) {
    //        ModerationModule.GetMatch(evnt.id).AddEvent(evnt.data, res);
    //    },
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
                server: "[GameServer] Active matches: " + AllMatches.length
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
    // Setting up the Manual Rest-API service
    SetupAPIRoutes: function (server) {

        log("Setting up [Manual] moderation routes");
        var apiPath = path.join(__dirname, 'api');
        fs.readdirSync(apiPath).forEach(function (file) {
            server.use('/v1', require(apiPath + '/' + file)(ModerationModule));
        });
    }

}

/* The basic match class.
    This is where everything related to the active match happens. The timers,
    the timeline, reponsibility to sync with database, etc.
    We pass the mongodb ID so the class can hook to the database for updates.
*/
var Match = function (mongodbID, res) {

    scheduled_matches
        .findOne({
            _id: mongodbID
        })
        .populate('home_team')
        .populate('away_team')
        .exec(function (err, match) {
            if (err) return log(err, "error");

            if (match) {

                if (res) {
                    res.send(match);
                }
                match = match_module(match, MatchTimers, RedisClientPub, log);
                ModerationModule.add(match);
                log("Found match with ID [" + match.id + "]. Hooking on it.");
                return match;
            } else {
                console.log(ModerationModule.count, "info");
                res.status(404).send("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches");
                return null;
            }
        });

}

// A Mock Match object in case we need it for testing
var mockMatch = {
    "_id": "565c4af6e4b030fba33dd459",
    "sport": "soccer",
    "home_team": "565c4907e4b030fba33dd433",
    "away_team": "565c492fe4b030fba33dd435",
    "home_score": 0,
    "away_score": 0,
    "time": "54",
    "moderation": [
        {
            "type": "rss-feed",
            "eventid": "15253",
            "feedurl": "http://feed-somewhere.com?event-id=",
            "interval": 500,
            "parsername": "Stats"
        }
    ],
    "stats": [
        {
            "rc": 0,
            "fc": 0,
            "id": "565c4af6e4b030fba33dd459",
            "yc": 0,
            "name": "match",
            "events_sent": 16
        },

    ],
    "timeline": [],
    "settings": {
        "destroyOnDelete": true
    },
    "state": 0,
    "__v": 43
}

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
    level: process.env.LOG_LEVEL || 'info',
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
    console.log("[Moderation Module] " + text);
    // var loglevel = level || 'core';
    // logger.log(loglevel, "[Moderation Module] " + text);
}

module.exports = ModerationModule;
