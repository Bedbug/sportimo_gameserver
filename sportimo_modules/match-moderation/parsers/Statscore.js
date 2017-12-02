/* Author: ELias Kalapanidas (last update: 2017/11/30) */

'use strict';

const scheduler = require('node-schedule');
const amqp = require('amqplib/callback_api');
const needle = require("needle");
const crypto = require("crypto-js");
const async = require('async');
const _ = require('lodash');
const moment = require('moment');
const winston = require('winston');
const mongoose = require('mongoose');
const matches = mongoose.models.scheduled_matches;
//var MessagingTools = require.main.require('./sportimo_modules/messaging-tools');

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
// Settings for the development environment

// languageMapping maps Sportimo langage locale to Stats.com language Ids. For a list of ISO codes, see https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
var languageMapping = {
    "ar": "10", // arabic
    "en": "1", // english
    "yi": "28", // yiddish (hebrew)
    "ru": "16"

    // Add all required language mappings here from Stats.com
};


var statscoreConfigDevelopment = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages: ["en"],
    urlPrefix: "queue.softnetsport.com", //
    queueName: "gu-group",
    userName: "gu-group",
    apiSecret: "3iqAJvFlU0Y4bjB7MNkA4tu8tDMNI4QVYkh", 
    virtualHost: "statscore",
    eventsInterval: 6000,  // how many milli seconds interval between succeeding calls to Stats API in order to get the refreshed match event feed.
    parserIdName: "Statscore"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Settings for the production environment
var statscoreConfigProduction = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages: ["en"],
    urlPrefix: "http://api.stats.com/v1/stats/soccer/",
    apiKey: "mct9w8ws4fbpvj5w66se4tns",//"83839j82xy3mty4bf6459rnt",
    apiSecret: "3iqAJvFlU0Y4bjB7MNkA4tu8tDMNI4QVYkh",
    eventsInterval: 3000,  // how many milli seconds interval between succeeding calls.
    parserIdName: "Statscore"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Assign the settings for the current environment
var localConfiguration = statscoreConfigDevelopment;


// Settings properties
var configuration = localConfiguration;


module.exports = Parser;


const SportimoTimelineEvents = {
    "419": "Yellow",
    "408": "Corner",
    "418": "Red",
    "410": "Foul",
    "413": "Goal",
    "415": "Injury",
    "416": "Offside",
    "420": "Penalty",
    "421": "Goal",  // "Penalty-Goal"
    //"422": "Missed-Penalty",
    //"19": "Shot_off_Goal",   // forcing simple shot events to be registered as Shot_on_Goal as well
    "405": "Shot_on_Goal",
    // "414": "Substitution",
    "423": "Own_Goal",
    //"424": "Goal-Cancelled"
};


const SegmentProgressionEvents = {
    '429': 'First-half started',
    '445': 'Halftime',
    '430': 'Second-half started',
    '437': 'Finished regular time',
    '431': 'Extra-time first-half started',
    '432': 'Extra-time second-half started',
    '433': 'Penalty shoot-out started',
    '434': 'Finished after extratime',
    '435': 'Finished after penalties'
};


const MatchTerminationEvent = 451; // To finish
const MatchTerminationStates = [
    'finished',
    'cancelled',
    'deleted'
]; 

// Restrict to Only call this once in the lifetime of this object
function Parser(matchContext, feedServiceContext) {

    this.Name = configuration.parserIdName;
    this.isPaused = false;
    this.matchHandler = matchContext;
    this.feedService = feedServiceContext;
    this.scheduledTask = null;

    this.rabbitConnection = null;
    this.allEventsQueue = [];
    this.sportimoEventsQueue = [];

    // determines whether the match is simulated from previously recorded events in all_events kept in matchfeedstatuses
    this.simulationStep = 0;
    this.isSimulated = false;
    
    // the parser upon initialization will inquire about all team players and their parserids.
    this.matchPlayersLookup = {};

    // the parser upon initialization will inquire about the 2 teams (home and away) parserids
    this.matchTeamsLookup = {};


    // the parser upon initialization will inquire about the match parserid
    this.matchParserId = this.feedService.parserid || this.matchHandler.parserids[configuration.parserIdName];

    if (!this.matchParserId || !this.matchHandler.competition)
        return; // new Error('Invalid or absent match parserids');

    if (this.feedService.active !== 'undefined' && this.feedService.active != null)
        this.isPaused = !this.feedService.active;

    // the parser upon initialization will inquire about the competition mappings
    this.league = null;
}


Parser.prototype.init = function (cbk) {
    var that = this;
    var isActive = null;
    var startDate = null;

    // Execute multiple async functions in parallel getting the player ids and parserids mapping
    async.parallel([
        function (callback) {
            that.feedService.LoadTeam(that.matchHandler.home_team, function (error, response) {
                if (error)
                    return callback(error);

                response['matchType'] = 'home_team';
                if (!response.parserids)
                    return callback(new Error("No parserids[" + that.Name + "]  property in team id " + response.id + " document in Mongo. Aborting."));
                that.matchTeamsLookup[response.parserids[that.Name]] = response;
                callback(null);
            });
        },
        function (callback) {
            that.feedService.LoadTeam(that.matchHandler.away_team, function (error, response) {
                if (error)
                    return callback(error);

                response['matchType'] = 'away_team';
                if (!response.parserids)
                    return callback(new Error("No parserids[" + that.Name + "]  property in team id " + response.id + " document in Mongo. Aborting."));
                that.matchTeamsLookup[response.parserids[that.Name]] = response;
                callback(null);
            });
        },
        function (callback) {
            that.feedService.LoadParsedEvents(that.matchHandler.id, function (error, response) {
                if (error)
                    return callback(error);

                //if (response && response.parsed_eventids.length > 0) {
                //    _.forEach(response.parsed_eventids, function (eventid) {
                //        that.eventFeedSnapshot[eventid] = true;
                //    });
                //    if (response.incomplete_events)
                //        that.incompleteEventsLookup = response.incomplete_events;
                //}
                callback(null);
            });
        },
        function (callback) {
            that.feedService.LoadCompetition(that.matchHandler.competition, function (error, response) {
                if (error)
                    return callback(error);

                that.league = response;
                callback(null);

                // Get the state of the match, and accordingly try to schedule the timers for polling for the match events
                //that.GetMatchStatus(that.league.parserids[that.Name], that.matchParserId, function (err, feedIsActive, matchStartDate) {
                //    if (err)
                //        return callback(err);

                //    isActive = feedIsActive;
                //    startDate = matchStartDate;

                //    callback(null);
                //});
            });
        },
        function (callback) {
            that.feedService.LoadPlayers(that.matchHandler.home_team._id, function (error, response) {
                if (error)
                    return callback(error);

                // if (!_.isArrayLike(response))
                //     return callback();

                _.forEach(response, function (item) {
                    if (item.parserids && item.parserids[that.Name] && !that.matchPlayersLookup[item.parserids[that.Name]])
                        that.matchPlayersLookup[item.parserids[that.Name]] = item;
                });

                callback(null);
            });
        },
        function (callback) {
            that.feedService.LoadPlayers(that.matchHandler.away_team._id, function (error, response) {
                if (error)
                    return callback(error);

                // if (!_.isArrayLike(response))
                //     return callback();

                _.forEach(response, function (item) {
                    if (item.parserids && item.parserids[that.Name] && !that.matchPlayersLookup[item.parserids[that.Name]])
                        that.matchPlayersLookup[item.parserids[that.Name]] = item;
                });

                callback(null);
            });
        }
    ], function (error) {
        if (error) {
            console.log(error.message);
            return cbk(error);
        }


        var scheduleDate = that.matchHandler.start;

        if (!scheduleDate)
            return cbk(new Error('No start property defined on the match to denote its start time. Aborting.'));

        var formattedScheduleDate = moment.utc(scheduleDate);
        formattedScheduleDate.subtract(300, 'seconds');

        log.info('[Statscore parser]: Scheduled Date: ' + formattedScheduleDate.toDate());

        var itsNow = moment.utc();

        // If the match has started already, then circumvent startTime, unless the match has ended (is not live anymore)
        if (moment.utc(scheduleDate) < itsNow || (itsNow >= formattedScheduleDate && itsNow < moment.utc(scheduleDate))) {
            log.info('[Statscore parser]: Queue listener started immediately for matchid %s', that.matchHandler.id);
            that.StartQueueReceiver(() => { return cbk(null); });
        }
        else {
            // Schedule match feed event calls
            if (scheduleDate) {
                that.scheduledTask = scheduler.scheduleJob(that.matchHandler.id, formattedScheduleDate.toDate(), function () {
                    log.info('[Statscore parser]: Scheduled queue listener started for matchid %s', that.matchHandler.id);
                    that.StartQueueReceiver((rabbitErr) => {
                        if (rabbitErr) {
                            log.error(rabbitErr);
                            return cbk(rabbitErr);
                        }
                        return cbk(null);
                    });

                    //MessagingTools.sendPushToAdmins({ en: 'Statscore scheduled feed listener started for matchid: ' + that.matchHandler.id });
                });

                if (that.scheduledTask) {
                    log.info('[Statscore parser]: Timer scheduled successfully for matchid %s', that.matchHandler.id);

                    const job = _.find(scheduler.scheduledJobs, { name: that.matchHandler.id }); // that.scheduledTask;

                    const duration = moment.duration(moment(job.nextInvocation()).diff(itsNow));
                    const durationAsMinutes = duration.asMinutes();
                    if (job.nextInvocation())
                        log.info("[Statscore parser]: Queue listener will start in " + durationAsMinutes.toFixed(2) + " minutes");

                } else
                    if (!that.matchHandler.completed || that.matchHandler.completed == false) {
                        //        log.info('[Statscore parser]: Fetching only once feed events for matchid %s', that.matchHandler.id);
                        //        that.TickMatchFeed();
                        that.isSimulated = true;
                        log.info('[Statscore parser]: [Not yet implemented] Simulated events stream Timer started for matchid %s', that.matchHandler.id);
                        // that.StartQueueReplayer().bind(that);
                    }
            }
        }

        cbk(null);
    });
};



Parser.prototype.StartQueueReceiver = function (callback) {
    const that = this;
    const connString = `amqp://${configuration.queueName}:${configuration.apiSecret}@${configuration.urlPrefix}/${configuration.virtualHost}`;


    amqp.connect(connString, function (err, conn) {

        that.rabbitConnection = conn;
        if (err) {
            console.log('Error connecting: ' + err.message);
            return callback(err);
        }
        else {
            console.log('About to create channel ...');
            conn.createChannel(function (chErr, ch) {
                if (chErr) {
                    console.log('Error creating channel: ' + chErr.message);
                    conn.close();
                    return callback(chErr);
                }
                else {
                    const queue = 'gu-group';
                    console.log('About to connect to queue ' + queue);
                    ch.checkQueue(queue, (existErr, existOk) => {
                        if (existErr) {
                            console.error(queue + ' queue does not exist: ' + existErr);
                            conn.close();
                            return callback(existErr);
                        }
                        else {
                            ch.consume(queue, (msg) => {
                                const msgString = msg.content.toString('utf8');
                                //console.log(msgString);
                                const msgObj = JSON.parse(msgString);

                                if (msgObj.data && msgObj.data.event && msgObj.data.event.sport_id == 5 && msgObj.data.event.id == that.matchParserId) {
                                    // Consume msg properly
                                    that.ConsumeMessage(msgObj);

                                    // And then ack message
                                    ch.ack(msg, false);
                                }
                            }, { noAck: false }, (errConsume, consumeOk) => {
                                if (errConsume)
                                    console.error(errConsume);
                            });

                            return callback(null);
                        }
                    });


                    ch.on('error', (err) => {
                        console.error('Channel error: ' + err);
                        conn.close();
                    });
                }
            });
        }
    });

}




Parser.prototype.ConsumeMessage = function (message) {
    const that = this;


    if (message.data.incident) {
        const incident = message.data.incident;
        if (incident.action == 'insert' || incident.action == 'update') {

            // Check against match termination event(s)
            if (incident.incident_id == MatchTerminationEvent || _.indexOf(MatchTerminationStates, message.data.event.status_type) > -1) {
                log.info('[Statscore parser]: Intercepted a match Termination event.');

                that.feedService.EndOfMatch(that.matchHandler);
                // Send an event that the match is ended.
                setTimeout(function () {
                    that.Terminate();
                    // }, that.feedService.queueCount * 1000);
                }, 1000);
            }

            // If not a match termination, then check against segment change (progression) events
            else if (SegmentProgressionEvents[incident.incident_id]) {
                log.info('[Statscore parser]: Intercepted a Segment Advance event: ' + SegmentProgressionEvents[incident.incident_id]);
                that.feedService.AdvanceMatchSegment(that.matchHandler);
            }

            // If not segment change, check against mapped Sportimo timeline events then translate event and send to event queue
            else if (SportimoTimelineEvents[incident.incident_id]) {
                const translatedEvent = that.TranslateMatchEvent(message.data);
                that.feedService.AddEvent(translatedEvent);
            }
        }
    }
    else {
        // Get generic information about the match, not timeline info, such as pitch conditions, weather, other event details

    }

    // In any case, save event
    that.allEventsQueue.push(message);
    that.feedService.SaveParsedEvents(that.matchHandler._id, _.map(that.allEventsQueue, (e) => {
        return e.id + ':' + e.ut;
    }), [], [], [message]);
}


Parser.prototype.Terminate = function (callback) {

    // Cancel scheduled task, if existent
    if (this.scheduledTask)
        this.scheduledTask.cancel();

    this.isPaused = true;

    log.info('[Statscore parser]: Terminated and closed down parser');

    if (this.rabbitConnection)
        this.rabbitConnection.close();

    this.matchHandler = null;
    this.feedService = null;

    if (callback)
        callback(null);
};





// Helper Methods


Parser.prototype.TranslateMatchEvent = function (parserEvent) {
    const that = this;

    const incident = parserEvent.incident;

    // Basic event validation
    if (!parserEvent || !incident || !incident.incident_id || !this.matchHandler)// || this.isPaused == true)
        return null;

    // Validation for not supported event types
    if (!SportimoTimelineEvents[incident.incident_id])
        return null;

    var offensivePlayer = incident.subparticipant_id && this.matchPlayersLookup[incident.subparticipant_id] ?
        {
            id: this.matchPlayersLookup[incident.subparticipant_id].id,
            name: this.matchPlayersLookup[incident.subparticipant_id].name,
            team: this.matchPlayersLookup[incident.subparticipant_id].teamId
        } : null;
    //var defensivePlayer = parserEvent.defensivePlayer && this.matchPlayersLookup[parserEvent.defensivePlayer.playerId] ?
    //    {
    //        id: this.matchPlayersLookup[parserEvent.defensivePlayer.playerId].id,
    //        name: this.matchPlayersLookup[parserEvent.defensivePlayer.playerId].name,
    //        team: this.matchPlayersLookup[parserEvent.defensivePlayer.playerId].teamId
    //    } : null;
    //var replacedPlayer = parserEvent.replacedPlayer && this.matchPlayersLookup[parserEvent.replacedPlayer.playerId] ?
    //    {
    //        id: this.matchPlayersLookup[parserEvent.replacedPlayer.playerId].id,
    //        name: this.matchPlayersLookup[parserEvent.replacedPlayer.playerId].name,
    //        team: this.matchPlayersLookup[parserEvent.replacedPlayer.playerId].teamId
    //    } : null;

    const isTimelineEvent = true;
    const eventName = SportimoTimelineEvents[incident.incident_id];
    // No need to do that since names are inside our pre-defined SportimoTimelineEvents dictionary, but keep it for other events in the future:
    //eventName = eventName.replace(/ /g, "_").replace(/-/g, "_"); // global string replacement
    const eventId = incident.id;
    const eventTimeFromMatchStart = +(_.split(incident.event_time, ':')[0]);    // get number conversion of the first part from a value such as "77:00"
    let matchState = null;
    switch (incident.event_status_id) {
        case 1:         // not started
            matchState = 0;
            break;
        case 33:        // first half started
            matchState = 1;
            break;
        case 9:         // halftime
            matchState = 2;
            break;
        case 34:        // second half started
            matchState = 3;
            break;
        case 11:        // (normal time) finished
        case 48:        // waiting for extra time
            matchState = 4;
            break;
        case 35:        // extra time first half
            matchState = 5;
            break;
        case 37:        // extra time half-time
            matchState = 6;
            break;
        case 36:        // extra time second half
            matchState = 7;
            break;
        case 14:        // finished after extra time
        case 142:       // waiting for penalty
            matchState = 8;
            break;
        case 141:       // penalty shootout
        case 13:        // finished after penalties
        case 152:       // to finish
            matchState = 9;
            break;
        // Not used event_status_id codes:
        // 2: Interrupted
        // 3: Cancelled
        // 5: Postponed
        // 6: Start delayed
        // 7: Abandoned
        // 12: Finished awarded win
    }

    var translatedEvent = {
        type: 'Add',
        time: eventTimeFromMatchStart,   // Make sure what time represents. Here we assume time to be the match minute from the match start.
        data: {
            id: eventId,
            parserids: {},
            status: 'active',
            type: eventName,
            state: matchState,
            sender: this.Name,
            time: eventTimeFromMatchStart,
            timeline_event: isTimelineEvent,
            description: {},
            team: this.matchTeamsLookup[incident.participant_id] ? this.matchTeamsLookup[incident.participant_id].matchType : null,
            team_id: this.matchTeamsLookup[incident.participant_id] ? this.matchTeamsLookup[incident.participant_id].id : null,
            match_id: this.matchHandler._id,
            players: [],
            stats: {}
        },
        created: moment.utc().toDate() // ToDo: Infer creation time from match minute
    };

    translatedEvent.data.description['en'] = (incident.subparticipant_name ? (incident.subparticipant_name + ' ') : '') + incident.participant_name + ' ' + incident.incident_name;

    // ToDo: In certain match events, we may want to split the event in two (or three)
    if (offensivePlayer)
        translatedEvent.data.players.push(offensivePlayer);
    // if (defensivePlayer)
    //     translatedEvent.data.players.push(defensivePlayer);
    //if (parserEvent.incident_id == 414 && replacedPlayer)
    //    translatedEvent.data.players.push(replacedPlayer);

    // Make sure that the value set here is the quantity for the event only, not for the whole match    
    translatedEvent.data.stats[eventName] = 1;
    translatedEvent.data.parserids[that.Name] = eventId;

    if (incident.action == 'update') {
        translatedEvent.type = 'Update';
    }

    return translatedEvent;
};



