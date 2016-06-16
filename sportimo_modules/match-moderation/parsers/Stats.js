var scheduler = require('node-schedule');
var needle = require("needle");
var crypto = require("crypto-js");
var async = require('async');
var _ = require('lodash');
var moment = require('moment');
var log = require('winston');
var mongoose = require('mongoose');
var matches = mongoose.models.scheduled_matches;

// Settings for the development environment

// languageMapping maps Sportimo langage locale to Stats.com language Ids. For a list of ISO codes, see https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
var languageMapping = {
    "ar": "10", // arabic
    "en": "1", // english
    "yi": "28", // yiddish (hebrew)
    "ru": "16"

    // Add all required language mappings here from Stats.com
};


var statsComConfigDevelopment = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages: ["en"],
    urlPrefix: "http://api.stats.com/v1/stats/soccer/",
    apiKey: "mct9w8ws4fbpvj5w66se4tns",//"83839j82xy3mty4bf6459rnt",
    apiSecret: "53U7SH6N5x", //"VqmfcMTdQe",
    //gameServerUrlPrefix : "http://gameserverv2-56657.onmodulus.net/v1/",
    //gameServerTeamApi : "data/teams",
    //gameServerPlayerApi : "data/players",
    eventsInterval: 5000,  // how many milli seconds interval between succeeding calls to Stats API in order to get the refreshed match event feed.
    parserIdName: "Stats"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Settings for the production environment
var statsComConfigProduction = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages: ["en"],
    urlPrefix: "http://api.stats.com/v1/stats/soccer/",
    apiKey: "mct9w8ws4fbpvj5w66se4tns",//"83839j82xy3mty4bf6459rnt",
    apiSecret: "53U7SH6N5x", //"VqmfcMTdQe",
    eventsInterval: 3000,  // how many milli seconds interval between succeeding calls to Stats API in order to get the refreshed match event feed.
    parserIdName: "Stats"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Assign the settings for the current environment
var localConfiguration = statsComConfigDevelopment;


// Settings properties
var configuration = localConfiguration;


// the parser upon initialization will inquire about the competition mappings
var league = null;

var supportedEventTypes = [2, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 28, 30, 31, 32, 33, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53];
var timelineEvents = {
    "2": "Yellow",
    "5": "Corner",
    "7": "Red",
    "8": "Foul",
    "11": "Goal",
    "14": "Injury",
    "16": "Offside",
    "17": "Penalty",
    "18": "Penalty",
    "20": "Shot_on_Goal",
    "22": "Substitution",
    "28": "Own_Goal"
};

var penaltyShootOutEvents = [30, 41]; // 30: goal, 41: missed

var matchSegmentProgressionEventTypes = [21, 13, 35, 37, 38];

var penaltiesSegmentStarted = false;


module.exports = Parser;

// Restrict to Only call this once in the lifetime of this object
function Parser(matchContext, feedServiceContext){

    this.Name = configuration.parserIdName;
    this.isPaused = false;
    this.matchHandler = matchContext;
    this.feedService = feedServiceContext;
    this.recurringTask = null;
    this.scheduledTask = null;
    
    // holder of the match events in the feed that are fetched by the most recent call to GetMatchEvents.
    this.eventFeedSnapshot = { };
    
    // the parser upon initialization will inquire about all team players and their parserids.
    this.matchPlayersLookup = {};
    
    // the parser upon initialization will inquire about the 2 teams (home and away) parserids
    this.matchTeamsLookup = {};
    

    // the parser upon initialization will inquire about the match parserid
    this.matchParserId = this.feedService.parserid || this.matchHandler.parserids[configuration.parserIdName];
   
    if (!this.matchParserId || !this.matchHandler.competition)
        return; // new Error('Invalid or absent match parserids');
        
    if (this.feedService.active)
        this.isPaused = !this.feedService.active;
        
    this.ticks = 1;
        
    // A queue to sequentially process inbound events, work in progress
    this.eventQueue = async.queue(function(task, callback) {
        if (task.eventType && task.eventType == 'event')
        {
            setTimeout( this.feedService.AddEvent(task), 200);
        }
        else
        if (task.eventType && task.eventType == 'segment')
        {
            
        }
        else
        if (task.eventType && task.eventType == 'termination')
        {
            
        }
        else
        {
            async.setImmediate(function () {
                callback(null);
            });
        }
    });
};

Parser.prototype.init = function(cbk)
{
    var that = this;
    // Execute multiple async functions in parallel getting the player ids and parserids mapping
    async.parallel([
        function(callback) {
            that.feedService.LoadTeam(that.matchHandler.home_team, function(error, response) {
                if (error) 
                    return callback(error);

                response['matchType'] = 'home_team';
                if (!response.parserids)
                    return callback(new Error("No parserids[" + that.Name + "]  property in team id " + response.id + " document in Mongo. Aborting."));
                that.matchTeamsLookup[response.parserids[this.Name]] = response;
                callback(null);
            });
        },
        function(callback) {
            that.feedService.LoadTeam(that.matchHandler.away_team, function(error, response) {
                if (error) 
                    return callback(error);

                response['matchType'] = 'away_team';
                if (!response.parserids)
                    return callback(new Error("No parserids[" + that.Name + "]  property in team id " + response.id + " document in Mongo. Aborting."));
                that.matchTeamsLookup[response.parserids[that.Name]] = response;
                callback(null);
            });
        },
        function(callback) {
            that.feedService.LoadParsedEvents(that.matchHandler.id, function(error, response) {
                if (error) 
                    return callback(error);
                    
                if (response  && response.parsed_eventids.length > 0)
                {
                    _.forEach(response.parsed_eventids, function(eventid) {
                        that.eventFeedSnapshot[eventid] = true;
                    });
                }
                callback(null);
            });
        },
        function(callback) {
            that.feedService.LoadCompetition(that.matchHandler.competition, function(error, response) {
                if (error) 
                    return callback(error);

                league = response;

                // Get the state of the match, and accordingly try to schedule the timers for polling for the match events
                GetMatchStatus(league.parserids[that.Name], that.matchParserId, function(err, isActive, startDate) {
                    if (err)
                        return callback(err);
                    
                    var scheduleDate = that.matchHandler.start || startDate;  
                    if (!scheduleDate)
                        return callback(new Error('No start property defined on the match to denote its start time. Aborting.'));

                    var formattedScheduleDate = moment.utc(scheduleDate);
                    formattedScheduleDate.subtract(300, 'seconds');

                    var interval = that.feedService.interval || configuration.eventsInterval;
                    if (interval < 1000)
                        interval = 1000;

                    // If the match has started already, then circumvent startTime, unless the match has ended (is not live anymore)
                    if (formattedScheduleDate < moment.utc() && isActive) 
                    {
                        log.info('[Stats parser]: Timer started for matchid %s', that.matchHandler.id);
                        that.recurringTask = setInterval(Parser.prototype.TickMatchFeed.bind(that), interval);
                    }
                    else {
                        // Schedule match feed event calls
                        if (scheduleDate)
                        {
                            that.scheduledTask = scheduler.scheduleJob(formattedScheduleDate.toDate(), function()
                            {
                                log.info('[Stats parser]: Timer started for matchid %s', that.matchHandler.id);
                                that.recurringTask = setInterval(Parser.prototype.TickMatchFeed.bind(that), interval);
                            });
                            if (that.scheduledTask)
                                log.info('[Stats parser]: Timer scheduled successfully for matchid %s', that.matchHandler.id);
                            else
                                if (!that.matchHandler.completed|| that.matchHandler.completed == false)
                                {
                                    log.info('[Stats parser]: Fetching only once feed events for matchid %s', that.matchHandler.id);
                                    that.TickMatchFeed();
                                }
                        }
                    }

                    callback(null);
                });
            });
        },
        function(callback) {
            that.feedService.LoadPlayers(that.matchHandler.home_team._id, function(error, response) {
                if (error)
                    return callback(error);

                // if (!_.isArrayLike(response))
                //     return callback();

                _.forEach(response, function(item) {
                    if (item.parserids && item.parserids[that.Name] && !that.matchPlayersLookup[item.parserids[that.Name]])
                        that.matchPlayersLookup[item.parserids[that.Name]] = item;
                });

                callback(null);
            });
        },
        function(callback) {
            that.feedService.LoadPlayers(that.matchHandler.away_team._id, function(error, response) {
                if (error)
                    return callback(error);

                // if (!_.isArrayLike(response))
                //     return callback();

                _.forEach(response, function(item) {
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

        cbk(null);
    });
};


Parser.prototype.Terminate = function(callback)
{
    log.info('[Stats parser]: Terminating and closing down.');
   
    // End recurring task
    clearInterval(this.recurringTask);
    // Cancel scheduled task, if existent
    if (this.scheduledTask)
        this.scheduledTask.cancel();

    log.info('[Stats parser]: Terminated and closed down parser for matchid %s', this.matchHandler.id);
    
    if (callback)
        callback(null);
}

// Helper Methods

// Approximate calculation of season Year from current date
var GetSeasonYear = function () {
    var now = new Date();
    if (now.getMonth() > 6)
        return now.getFullYear();
    else return now.getFullYear() - 1;
};

var GetMatchEvents = function (leagueName, matchId, callback) {
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/events/" + matchId + "?pbp=true&" + signature; // &box=true for boxing statistics

    needle.get(url, { timeout: 50000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));
            var events = response.body.apiResults[0].league.season.eventType[0].events[0].pbp;
            var teams = response.body.apiResults[0].league.season.eventType[0].events[0].teams;
            var matchStatus = response.body.apiResults[0].league.season.eventType[0].events[0].eventStatus;
            callback(null, events, teams, matchStatus);
        }
        catch (err) {
            console.log(err);
            if(callback)
            return callback(err);
        }
    });
};

// Number of ticks before full data retrieval
var numberOfTicksBeforeBoxscore = 10;

Parser.prototype.GetMatchEventsWithBox = function (leagueName, matchId, manualCallback) {
    GetMatchEventsWithBox(leagueName, matchId, null, null, manualCallback);
}

var GetMatchEventsWithBox = function (leagueName, matchId, callback, context, manualCallback) {
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/events/" + matchId + "?box=true&pbp=true&" + signature; // &box=true for boxing statistics

    needle.get(url, { timeout: 50000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));

            var events = response.body.apiResults[0].league.season.eventType[0].events[0].pbp;
            var teams = response.body.apiResults[0].league.season.eventType[0].events[0].teams;
            var matchStatus = response.body.apiResults[0].league.season.eventType[0].events[0].eventStatus;
            var boxscores = response.body.apiResults[0].league.season.eventType[0].events[0].boxscores;
            UpdateMatchStats(matchId, boxscores, context, manualCallback);
         
         if(callback)
            callback(null, events, teams, matchStatus);
        }
        catch (err) {
            if(callback)
            return callback(err);
            else
             return manualCallback(err);
        }
    });
};

var UpdateMatchStats = function (matchId, boxscores, that, callback) {
   
    matches.findOne({ 'moderation.parserid': matchId }, function (err, match) {       
        // find home_team in match stats and update to boxscores[0]
        var homeStats = _.find(match.stats, {"name": "home_team"});
        if(!homeStats)
            homeStats = match.stats.push({"name": "home_team"});
        homeStats.possession = boxscores[0].teamStats.possessionPercentage;
        homeStats.shotsOnGoal = boxscores[0].teamStats.shotsOnGoal;
        homeStats.saves = boxscores[0].teamStats.saves;
        homeStats.crosses = boxscores[0].teamStats.crosses;
        homeStats.passes = boxscores[0].teamStats.touches.passes;
        // find away_team in match stats and update to boxscores[1]
        var awayStats = _.find(match.stats, {"name": "away_team"});
        if(!homeStats)
            awayStats = match.stats.push({"name": "away_team"});
        awayStats.possession = boxscores[1].teamStats.possessionPercentage;
        awayStats.shotsOnGoal = boxscores[1].teamStats.shotsOnGoal;
        awayStats.saves = boxscores[1].teamStats.saves;
        awayStats.crosses = boxscores[1].teamStats.crosses;
        awayStats.passes = boxscores[1].teamStats.touches.passes;

        match.markModified('stats');
        match.save(function(err,result){
            if(callback)
            callback(err,result);
            else
            console.log("[Stats.js:345]  Update of match stats handled succesfully");

             that.feedService.emitStats(result._id, result.stats);
        })
    });

}


var GetMatchStatus = function (leagueName, matchId, callback) {
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/scores/" + matchId + "?" + signature;

    needle.get(url, { timeout: 30000, headers: { accept: "application/json" } }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));
            var status = response.body.apiResults[0].league.season.eventType[0].events[0].startDate[1];
            var isActive = response.body.apiResults[0].league.season.eventType[0].events[0].eventStatus.isActive;
            callback(null, isActive, status);
        }
        catch (err) {
            return callback(err);
        }
    });
};


Parser.prototype.TranslateMatchEvent = function(parserEvent)
{
    if (!parserEvent)
        return null;

    //Not supported event types
    if (_.indexOf(supportedEventTypes, parserEvent.playEvent.playEventId) == -1)
        return null;

    var offensivePlayer = parserEvent.offensivePlayer  && this.matchPlayersLookup[parserEvent.offensivePlayer.playerId] ? 
        {
            id : this.matchPlayersLookup[parserEvent.offensivePlayer.playerId].id,
            name : this.matchPlayersLookup[parserEvent.offensivePlayer.playerId].name,
            team : this.matchPlayersLookup[parserEvent.offensivePlayer.playerId].teamId
        } : null;
    // var defensivePlayer = parserEvent.defensivePlayer && matchPlayersLookup[parserEvent.defensivePlayer.playerId] ? 
    //     {
    //         id : matchPlayersLookup[parserEvent.defensivePlayer.playerId].id,
    //         name : matchPlayersLookup[parserEvent.defensivePlayer.playerId].name,
    //         team : matchPlayersLookup[parserEvent.defensivePlayer.playerId].teamId
    //     } : null;

    var isTimelineEvent = timelineEvents[parserEvent.playEvent.playEventId] ? true : false
    var eventName = isTimelineEvent == true ? timelineEvents[parserEvent.playEvent.playEventId] : parserEvent.playEvent.name;
    eventName = eventName.replace(/ /g, "_").replace(/-/g, "_"); // global string replacement


    var translatedEvent = {
        type: 'Add',
        time: parserEvent.time.additionalMinutes ? parserEvent.time.minutes + parserEvent.time.additionalMinutes : parserEvent.time.minutes,   // Make sure what time represents. Here we assume time to be the match minute from the match start.
        data: {
            id: parserEvent.sequenceNumber,
            status: 'active',
            type: eventName,
            state: TranslateMatchPeriod(parserEvent.period, parserEvent.playEvent.playEventId),
            sender: configuration.parserIdName,
            time: parserEvent.time.additionalMinutes ? parserEvent.time.minutes + parserEvent.time.additionalMinutes : parserEvent.time.minutes, // ToDo: replace with a translateTime method (take into acount additionalMinutes)
            timeline_event: isTimelineEvent,
            team: this.matchTeamsLookup[parserEvent.teamId] ? this.matchTeamsLookup[parserEvent.teamId].matchType : null,
            match_id: this.matchHandler._id,
            players: [],
            stats: {}
        },
        created: moment.utc().toDate() // ToDo: Infer creation time from match minute
    };

    // ToDo: In certain match events, we may want to split the event in two (or three)
    if (offensivePlayer)
        translatedEvent.data.players.push(offensivePlayer);
    // if (defensivePlayer)
    //     translatedEvent.data.players.push(defensivePlayer);

    // Make sure that the value set here is the quantity for the event only, not for the whole match    
    translatedEvent.data.stats[eventName] = 1;

    return translatedEvent;
};


var TranslateMatchPeriod = function (statsPeriod, eventId) {
    switch (statsPeriod) {
        case 0: return 0;
        case 1: return 1;
        case 2: return 3;
        case 3: return 5;
        case 4:
            if (_.indexOf(penaltyShootOutEvents, eventId) > -1)
                return 9;
            else
                return 7;
    }
}

var TranslateMatchSegment = function (parserEvent) {
    if (!parserEvent)
        return null;

    //Not supported event types
    if (_.indexOf(matchSegmentProgressionEventTypes, parserEvent.playEvent.playEventId) == -1)
        return null;

    return true;   // return anything but null
};


// and now, the functions that can be called from outside modules.
Parser.prototype.TickMatchFeed = function() {
    var that = this;
    try
    {
        if (!that.matchHandler || !that.matchParserId || !that.feedService)
        {
            console.log('Invalid call of TickMatchFeed before binding to a Stats-supported match');
            return;
        }

        var leagueName = league.parserids[that.Name];
        
        if (that.ticks % numberOfTicksBeforeBoxscore == 0) {
            GetMatchEventsWithBox(leagueName, that.matchParserId, that.TickCallback.bind(that), that);
            that.ticks = 1;
        } else {
            GetMatchEvents(leagueName, that.matchParserId, that.TickCallback.bind(that));
            log.info('[Match module] Tick to match stats: '+ (numberOfTicksBeforeBoxscore-that.ticks));
            that.ticks++;
        }

    }
    catch (methodError) {
        log.error('Stats parser tick error: ' + methodError.message);
    }
};


Parser.prototype.TickCallback = function (error, events, teams, matchStatus) {
    if (error) {
        console.log('error in TickMatchFeed: ' + error.message);
        return;
    }
    
    var that = this;

    // Produce the diff with eventFeedSnapshot
    var eventsDiff = _.filter(events, function(item) {
        return !that.eventFeedSnapshot[item.sequenceNumber + ":" + item.playEvent.playEventId];
    });
    _.forEach(events, function(event) {
        that.eventFeedSnapshot[event.sequenceNumber + ":" + event.playEvent.playEventId] = true;
    });

    //if (Math.random() < 0.03)
    //    log.info('[Feed Stats Parser]: Stats call returned ' + events.length + ' events from the feed');

    // Nothing to add
    if (eventsDiff.length == 0)
        return;

    that.feedService.SaveParsedEvents(that.matchHandler._id, _.keys(that.eventFeedSnapshot));
        
    if (that.isPaused != true)
    {
        // Translate all events in eventsDiff and send them to feedService
        _.forEach(eventsDiff, function (event) {
            // First try parsing a normal event
            var translatedEvent = that.TranslateMatchEvent(event);
            if (translatedEvent) {
                that.feedService.AddEvent(translatedEvent);
                
                // Determine if the event is a successful panalty, in this case create an extra Goal event
                if (event.playEvent && event.playEvent.playEventId && event.playEvent.playEventId == 17) {
                    setTimeout(function () {
                        var goalEvent = _.cloneDeep(event);
                        goalEvent.playEvent.playEventId = 11;
                        goalEvent.playEvent.name = 'Goal';
                        var translatedGoalEvent = that.TranslateMatchEvent(goalEvent);
                        that.feedService.AddEvent(translatedGoalEvent);
                    }, 500);
                }

                // Determine if the Penalties Segment has just started (in this case, advance the segment)
                if (translatedEvent.data.state == 9) {
                    if (!penaltiesSegmentStarted) {
                        penaltiesSegmentStarted = true;
                        that.feedService.AdvanceMatchSegment(that.matchHandler);
                    }
                }
            }
            else {
                // Then try to parse a match segment advancing event
                var translatedMatchSegment = TranslateMatchSegment(event);
                if (translatedMatchSegment)
                {
                    log.info('[Stats parser]: Intercepted a Segment Advance event.');
                    that.feedService.AdvanceMatchSegment(that.matchHandler);
                }
            }
        });
    }

    var lastEvent = _.findLast(events, function (n) {
        return n.sequenceNumber;
    });

    // Game Over?
    if (lastEvent.playEvent.playEventId == 10 || (matchStatus.name && matchStatus.name == "Final")) {
        log.info('[Stats parser]: Intercepted a match Termination event.');
       
        // Send an event that the match is ended.
        that.feedService.EndOfMatch(that.matchHandler);
        that.Terminate();
    }

};







    /* 
    // Annex
    
    // This is just for reference, depicts all Stats.com event ids and their name
    var eventTypes = [
        {
            "playEventId": 1,
            "name": "Ball Location"
        }, {
            "playEventId": 2,
            "name": "Caution"   // yellow card
        }, {
            "playEventId": 3,
            "name": "Clear"
        }, {
            "playEventId": 4,
            "name": "Comments"
        }, {
            "playEventId": 5,
            "name": "Corner Kick"
        }, {
            "playEventId": 6,
            "name": "Cross"
        }, {
            "playEventId": 7,
            "name": "Expulsion" // red card
        }, {
            "playEventId": 8,
            "name": "Foul"
        }, {
            "playEventId": 9,
            "name": "Free Kick"
        }, {
            "playEventId": 10,
            "name": "Game Over"
        }, {
            "playEventId": 11,
            "name": "Goal"
        }, {
            "playEventId": 12,
            "name": "Goalkeeper Punt"
        }, {
            "playEventId": 13,
            "name": "Half Over"
        }, {
            "playEventId": 14,
            "name": "Injury"
        }, {
            "playEventId": 15,
            "name": "New Player"
        }, {
            "playEventId": 16,
            "name": "Offside"
        }, {
            "playEventId": 17,
            "name": "Penalty Kick - Good"
        }, {
            "playEventId": 18,
            "name": "Penalty Kick - No Good"
        }, {
            "playEventId": 19,
            "name": "Shot"
        }, {
            "playEventId": 20,
            "name": "Shot on Goal"
        }, {
            "playEventId": 21,
            "name": "Start Half"
        }, {
            "playEventId": 22,
            "name": "Substitution"
        }, {
            "playEventId": 23,
            "name": "Starting Lineups - Home"
        }, {
            "playEventId": 24,
            "name": "Starting Lineups - Visit"
        }, {
            "playEventId": 25,
            "name": "Coach - Home"
        }, {
            "playEventId": 26,
            "name": "Coach - Visit"
        }, {
            "playEventId": 27,
            "name": "Game Info"
        }, {
            "playEventId": 28,
            "name": "Own Goal"
        }, {
            "playEventId": 29,
            "name": "Goalie Change"
        }, {
            "playEventId": 30,
            "name": "Shootout Goal"
        }, {
            "playEventId": 31,
            "name": "Shootout Save"
        }, {
            "playEventId": 32,
            "name": "Hand Ball Foul"
        }, {
            "playEventId": 33,
            "name": "Shootout"
        }, {
            "playEventId": 34,
            "name": "Game Start"
        }, {
            "playEventId": 35,
            "name": "Half-Time"
        }, {
            "playEventId": 36,
            "name": "End of Regulation"
        }, {
            "playEventId": 37,
            "name": "Begin Overtime"
        }, {
            "playEventId": 38,
            "name": "End Overtime"
        }, {
            "playEventId": 39,
            "name": "Save (Shot off Target)"
        }, {
            "playEventId": 40,
            "name": "Save (Shot on Target)"
        }, {
            "playEventId": 41,
            "name": "Shootout Miss"
        }, {
            "playEventId": 42,
            "name": "Left Flank Attack"
        }, {
            "playEventId": 43,
            "name": "Center Flank Attack"
        }, {
            "playEventId": 44,
            "name": "Right Flank Attack"
        }, {
            "playEventId": 45,
            "name": "Long Ball Attack"
        }, {
            "playEventId": 46,
            "name": "Goal Kick"
        }, {
            "playEventId": 47,
            "name": "Throw-In"
        }, {
            "playEventId": 48,
            "name": "Manager Expulsion"
        }, {
            "playEventId": 49,
            "name": "Defensive Action"
        }, {
            "playEventId": 50,
            "name": "Pass"
        }, {
            "playEventId": 51,
            "name": "Run With Ball"
        }, {
            "playEventId": 52,
            "name": "Tackle"
        }, {
            "playEventId": 53,
            "name": "Deflection"
        }, {
            "playEventId": 54,
            "name": "Clock Start"
        }, {
            "playEventId": 55,
            "name": "Clock Stop"
        }, {
            "playEventId": 56,
            "name": "Clock Inc"
        }, {
            "playEventId": 57,
            "name": "Clock Dec"
        }, {
            "playEventId": 58,
            "name": "Abandoned"
        }, {
            "playEventId": 59,
            "name": "Delayed"
        }, {
            "playEventId": 60,
            "name": "10-Yard"
        }, {
            "playEventId": 61,
            "name": "Back-Pass"
        }, {
            "playEventId": 62,
            "name": "Time"
        }, {
            "playEventId": 65,
            "name": "Delay Over"
        }, {
            "playEventId": 66,
            "name": "Injury Time"
        }];
    */