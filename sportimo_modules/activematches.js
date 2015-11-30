/*
 *  ActiveMatches Module
 *  Created by MasterBug on 28/11/15.
 *
 *  Module usage:
 *  This is a core module tha handles all things related to matches that are going to be live in the game.
*/

/*  Libraries   */
var mongoose = require('mongoose');
var redis = require('redis');
var needle = require('needle');
var moment = require('moment');
var _ = require('underscore');
var bodyParser = require('body-parser');
var winston = require('winston');

// Sportimo Modules
var moderationServices = require('./moderationsServices');
var Sports = require('./sportSetups');
 
/*   Module Variables  */
var app;
var MATCHES = [];

// mongoose.connect('mongodb://bedbug:a21th21@ds043523-a0.mongolab.com:43523,ds043523-a1.mongolab.com:43523/sportimo?replicaSet=rs-ds043523');

/*  MONGODB SCHEMAS */
// var player_schema = new mongoose.Schema({
//     id: String,
//     details: mongoose.Schema.Types.Mixed,
//     career: mongoose.Schema.Types.Mixed,
//     honors: mongoose.Schema.Types.Mixed,
//     biography: String,
//     video: String,
//     position: String,
//     photo: String,
//     birth: Date,
//     country: mongoose.Schema.Types.Mixed,
//     personLanguages: mongoose.Schema.Types.Mixed,
//     weight: String,
//     height: String,
//     number: Number
// });
// var player = mongoose.model("player", player_schema);

var team_schema = new mongoose.Schema({
    name: String,
    logo: String,
    players: [{ type: Number, ref: 'player' }]
});
var team = mongoose.model("team", team_schema);

var matchevent = new mongoose.Schema({
    type: String,
    time: Number,
    data: mongoose.Schema.Types.Mixed,
    created: Date
});

var match_schema = new mongoose.Schema({
    sport: String,
    home_team: { type: String, ref: 'team' },
    away_team: { type: String, ref: 'team' },
    home_score: Number,
    away_score: Number,
    time: Number,
    state: Number,
    timeline: [matchevent],
    moderation: [String] // module names ['XMLFeed','Dashboard']
}, { collection: 'scheduled_matches' });
var scheduled_matches = mongoose.model("scheduled_matches", match_schema);


var demoMatch = new scheduled_matches({
    "_id": "565c4af6e4b030fba33dd459",
    sport: "soccer",
    "home_team": "565c4907e4b030fba33dd433",
    "away_team": "565c492fe4b030fba33dd435",
    "home_score": 0,
    "away_score": 0,
    "time": null
})

demoMatch.save(function (err, fluffy) {
    if (err) return console.error(err);
    else
        return console.error(fluffy);
});

/*{
    "_id": {
        "$oid": "565c4af6e4b030fba33dd459"
    },
    "home_team": {
        "$oid": "565c4907e4b030fba33dd433"
    },
    "away_team": {
        "$oid": "565c492fe4b030fba33dd435"
    },
    "home_score": 0,
    "away_score": 0,
    "time": null
}*/

/*  Moderation Service 
    Here we select the service that we will use to moderate the match.
    We can create as many services as we like as long as the implementation
    is following some specific rules.
*/

// ? Each match should have it's own moderation service
//var MODERATION_SERVICE = moderationServices.XMLFeed;
// We initialize the service
//MODERATION_SERVICE.init();


/**/
var RedisClient;

var ActiveMatches = {
    count: MATCHES.length,
    create: function (mongoMatchID, callbackres) {
        if (!mongoMatchID) {
            return callbackres.status(404).send("Match ID cannot be empty");
        }

        var oldMatch = ActiveMatches.GetMatch(mongoMatchID);
        // safeguard for duplicates
        if (oldMatch) {
            log("Match with the same Id already exists", "info");
            if (callbackres)
                callbackres.send(oldMatch);
        }
        else {
            scheduled_matches
                .findOne({ _id: mongoMatchID })
                .populate('home_team')
                .populate('away_team')
                .exec(function (err, match) {
                    if (err) return log(err, "error");

                    if (match) {
                        if (callbackres)
                            callbackres.send(match);

                        match = AddModuleHooks(match);
                        MATCHES.push(match);
                        log("Found match with ID [" + match.id + "]. Hooking on it.", "info");
                        return match;
                    }
                    else {
                        console.log(ActiveMatches.count, "info");
                        callbackres.status(404).send("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches");
                        return null;
                    }
                });
        }
    },
    GetMatch: function (matchID) {
        return _.findWhere(MATCHES, { id: matchID });
    },
    setMongoConnection: function (uri) {
        mongoose.connect(uri);
        log("Connected to MongoDB", "core");
    },
    setRedisPubSub: function (RedisIP, RedisPort, RedisAuth, RedisChannel) {
        // Initialize and connect to the Redis datastore
        RedisClient = redis.createClient(RedisPort, RedisIP);

        RedisClient.auth(RedisAuth, function (err) {
            if (err) { throw err; }
        });

        RedisClient.on("error", function (err) {
            log("{''Error'': ''" + err + "''}");
        });

        RedisClient.on("subscribe", function (channel, count) {
            log("Subscribed to Sportimo Events PUB/SUB channel");
        });

        RedisClient.on("unsubscribe", function (channel, count) {
            log("Subscribed from Sportimo Events PUB/SUB channel");
        });

        RedisClient.on("end", function () {
            log("{Connection ended}");
        });

        RedisClient.subscribe(RedisChannel);

        RedisClient.on("message", function (channel, message) {
            if (message == "ping")
                return;

            var obj = JSON.parse(JSON.parse(message).data);
            log(obj, "debug");
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

        app.post('/v1/live/match', function (req, res) {
            log("Moderation Request for matchid [" + req.body.id + "]", "info");
            ActiveMatches.create(req.body.id, res);
        });

        app.put('/v1/live/match', function (req, res) {

            req.body.last_action_time = moment();
        });

        app.get('/v1/live/match/', function (req, res) {

            scheduled_matches.findById(req.body._id, function (err, match) {
                return res.send(match);
            })
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
        .findOne({ _id: mongodbID })
        .populate('home_team')
        .populate('away_team')
        .exec(function (err, match) {
            if (err) return log(err, "error");

            if (match) {

                if (res) {
                    res.send(match);
                }
                match = AddModuleHooks(match);
                ActiveMatches.add(match);
                log("Found match with ID [" + match.id + "]. Hooking on it.");
                return match;
            }
            else {
                console.log(ActiveMatches.count, "info");
                res.status(404).send("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches");
                return null;
            }
        });

}

var AddModuleHooks = function (match) {
    // Set ID
    match.id = match._id.toString();
    
    // Setting the game_type ('soccer','basket') and its settings (game segments, duration, etc)
    match.Sport = Sports[match.sport];
  
    // Methods
    match.AdvanceState = function () {
        match.state++;
        
        if (match.Sport.segments[match.state].timed == true) {                  //  Should this segment be timed?
            if (match.Sport.segments[match.state].initialTime)                  //  Does it have initial time?
                match.time = match.Sport.segments[match.state].initialTime;

            if (!match.Sport.time_dependant)                                    //  Is Time controlled?
                match.MatchTimeInterval = setInterval(function () {
                    match.time ++;
                }, 1000)
        }
    }

    return match;
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
    logger.log(loglevel, "[ActiveMatches Module] " + text);
}

module.exports = ActiveMatches;