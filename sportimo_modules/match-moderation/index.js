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
    _ = require('lodash'),
    bodyParser = require('body-parser'),
    winston = require('winston'),
    mongoose = require('mongoose');

var scheduler = require('node-schedule');
var moment = require('moment');

var log = new (winston.Logger)({
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

log.add(winston.transports.Console, {
    timestamp: true,
    level: process.env.LOG_LEVEL || 'debug',
    prettyPrint: true,
    colorize: 'level'
});

// Sportimo Moderation sub-Modules
var match_module = require('./lib/match-module.js');

/*Bootstrap models*/
var team = null,
    scheduled_matches = null,
    matches = mongoose.models.scheduled_matches,
    feedstatuses = mongoose.models.matchfeedStatuses;

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

// Use for local instances in order to not interfere with live server
var shouldInitAutoFeed = true;

var ModerationModule = {
    // MatchTimers: {
    //     Timers: {},
    //     get: function (id){
    //         var timer = Timers[id];
    //         if(!timer) {
    //             Timers[id] = null;
    //             timer = Timers[id];
    //         }
    //         return timer;
    //     }
    // },
    ModeratedMatches: [],

    testing: false,
    callback: null,
    mongoose: null,
    mock: false,
    count: function () {
        return _.size(this.ModeratedMatches);
    },
    init: function (done) {
        initModule(done);
    },
    SetupMongoDB: function (mongooseConnection) {

        if (!shouldInitAutoFeed) {
            console.log("---------------------------------------------------------------------------------------------");
            console.log("---- Warning: This server instance does not initialize the feed auto moderation feature -----");
            console.log("---------------------------------------------------------------------------------------------");
        }

        if (this.mock) return;
        this.mongoose = mongooseConnection;
        var modelsPath = path.join(__dirname, '../models');
        fs.readdirSync(modelsPath).forEach(function (file) {
            require(modelsPath + '/' + file);
        });
        team = this.mongoose.models.team;
        scheduled_matches = this.mongoose.models.scheduled_matches;
        // log.info("Connected to MongoDB");

        // Initialize the gamecards module
        var gamecards = require('../gamecards');
        gamecards.connect(this.mongoose, RedisClientPub, RedisClientSub);

    },
    SetupRedis: function (Pub, Sub, Channel) {

        if (this.mock) return;

        // Initialize and connect to the Redis datastore
        RedisClientPub = Pub;
        RedisClientSub = Sub;

        setInterval(function () {

            RedisClientPub.publish("socketServers", JSON.stringify({
                server: "[Moderation] Active matches: " + ModerationModule.ModeratedMatches.length
            }));

        }, 30000);

        RedisClientPub.on("error", function (err) {
            console.log("{''Error'': ''" + err + "''}");

            console.error(err.stack);
        });

        RedisClientSub.on("error", function (err) {
            log.error("{''Error'': ''" + err + "''}");
        });

        var countConnections = 0;
        RedisClientSub.on("subscribe", function (channel, count) {
            countConnections++;
            // log.info("[Moderation] Subscribed to Sportimo Events PUB/SUB channel - connections: " + countConnections);
        });

        RedisClientSub.on("unsubscribe", function (channel, count) {
            // log.info("[Moderation] Unsubscribed from Sportimo Events PUB/SUB channel");
        });

        RedisClientSub.on("end", function () {
            log.error("{Connection ended}");
        });

        // RedisClientSub.subscribe(Channel);

        RedisClientSub.on("message", function (channel, message) {
            if (JSON.parse(message).server)
                return;

            // log.info("[Redis] : Event has come through the channel.");
            // log.info("[Redis] :" + message);
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
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Access-Token");
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            next();

        });


        // log.info("Setting up [Manual] moderation routes");
        var apiPath = path.join(__dirname, 'api');
        fs.readdirSync(apiPath).forEach(function (file) {
            server.use('/', require(apiPath + '/' + file)(ModerationModule));
        });
    },
    create: function (mongoMatchID) {
        if (!mongoMatchID)
            return new Error("Match ID cannot be empty");

        var oldMatch = ModerationModule.GetMatch(mongoMatchID);
        // safeguard for duplicates
        if (oldMatch) {
            log.info("Match with the same ID already exists. Hooking.");

            return oldMatch;
        } else {
            return ModerationModule.LoadMatchFromDB(mongoMatchID);
        }
    },
    ResetMatch: function (matchid, cbk) {
        scheduled_matches.findOne({
            _id: matchid
        }).exec(function (err, match) {
            match.stats = [];
            match.timeline = _.take(match.timeline);
            match.timeline[0].events = [];
            match.state = 0;
            match.time = 1;
            match.completed = false;
            match.away_score = 0;
            match.home_score = 0;
            match.save(function (err, result) {
                feedstatuses.find({ matchid: matchid }).remove().exec(function (err, opResult) {
                    cbk(opResult);
                });
            })
        });
    },
    ToggleMatchComplete: function (matchid, cbk) {
        scheduled_matches.findOne({
            _id: matchid
        }).exec(function (err, match) {
            match.completed = !match.completed;
            match.save(function (err, result) {
                feedstatuses.find({ matchid: matchid }).remove().exec(function (err, opResult) {
                    cbk(opResult);
                });
            })
        });
    },
    LoadMatchFromDB: function (matchid, cbk) {

        if (!this.mock) {
            scheduled_matches
                .findOne({
                    _id: matchid
                })
                .populate('home_team')
                .populate('away_team')
                .populate('competition')
                .exec(function (err, match) {
                    if (err)
                        return cbk(err);

                    if (!match) {
                        log.info(ModerationModule.count);
                        if (cbk)
                            return cbk(new Error("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches"));
                        else
                            return (new Error("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches"));
                    }

                    var foundMatch = _.find(ModerationModule.ModeratedMatches, { id: match.id });

                    if (foundMatch) {
                        foundMatch.Terminate();
                        // remove match in case it already exists
                        _.remove(ModerationModule.ModeratedMatches, {
                            id: matchid
                        });
                    }

                    var hookedMatch = new match_module(match, RedisClientPub, RedisClientSub, shouldInitAutoFeed);

                    ModerationModule.ModeratedMatches.push(hookedMatch);
                    log.info("[Moderation] Found match with ID [" + hookedMatch.id + "]. Hooking on it.");

                    if (cbk)
                        return cbk(null, hookedMatch);
                    else
                        return hookedMatch;

                });
        } else {
            var match = new scheduled_matches(mockMatch);
            var hookedMatch = new match_module(match, RedisClientPub);
            ModerationModule.ModeratedMatches.push(hookedMatch);
            log.info("Found match with ID [" + hookedMatch.id + "]. Hooking on it.");

            return hookedMatch;
        }
    },
    GetMatch: function (matchID, cbk) {
        var match = _.find(ModerationModule.ModeratedMatches, { id: matchID });

        if (match) {
            if (cbk)
                cbk(null, match);
            else
                return match;
        } else {
            ModerationModule.LoadMatchFromDB(matchID, cbk);
        }
    }
    //    InjectEvent: function (evnt, res) {
    //        ModerationModule.GetMatch(evnt.id).AddEvent(evnt.data, res);
    //    },
};

ModerationModule.GetSchedule = function (cbk) {
    scheduled_matches
        .find({})
        .populate('home_team')
        .populate('away_team')
        .populate('competition')
        .exec(function (err, schedule) {
            if (err) {
                log.error(err);
                return cbk(err);
            }

            cbk(null, schedule);
        });
};

/**
 * Adds a new match to the schedule.
 */

var objectAssign = require('object-assign');

ModerationModule.AddScheduleMatch = function (match, cbk) {
    var matchTemplate = require('./mocks/empty-match');

    matchTemplate = objectAssign(matchTemplate, match);

    var newMatch = new scheduled_matches(matchTemplate);


    newMatch.save(function (er, saved) {

        if (er)
            return cbk(er);
        ModerationModule.LoadMatchFromDB(saved._id, function (err, match) {
            if (err)
                return cbk(err);

            cbk(null, match);
        });

    });
};


/**
 * Adds a new match to the schedule.
 */
ModerationModule.UpdateScheduleMatch = function (match, cbk) {
    scheduled_matches.findOneAndUpdate({ _id: match._id }, match, { upsert: true }, cbk);
};

/**
 * Adds a new match to the schedule.
 */
ModerationModule.RemoveScheduleMatch = function (id, cbk) {
    // Delete from database
    ModerationModule.GetMatch(id).data.remove();
    // Remove from list in memory
    _.remove(ModerationModule.ModeratedMatches, { id: id });
    cbk();
};

/**
 * Matches cronjobs update info
 */
ModerationModule.updateMatchcronJobsInfo = function () {
    var itsNow = moment.utc();
    scheduled_matches
        .find({
            state: { $gt: -1 },
            completed: { $ne: true },
            'moderation.0.type': 'rss-feed',
            'moderation.0.active': true,
        })
        .exec(function (err, matches) {
            _.each(matches, function (match) {
                var job = _.find(scheduler.scheduledJobs, { name: match._id.toString() })
                if (job) {
                    var duration = moment.duration(moment(job.nextInvocation()).diff(itsNow));
                    var durationAsHours = duration.asMinutes();
                    match.moderation[0].start = "in " + durationAsHours.toFixed(2) + " minutes";
                    match.moderation[0].scheduled = true;
                    // log.info("Match tick will start in " + durationAsHours.toFixed(2) + " minutes");
                } else {
                    // log.info("Match has not been picked up from scheduler");
                    match.moderation[0].start = "";
                    match.moderation[0].scheduled = false;
                }
                match.save(function (er, re) {
                    var matchInMemory = ModerationModule.GetMatch(match._id.toString());
                    if (matchInMemory) {
                        matchInMemory.data.moderation[0].start = re.moderation[0].start;
                        matchInMemory.data.moderation[0].scheduled = re.moderation[0].scheduled;
                        // console.log("changed " +matchInMemory.data.moderation[0].start);                
                    }
                });
            })
        })
}

function initModule(done) {
    if (!this.mock) {
        /* We load all scheduled/active matches from DB on server initialization */
        scheduled_matches
            .find({
                state: { $gt: -1 },
                completed: { $ne: true }
            })
            .populate('home_team')
            .populate('away_team')
            .populate('competition')
            .exec(function (err, matches) {
                if (err)
                    return ModerationModule.callback ? ModerationModule.callback(err) : log.error(err);
                if (matches) {

                    // Adding wait index of 1sec in order to bypass the limitation of STATS that prevents overload of calls
                    var waitIndex = 0;

                    /*For each match found we hook platform specific functionality and add it to the main list*/
                    _.forEach(matches, function (match) {
                        setTimeout(function () {
                            var hookedMatch = new match_module(match, RedisClientPub, RedisClientSub, shouldInitAutoFeed);
                            ModerationModule.ModeratedMatches.push(hookedMatch);
                            log.info("[Moderation] Found match with ID [" + hookedMatch.id + "]. Creating match instance");
                        }, 2000 * waitIndex);
                        waitIndex++;
                    });
                } else {
                    log.warn("No scheduled matches could be found in the database.");
                }

                // Callback we are done for whomever needs it
                if (ModerationModule.callback != null)
                    ModerationModule.callback();

            });


    } else {


        var match = new scheduled_matches(mockMatch);

        var hookedMatch = new match_module(match, RedisClientPub, RedisClientSub);
        this.ModeratedMatches.push(hookedMatch);
        log.info("Mock match created with ID [" + hookedMatch.id + "].");

        // Callback we are done for whomever needs it
        if (ModerationModule.callback != null)
            ModerationModule.callback();
    }

    // Here we will create a job in interval where we check for feed matches, if theit timers are set and update accordingly the time until initiation
    ModerationModule.cronJobsUpdateInterval = setInterval(ModerationModule.updateMatchcronJobsInfo, 60000);
};

// A Mock Match object in case we need it for testing
var mockMatch = require('./mocks/mock-match');


module.exports = ModerationModule;
