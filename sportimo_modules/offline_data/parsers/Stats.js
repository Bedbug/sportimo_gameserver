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
    "yi": "28", // yiddish (hebrew)
    "ru": "16" // russian
    // Add all required language mappings here from Stats.com
};
    
var statsComConfigDevelopment = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages : ["en", "ar", "ru"],
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
//var localConfiguration = statsComConfigDevelopment;
var configuration = statsComConfigDevelopment;

var Parser = function() {
    // Settings properties
    //Parser.name = configuration.parserIdName;
    
    //update configuration settings with this object settings
    if (this.interval)
        configuration.eventsInterval = this.interval;
    if (this.parsername)
        configuration.parserIdName = this.parsername;

    // Restrict to Only call this once in the lifetime of this object
    this.init = _.once(function(feedServiceContext) {
        
    });
};



Parser.Configuration = configuration;
Parser.Name = configuration.parserIdName;


// Helper Methods

// Approximate calculation of season Year from current date
Parser.GetSeasonYear = function()
{
    var now = new Date();
    if (now.getMonth() > 6)
        return now.getFullYear();
    else return now.getFullYear() - 1;
};

// Stats.com Endpoint invocation Methods
Parser.GetTeamPlayers = function(leagueName, languageId, callback)
{
    //soccer/epl/participants/teams/6154?languageId=19
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/participants/?" + signature + "&languageId=" + languageId;

    needle.get(url, function(error, response)
    {
        if (error)
            return callback(error);
        try {
            var players = response.body.apiResults[0].league;
            callback(null, players);
        }
        catch(err) {
            return callback(err);
        }
    });
};

Parser.GetLeagueTeams = function(leagueName, callback)
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

Parser.GetLeagueStandings = function(leagueName, callback)
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


Parser.GetLeagueSeasonFixtures = function(leagueName, seasonYear, callback)
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


// Parser methods that other modules may call:

Parser.UpdateTeams = function(leagueName, existingTeams, existingPlayers, callback)
{
    if (! Parser.Configuration.supportedLanguages)
        return callback(new Error('No supported languages are defined in parser&apos;s configuration'));
        
    if (_.indexOf(Parser.Configuration.supportedLanguages, "en") < 0)
        return callback(new Error('The default english language ("en") is NOT set amongst the supported languages in parser&apos;s configuration.'));
        
    var languageData = {};
    
    var existingTeamsLookup = {};
    _.forEach(existingTeams, function(team) {
        if (team.parserids[Parser.Name] && !existingTeamsLookup[team.parserids[Parser.Name]]) 
            existingTeamsLookup[team.parserids[Parser.Name]] = team;
    });
    
    async.eachSeries(Parser.Configuration.supportedLanguages, function(language, callback) {
        if (languageMapping[language]) {
            Parser.GetTeamPlayers(leagueName, languageMapping[language], function(error, data) {
                if (error)
                    return callback(error);
                
                languageData[language] = data;
                callback();
            });
        }
        else {
            async.setImmediate(function () {
                callback(new Error('language ' + language + ' is not found amongst languageMapping dictionary.'));
            });
        }
    },
    function(error) {
        if (error && !languageData["en"])
            return callback(error);
        
        
        var parsedTeams = {};
        var parsedPlayers = {};
        
        // Scan the english data to get all teams
        _.forEach(languageData["en"].players, function(player) {
            if (player.team && player.team.teamId && !parsedTeams[player.team.teamId])
            {
                parsedTeams[player.team.teamId] = {
                    name_en : player.team.displayName,
                    name : { "en" : player.team.displayName },
                    parserids : { }
                };
                parsedTeams[player.team.teamId].parserids[Parser.Name] = player.team.teamId;
            }
            if (player.playerId && !parsedPlayers[player.playerId])
            {
                parsedPlayers[player.playerId] = {
                    firstName_en : player.firstName,
                    firstName : { "en" : player.firstName },
                    lastName_en : player.lastName,
                    lastName : { "en" : player.lastName },
                    uniformNumber : player.uniform,
                    position: player.positions[0].name,
                    personalData: {
                        height: player.height,
                        weight: player.weight,
                        birth: player.birth,
                        nationality: player.nationality
                    },
                    parserids : { }
                };
                parsedPlayers[player.playerId].parserids[Parser.Name] = player.playerId;
            }
        });
            
            
        // Now merge other languages data with english ones, based on their id.
        _.forEach(languageData, function(value, key, val) {
            _.forEach(value.players, function(player) {
                if (parsedTeams[player.team.teamId])
                    parsedTeams[player.team.teamId].name[key] = player.team.displayName;
                
                if (parsedPlayers[player.playerId])
                {
                    parsedPlayers[player.playerId].firstName[key] = player.firstName;
                    parsedPlayers[player.playerId].lastName[key] = player.lastName;
                }
            });
        });
        
        // Now merge the parsed teams and players lookups with the existingTeamsLookup and existingPlayersLookup
        
        callback(null, parsedTeams, null, parsedPlayers, null);
    });
};

module.exports = Parser;