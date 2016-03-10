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




var Parser = function() {
    // Settings properties
    var configuration = localConfiguration;
    
    //update configuration settings with this object settings
    if (this.interval)
        configuration.eventsInterval = this.interval;
    if (this.parsername)
        configuration.parserIdName = this.parsername;
        
    var matchHandler = null;
    var feedService = null;
    var recurringTask = null;
    
    // holder of the match events in the feed that are fetched by the most recent call to GetMatchEvents.
    var eventFeedSnapshot = [];
    
    // the parser would like to know the match parserid
    var matchParserId = null;
    
    var eventTypes = [
            {
                "playEventId": 1,
                "name": "Ball Location"
            }, {
                "playEventId": 2,
                "name": "Caution"
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
                "name": "Expulsion"
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
            
    var supportedEventTypes = [5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 28,30, 31, 32, 33, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53];
    
    // ToDo: the parser would like to know all team players and their parserids.
    // ToDo: the parser would like to know the 2 teams (home and away) parserids
    
    this.Name = configuration.parserIdName;

    // Restrict to Only call this once in the lifetime of this object
    this.init = _.once(function(matchHandlerRef, feedServiceContext){
    //        return console.log("[Stats] Parser service initiliazed");
        matchHandler = matchHandlerRef;
        feedService = feedServiceContext;
        
        // fill in the matchParserId var
        matchParserId = matchHandler.data.parserids[configuration.parserIdName];
        
        // Schedule match feed event calls
        if (matchHandler.data.start)
        {
            scheduler.scheduleJob(matchHandler.data.start, function()
            {
                recurringTask = setInterval(this.TickMatchFeed, configuration.eventsInterval);
            });
        }
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
                callback(null, events);
            }
            catch(err) {
                return callback(err);
            }
        });        
    }
    
    // Stats.com Endpoint invocation Methods
    var GetTeamPlayers = function(leagueName, teamId, callback)
    {
        //soccer/epl/participants/teams/6154?languageId=19
        var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
        var url = configuration.urlPrefix + leagueName + "/participants/?" + signature;

        needle.get(url, function(error, response)
        {
            if (error)
                return callback(error);
            try {
                var players = response.body.apiResults[0].league.players;
                callback(null, players);
            }
            catch(err) {
                return callback(err);
            }
        });
    };
    
    var GetLeagueTeams = function(leagueName, callback)
    {
        var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
        var url = configuration.urlPrefix + leagueName + "/teams/?" + signature;

        needle.get(url, function(error, response)
        {
            if (error)
                return callback(error);
            try {
                var teams = response.body.apiResults[0].league.season.conferences[0].divisions[0].teams;
                callback(null, teams);
            }
            catch(err) {
                return callback(err);
            }
        });
    };
    
    var GetLeagueStandings = function(leagueName, callback)
    {
        var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
        var url = configuration.urlPrefix + leagueName + "/standings/?live=false&eventTypeId=1&" + signature;

        needle.get(url, function(error, response)
        {
            if (error)
                return callback(error);
            try {
                var standings = response.body.apiResults[0].league.season.eventType[0].conferences[0].divisions[0].teams;
                callback(null, standings);
            }
            catch(err) {
                return callback(err);
            }
        });
    };
    
    
    var GetLeagueSeasonFixtures = function(leagueName, seasonYear, callback)
    {
        var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
        var url = configuration.urlPrefix + leagueName + "/scores/?" + signature + "&season=" + seasonYear; // or + GetSeasonYear();
        
        needle.get(url, function(error, response) {
            if (error)
                return callback(error);
                
            if (response.body.status != 'OK' || response.body.recordCount == 0)
                return callback(null);
                
            try
            {
                var fixtures = response.body.apiResults[0].league.season.eventType[0].events;
                callback(null, fixtures);
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
        
        // ToDo: properly populate the players instead of this:
        var defensivePlayer = parserEvent.defensivePlayer ? 
            {
                
            } : null;
        var offensivePlayer = parserEvent.offensivePlayer ? 
            {
                
            } : null;
        
        var translatedEvent = {
            type: 'Add',
            time: parserEvent.time.minutes,   
            data: {
                id: parserEvent.sequenceNumber,
                status: 'active',
                state: 0,
                sender: configuration.parserIdName,
                time: parserEvent.time.minutes,
                timeline_event: true,
                team: 'away_team', // ToDo: fix this, away_team or home_team
                match_id: matchHandler.data._id,
                players: [],
                stats: { }
            },
            created: new Date() // ToDo: infer creation time from match minute
        };
        
        if (defensivePlayer)
            translatedEvent.players.push(defensivePlayer);
        if (offensivePlayer)
            translatedEvent.players.push(offensivePlayer);
        translatedEvent.stats[parserEvent.playEvent.name] = 1;
        
        return translatedEvent;
    };
    
    // and now, the functions that can be called from outside modules.
    this.TickMatchFeed = function() {
        if (!matchHandler || !matchParserId || !feedService)
        {
            console.log('Invalid call of TickMatchFeed before binding to a match');
            return;
        }
        
        var leagueName = matchHandler.data.league;
        
        GetMatchEvents(leagueName, matchParserId, function(error, data) {
            if (error)
            {
                console.log('error in TickMatchFeed: ' + error.message);
                return;
            }
            
            // produce the diff with eventFeedSnapshot
            var eventsDiff = _.differenceWith(eventFeedSnapshot, data, function(first, second) {
                return first.sequenceNumber == second.sequenceNumber;
            });
            
            // Nothing to add
            if (eventsDiff.length == 0)
                return;
                
            // Translate all events in eventsDiff and send them to matchHandler
            _.forEach(eventsDiff, function(event)
            {
               var translatedEvent = TranslateMatchEvent(event);
               if (translatedEvent)
                    feedService.ParseEvent(event);
            });
                
            var lastEvent = _.findLast(data, function(n)
            {
                return n.sequenceNumber;
            });
            
            // Game Over?
            if (lastEvent.playEventId == 10)
                clearInterval(recurringTask);
            
        });
    };
    
};




module.exports = Parser;