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
    parserIdName : "Stats"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Settings for the production environment
var statsComConfigProduction = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages : ["en"],
    urlPrefix : "http://api.stats.com/v1/stats/soccer/",
    apiKey : "83839j82xy3mty4bf6459rnt",
    apiSecret : "VqmfcMTdQe",
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
    
    this.Name = configuration.parserIdName;

    // Restrict to Only call this once in the lifetime of this object
    this.init = _.once(function(matchContext, feedServiceContext){
    //        return console.log("[Stats] Parser service initiliazed");
        matchHandler = matchContext;
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

    
};




module.exports = Parser;