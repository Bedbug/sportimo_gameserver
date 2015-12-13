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
require("moment-duration-format");

var _ = require('lodash');
var bodyParser = require('body-parser');
var winston = require('winston');


// Sportimo Modules
var moderationServices = require('./moderations-services');
var StatsHelper = require('./events-stats-analyzer');
var Sports = require('./sports-settings');
 
/*   Module Variables  */
var app;
var MATCHES = [];
var MatchTimers = [];

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
    match_date: Date,
    time: String,
    state: Number,
    stats: mongoose.Schema.Types.Mixed,
    timeline: [mongoose.Schema.Types.Mixed],
    settings: mongoose.Schema.Types.Mixed,
    moderation: [String],
    moderationData: mongoose.Schema.Types.Mixed // module names ['XMLFeed','Dashboard']
}, { collection: 'scheduled_matches' });
var scheduled_matches = mongoose.model("scheduled_matches", match_schema);



var RedisClientPub;
var RedisClientSub;

var ActiveMatches = {
    mock: false,
    count: MATCHES.length,
    init: function () {
        if (!this.mock) {
            scheduled_matches
                .find({ state: { $gt: -1 } })
                .populate('home_team')
                .populate('away_team')
                .exec(function (err, matches) {
                    if (err) return log(err, "error");
                    if (matches) {
                        _.forEach(matches, function (match) {
                            var hookedMatch = AddModuleHooks(match);
                            MATCHES.push(hookedMatch);
                            log("Found match with ID [" + hookedMatch.id + "]. Creating match instance", "info");
                        })
                    }
                    else {
                        log("No scheduled matches could be found in the database.");
                    }
                });
        }
        else {
            var match = {
                _id: "moxxkId",
                sport: "soccer",
                home_team: { name: "Pao", logo: "" },
                away_team: { name: "Olympiakos", logo: "" },
                home_score: 2,
                away_score: 1,
                match_date: moment().utc(),
                time: 5,
                state: 1,
                timeline: [[], []],
                moderation: ['manual']
            }

            var hookedMatch = AddModuleHooks(match);
            MATCHES.push(hookedMatch);
            log("Mock match created with ID [" + hookedMatch.id + "].", "info");
        }
    },
    create: function (mongoMatchID, callbackres) {
        if (!mongoMatchID) {
            return callbackres.status(404).send("Match ID cannot be empty");
        }

        var oldMatch = ActiveMatches.GetMatch(mongoMatchID);
        // safeguard for duplicates
        if (oldMatch) {
            log("Match with the same ID already exists. Hooking.", "info");
            
            if (callbackres)
                callbackres.send(oldMatch);
        }
        else {

            ActiveMatches.LoadMatchFromDB(mongoMatchID, callbackres);

        }
    },
    LoadMatchFromDB: function (matchid, res) {
        if (!this.mock) {
            
            // remove match in case it already exists
            console.log(MATCHES.length);
            _.remove(MATCHES,{ id: matchid });
             console.log(MATCHES.length);
            scheduled_matches
                .findOne({ _id: matchid })
                .populate('home_team')
                .populate('away_team')
                .exec(function (err, match) {

                    if (err) return log(err, "error");

                    if (match) {
                        var hookedMatch = AddModuleHooks(match);
                        MATCHES.push(hookedMatch);
                        //  console.log(hookedMatch);
                        if (res)
                            res.send(hookedMatch);
                        log("Found match with ID [" + hookedMatch.id + "]. Hooking on it.", "info");
                        return hookedMatch;
                    }
                    else {
                        console.log(ActiveMatches.count, "info");
                        res.status(404).send("No match with this ID could be found in the database. There must be a match in the database already in order for it to be transfered to the Active matches");
                        return null;
                    }
                });
        }
        else {
            var match = {
                _id: "moxxkId",
                sport: "soccer",
                home_team: { name: "Pao", logo: "" },
                away_team: { name: "Olympiakos", logo: "" },
                home_score: 2,
                away_score: 1,
                match_date: moment().utc(),
                time: 5,
                state: 1,
                timeline: [[], []],
                moderation: ['manual']
            }

            var hookedMatch = AddModuleHooks(match);
            MATCHES.push(hookedMatch);

            if (res)
                res.send(hookedMatch);
            log("Found match with ID [" + hookedMatch.id + "]. Hooking on it.", "info");
            return hookedMatch;
        }
    },
    GetMatch: function (matchID) {
        return _.findWhere(MATCHES, { id: matchID });
    },
    setMongoConnection: function (uri) {
        if (this.mock) return;
        mongoose.connect(uri);
        log("Connected to MongoDB", "core");
    },
    setRedisPubSub: function (RedisIP, RedisPort, RedisAuth, RedisChannel) {
        if (this.mock) return;
        // Initialize and connect to the Redis datastore
        RedisClientPub = redis.createClient(RedisPort, RedisIP);
        RedisClientPub.auth(RedisAuth, function (err) {
            if (err) { throw err; }
        });

        RedisClientSub = redis.createClient(RedisPort, RedisIP);
        RedisClientSub.auth(RedisAuth, function (err) {
            if (err) { throw err; }
        });

        setInterval(function () {

            RedisClientPub.publish("socketServers", JSON.stringify({ server: "[GameServer] Active matches: " + MATCHES.length }));

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

        RedisClientSub.subscribe(RedisChannel);

        RedisClientSub.on("message", function (channel, message) {
            if (JSON.parse(message).server)
                return;

            log("[Redis] : Event has come through the channel.", "info");
            log("[Redis] :" + message, "debug");
        });
    },
    setServerForRoutes: function (server) {
        log("Setting up moderation Routes");
        app = server;
        app.use(bodyParser.json());
        app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            next();
        });

        app.post('/v1/live/match', function (req, res) {
            log("[Moderation] Request for matchid [" + req.body.id + "]", "info");
            ActiveMatches.create(req.body.id, res);
        });
        
        app.post('/v1/live/match/reload', function (req, res) {
            log("[Reload Match] Request for matchid [" + req.body.id + "]", "info");
            ActiveMatches.LoadMatchFromDB(req.body.id, res);
        });

        app.put('/v1/live/match', function (req, res) {

            req.body.last_action_time = moment();
        });

        app.get('/v1/live/match/:id', function (req, res) {

            return res.send(ActiveMatches.GetMatch(req.params.id));

        });
    },
    InjectEvent: function (evnt, res) {
        ActiveMatches.GetMatch(evnt.id).AddEvent(evnt.data, res);
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

    var HookedMatch = {};// = match;
    
    HookedMatch.MODERATION_SERVICES = [];
    
    // Holds the interval that counts time
    // HookedMatch.Time_interval = null;
    // Holds the actual running time (i.e. 10m:34s)
    HookedMatch.Match_timer = "";
    
    // Set ID
    HookedMatch.id = match._id.toString() || 'moxxkId';
    
    // Match data
    HookedMatch.data = match;
    
    // Validations
    if (HookedMatch.data.timeline.length == 0) {
        HookedMatch.data.state = 0;
        HookedMatch.data.timeline.push([{
            "start": null,
            "end": null,
            "events": []
        }]);
        HookedMatch.data.markModified('timeline');
        HookedMatch.data.save();
    }
    
    // Setting the game_type ('soccer','basket') and its settings (game segments, duration, etc)
    HookedMatch.sport = Sports[match.sport];
    
    
  
    /*  ---------------
    **   Methods
    **  -------------*/
    
    /*  SetModerationService
        Here we set the moderation service for the game. There is only reason to switch to manual
        only if we don't want a hooked feed. Manual input will always work
    */
    HookedMatch.AddModerationService = function (service, initializing) {

        if (HookedMatch.moderation.indexOf(service) > 0)
            return log("Service already active", "core");

        if (!initializing)
            HookedMatch.moderation.push(service);

        HookedMatch.MODERATION_SERVICES.push(moderationServices[service]);

        if (service == "manual")
            HookedMatch.MODERATION_SERVICES[HookedMatch.MODERATION_SERVICES.length - 1].init(app, this, log);

    }
     
    // Set services for the first time
    HookedMatch.moderation = match.moderation;
    HookedMatch.moderation.forEach(function (service) {
        HookedMatch.AddModerationService(service, true);
    });
     
    /*  AdvanceSegment
        The advance state method is called when we want to advance to the next segment of the game.
        Depending on setting, here will determine if a timer should begin counting aand hold the
        game's time.
    */
    HookedMatch.AdvanceSegment = function (event, res) {
        
        // Register the time that the previous segment ended
        this.data.timeline[this.data.state].end = moment().utc().format();
        // Advance the state of the match
        this.data.state++;
        // Register the time that the current segment starts
        this.data.timeline.push({
            "start": null,
            "end": null,
            "events": []
        });
        this.data.timeline[this.data.state].start = moment().utc().format();
        
        //  Does it have initial time?
        // if (HookedMatch.sport.segments[this.data.state].initialTime)
        //     this.data.time = HookedMatch.sport.segments[this.data.state].initialTime;
                
        //     if (HookedMatch.sport.segments[this.data.state].initialTime)
        //     this.data.time = HookedMatch.sport.segments[this.data.state].initialTime;
        // else
        //     this.data.time = "";

        // HookedMatch.Match_timer = "";
        
        this.addTimeHooks();

        this.data.markModified('timeline');
        this.data.save();

        return res.status(200).send(HookedMatch);
    }

    HookedMatch.addTimeHooks = function () {
        if (HookedMatch.sport.segments[HookedMatch.data.state]) {
            var now = moment().utc();
            var then = moment(HookedMatch.data.timeline[HookedMatch.data.state].start);
            var ms = moment(now, "DD/MM/YYYY HH:mm:ss").diff(moment(then, "DD/MM/YYYY HH:mm:ss"));
            var d = moment.duration(ms);


            HookedMatch.Match_timer = HookedMatch.sport.segments[this.data.state].timed ? d.format("mm:ss", { trim: false }) : "";
            HookedMatch.data.time = (HookedMatch.sport.segments[this.data.state].initialTime || 0) + parseInt(d.add(1, "minute").format("m")) + "";
            
            //  Should this segment be timed?
            if (HookedMatch.sport.segments[this.data.state].timed) {

                if (!HookedMatch.sport.time_dependant) {                                   //  Is Time controlled?
                    MatchTimers[this.data.match_id] = setInterval(function () {
                        var now = moment().utc();
                        var then = moment(HookedMatch.data.timeline[HookedMatch.data.state].start);
                        var ms = moment(now, "DD/MM/YYYY HH:mm:ss").diff(moment(then, "DD/MM/YYYY HH:mm:ss"));
                        var d = moment.duration(ms);
                        HookedMatch.Match_timer = d.format("mm:ss", { trim: false });
                        // console.log(d.format("mm"));
                        //  console.log(now);
                        //  console.log(then);
                        
                        HookedMatch.data.time = (HookedMatch.sport.segments[HookedMatch.data.state].initialTime || 0) + parseInt(d.add(1, "minute").format("m")) + "";
                       
                    }, 1000);
                }
            }
            else {
                clearInterval(MatchTimers[this.data.match_id]);
            }
        }
        else {
            clearInterval(MatchTimers[this.data.match_id]);
        }
    }
    
    
    /*  ToggleTimer
        Toggles the game's timer state.
    */
    HookedMatch.ToggleTimer = function () {
        if (this.Time_interval) {
            clearInterval(MatchTimers[this.data.match_id]);
        } else {
            MatchTimers[this.data.match_id] = setInterval(function () {
                HookedMatch.countTime();
            }, 1000)
        }
    }
    HookedMatch.GetCurrentSegment = function () {
        // We assign the name of the segment to the currentSegment var
        return HookedMatch.Sport.segments[HookedMatch.state].name;
    }
    
    
    
    /*  AddEvent
        The addEvent method is a core method to the moderation system. It is called by
        moderation services or manualy from the dashboard in order to inject events to
        the timeline and also broadcast them on the sockets channel to be consumed by
        other instances.
    */
    HookedMatch.AddEvent = function (event, res) {
      
        // Parses the event based on sport and makes changes in the match instance
        StatsHelper.Parse(event, match, log);


        var evtObject = event.data;
      
        // 1. push event in timeline
        if (evtObject.timeline_event) {
            log("Received Timeline event", "info");
            this.data.timeline[this.data.state].events.push(evtObject);
        }
        
        // 2. broadcast event on pub/sub channel
        log("Pushing event to Redis Pub/Sub channel", "info");
        RedisClientPub.publish("socketServers", JSON.stringify(evtObject));
        
        // 3. save match to db
        if (evtObject.timeline_event) {
            this.data.markModified('timeline');
            log("Updating database", "info");
        }


        StatsHelper.UpsertStat(match.id, { events_sent: 1 }, this.data);

        this.data.markModified('stats');

        this.data.save();
        
        // 4. return match to Sender
        return res.status(200).send();
    }
    
    /*  RemoveEvent
        
    */
    HookedMatch.RemoveEvent = function (event, res) {
        
        // Parses the event based on sport and makes changes in the match instance
        StatsHelper.Parse(event, match, log);

        console.log(event);
        var eventObj = _.findWhere(this.data.timeline[event.data.state], { id: event.data.id, match_id: event.data.match_id });
        
        // set status to removed
        eventObj.status = "removed";
        
        // Should we destroy events on just mark them "removed"
        if (this.data.settings.destroyOnDelete)
            this.data.timeline[event.data.state].events = _.without(this.data.timeline[event.data.state].events, eventObj);

        // Broadcast the remove event so others can consume it.
        RedisClientPub.publish("socketServers", JSON.stringify(event));
        
        // 3. save match to db
        this.data.markModified('timeline');
        log("Updating database", "info");

        StatsHelper.UpsertStat(match.id, { events_sent: 1 }, this.data);
        this.data.markModified('stats');

        this.data.save();
        
        // 4. return match to Sender
        return res.status(200).send();
    }
    
    /*  RemoveEvent
        
    */
    HookedMatch.UpdateEvent = function (event, res) {

        // Parses the event based on sport and makes changes in the match instance
        StatsHelper.Parse(event, match, log);

        for (var i = 0; i < this.data.timeline[event.data.state].events.length; i++) {
            if (this.data.timeline[event.data.state].events[i].id == event.data.id && this.data.timeline[event.data.state].events[i].match_id == event.match_id) {
                this.data.timeline[event.data.state].events[i] = event.data;
                break;
            }
        }

        // Broadcast the remove event so others can consume it.
        RedisClientPub.publish("socketServers", JSON.stringify(event));
        
        // 3. save match to db
        this.data.markModified('timeline');
        log("Updating database", "info");

        StatsHelper.UpsertStat(match.id, { events_sent: 1 }, this.data);
        this.data.markModified('stats');

        this.data.save();
        
        // 4. return match to Sender
        return res.status(200).send();
    }

    HookedMatch.addTimeHooks();

    return HookedMatch;
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
        core: 'magenta',
        warn: 'yellow',
        error: 'red'
    }
});

logger.add(winston.transports.Console, { timestamp: true, level: process.env.LOG_LEVEL || 'info', prettyPrint: true, colorize: 'level' });

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
    console.log("[ActiveMatches Module] " + text);
    // var loglevel = level || 'core';
    // logger.log(loglevel, "[ActiveMatches Module] " + text);
}

module.exports = ActiveMatches;