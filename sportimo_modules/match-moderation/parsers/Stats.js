var localConfiguration = require('./configuration.js');
var later = require('later');
var needle = require("needle");
var crypto = require("crypto-js");
var async = require('async');



var Parser = function() {
    // Settings properties
    var configuration = localConfiguration;


    // Helper Methods
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

    
    
};


Parser.name = "Stats";
Parser.init = function(){
//        return console.log("[Stats] Parser service initiliazed");
    }



module.exports = Parser;