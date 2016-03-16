var scheduler = require('node-schedule');
var needle = require("needle");
var crypto = require("crypto-js");
var async = require('async');
var _ = require('lodash');

// Settings for the development environment

// languageMapping maps Sportimo langage locale to Stats.com language Ids. For a list of ISO codes, see https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
var languageMapping = {
    "ar": "10", // arabic
    "en": "1", // english
    "yi": "28" // yiddish (hebrew)
    
    // Add all required language mappings here from Stats.com
};
    

var statsComConfigDevelopment = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages : ["en"],
    urlPrefix : "http://api.stats.com/v1/stats/soccer/",
    apiKey : "83839j82xy3mty4bf6459rnt",
    apiSecret : "VqmfcMTdQe",
    //gameServerUrlPrefix : "http://gameserverv2-56657.onmodulus.net/v1/",
    //gameServerTeamApi : "data/teams",
    //gameServerPlayerApi : "data/players",
    eventsInterval : 1000,  // how many milli seconds interval between succeeding calls to Stats API in order to get the refreshed match event feed.
    parserIdName : "Stats"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Settings for the production environment
var statsComConfigProduction = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages : ["en"],
    urlPrefix : "http://api.stats.com/v1/stats/soccer/",
    apiKey : "83839j82xy3mty4bf6459rnt",
    apiSecret : "VqmfcMTdQe",
    eventsInterval : 1000,  // how many milli seconds interval between succeeding calls to Stats API in order to get the refreshed match event feed.
    parserIdName : "Stats"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Assign the settings for the current environment
var localConfiguration = statsComConfigDevelopment;



var Parser = { };

// Settings properties
var configuration = localConfiguration;

//update configuration settings with this object settings
if (Parser.interval)
    configuration.eventsInterval = Parser.interval;
if (Parser.parsername)
    configuration.parserIdName = Parser.parsername;
    
var matchHandler = null;
var feedService = null;
var recurringTask = null;

// holder of the match events in the feed that are fetched by the most recent call to GetMatchEvents.
var eventFeedSnapshot = [];

// the parser would like to know the match parserid
var matchParserId = null;

// ToDo: the parser would like to know all team players and their parserids.
var matchPlayersLookup = {};

// ToDo: the parser would like to know the 2 teams (home and away) parserids
var matchTeamsLookup = {};

    /* 
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
            
var supportedEventTypes = [2, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 28,30, 31, 32, 33, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53];
var matchSegmentProgressionEventTypes = [21, 13, 35, 37, 38];

Parser.Name = configuration.parserIdName;

// Restrict to Only call this once in the lifetime of this object
Parser.init = _.once(function(matchContext, feedServiceContext){
//        return console.log("[Stats] Parser service initiliazed");
    matchHandler = matchContext;
    feedService = feedServiceContext;
    
    // fill in the matchParserId var
    if (!matchHandler.data.parserids || !matchHandler.data.parserids[configuration.parserIdName])
        return;
        
    matchParserId = matchHandler.data.parserids[configuration.parserIdName];
    
    // Schedule match feed event calls
    if (matchHandler.data.start)
    {
        scheduler.scheduleJob(matchHandler.data.start, function()
        {
            recurringTask = setInterval(this.TickMatchFeed, configuration.eventsInterval);
        });
    }
    
    // Set the team ids and parserids mapping
    var homeTeam = _.cloneDeep(matchContext.home_team);
    homeTeam['matchType'] = 'home_team';
    matchTeamsLookup[matchContext.home_team.parserids[matchParserId]] = homeTeam;
    
    var awayTeam = _.cloneDeep(matchContext.away_team);
    awayTeam['matchType'] = 'away_team';
    matchTeamsLookup[matchContext.away_team.parserids[matchParserId]] = awayTeam;
    
    // Execute multiple async functions in parallel getting the player ids and parserids mapping
    async.parallel([
        function(callback) {
            feedServiceContext.LoadPlayers(matchContext.home_team._id, function(error, response) {
                if (error)
                    return callback(error);
                    
                if (!_.isArrayLike(response))
                    return callback();
                    
                _.forEach(response, function(item) {
                    if (item.parserids[matchParserId] && !matchPlayersLookup[item.parserids[matchParserId]])
                        matchPlayersLookup[item.parserids[matchParserId]] = item;
                });
                
                return callback();
            });
        },
        function(callback) {
            feedServiceContext.LoadPlayers(matchContext.away_team._id, function(error, response) {
                if (error)
                    return callback(error);
                    
                if (!_.isArrayLike(response))
                    return callback();
                    
                _.forEach(response, function(item) {
                    if (item.parserids[matchParserId] && !matchPlayersLookup[item.parserids[matchParserId]])
                        matchPlayersLookup[item.parserids[matchParserId]] = item;
                });
                
                return callback();
            });
        }
        ], function(error) {
            if (error)
                console.log(error.message);
        });
});

// Helper Methods

// Approximate calculation of season Year from current date
var GetSeasonYear = function()
{
    var now = new Date();
    if (now.getMonth() > 6)
        return now.getFullYear();
    else return now.getFullYear() - 1;
};

var GetMatchEvents = function(leagueName, matchId, callback)
{
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/events/" + matchId + "?pbp=true&" + signature;
    
    needle.get(url, function(error, response)
    {
        if (error)
            return callback(error);
        try {
            var events = response.body.apiResults[0].league.season.eventType[0].events[0].pbp;
            var teams = response.body.apiResults[0].league.season.eventType[0].events[0].teams;
            var matchStatus = response.body.apiResults[0].league.season.eventType[0].events[0].eventStatus;
            callback(null, events, teams, matchStatus);
        }
        catch(err) {
            return callback(err);
        }
    });        
};


var TranslateMatchEvent = function(parserEvent)
{
    if (!parserEvent)
        return null;
    
    //Not supported event types
    if (_.indexOf(supportedEventTypes, parserEvent.playEvent.playEventId) == -1)
        return null;
    
    var defensivePlayer = parserEvent.defensivePlayer && matchPlayersLookup[parserEvent.defensivePlayer.playerId] ? 
        {
            id : matchPlayersLookup[parserEvent.defensivePlayer.playerId]._id,
            name : matchPlayersLookup[parserEvent.defensivePlayer.playerId].name,
            team : matchPlayersLookup[parserEvent.defensivePlayer.playerId].team,
            $$hashKey : ''
        } : null;
    var offensivePlayer = parserEvent.offensivePlayer  && matchPlayersLookup[parserEvent.offensivePlayer.playerId] ? 
        {
            id : matchPlayersLookup[parserEvent.offensivePlayer.playerId]._id,
            name : matchPlayersLookup[parserEvent.offensivePlayer.playerId].name,
            team : matchPlayersLookup[parserEvent.offensivePlayer.playerId].team,
            $$hashKey : ''
        } : null;
    
    var translatedEvent = {
        type: 'Add',
        time: parserEvent.time.minutes,   // Make sure what time represents. Here we assume time to be the match minute from the match start.
        data: {
            id: parserEvent.sequenceNumber,
            status: 'active',
            state: 0,
            sender: configuration.parserIdName,
            time: parserEvent.time.minutes,
            timeline_event: true,
            team: matchTeamsLookup[parserEvent.teamId] ? matchTeamsLookup[parserEvent.teamId].matchType : null,
            match_id: matchHandler.data._id,
            players: [],
            stats: { }
        },
        created: new Date() // ToDo: Infer creation time from match minute
    };
    
    // ToDo: In certain match events, we may want to split the event in two (or three)
    if (defensivePlayer)
        translatedEvent.players.push(defensivePlayer);
    if (offensivePlayer)
        translatedEvent.players.push(offensivePlayer);
    
    // Make sure that the value set here is the quantity for the event only, not for the whole match    
    translatedEvent.stats[parserEvent.playEvent.name] = 1;
    
    return translatedEvent;
};


var TranslateMatchSegment = function(parserEvent)
{
    if (!parserEvent)
        return null;
    
    //Not supported event types
    if (_.indexOf(matchSegmentProgressionEventTypes, parserEvent.playEvent.playEventId) == -1)
        return null;
    
    return 1;   // return anything but null
};

// and now, the functions that can be called from outside modules.
Parser.TickMatchFeed = function() {
    if (!matchHandler || !matchParserId || !feedService)
    {
        console.log('Invalid call of TickMatchFeed before binding to a Stats-supported match');
        return;
    }
    
    var leagueName = matchHandler.data.league;
    
    GetMatchEvents(leagueName, matchParserId, function(error, events, teams, matchStatus) {
        if (error)
        {
            console.log('error in TickMatchFeed: ' + error.message);
            return;
        }
        
        // Produce the diff with eventFeedSnapshot
        var eventsDiff = _.differenceWith(eventFeedSnapshot, events, function(first, second) {
            return first.sequenceNumber == second.sequenceNumber;
        });
        
        // Nothing to add
        if (eventsDiff.length == 0)
            return;
            
        // Translate all events in eventsDiff and send them to feedService
        _.forEach(eventsDiff, function(event)
        {
            // First try parsing a normal event
           var translatedEvent = TranslateMatchEvent(event);
           if (translatedEvent)
                feedService.AddEvent(event);
            else
            {
                // Then try to parse a match segment advancing event
                var translatedMatchSegment = TranslateMatchSegment(event);
                if (translatedMatchSegment)
                    feedService.AdvanceMatchSegment();
            }
        });
            
        var lastEvent = _.findLast(events, function(n)
        {
            return n.sequenceNumber;
        });
        
        // Game Over?
        if (lastEvent.playEventId == 10)
            clearInterval(recurringTask);
        
    });
};
    




module.exports = Parser;