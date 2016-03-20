var scheduler = require('node-schedule');
var needle = require("needle");
var crypto = require("crypto-js");
var async = require('async');
var _ = require('lodash');
var mongoose = require('../config/db.js');
var objectId = mongoose.mongoose.Schema.ObjectId;


// Settings for the development environment
var mongoDb = mongoose.mongoose.models;
//var mongoConn = mongoose.mongoose.connections[0];

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

Parser.UpdateTeams = function(leagueName, callback)
{
    if (!leagueName)
        return callback(new Error('No league name is defined in call'));
    
    if (! Parser.Configuration.supportedLanguages)
        return callback(new Error('No supported languages are defined in parser&apos;s configuration'));
        
    if (_.indexOf(Parser.Configuration.supportedLanguages, "en") < 0)
        return callback(new Error('The default english language ("en") is NOT set amongst the supported languages in parser&apos;s configuration.'));
        
    var existingTeams = [];
    var existingPlayers = [];
    
    
	async.parallel([
	    function(cbk) {
	        mongoDb.teams.find({league: leagueName}, function(error, data) {
        	    if (error)
        	        return cbk(error);
        	        
        	    existingTeams = data;
        	    cbk();    
        	});
	    },
	    function(cbk) {
	        mongoDb.players.find({league: leagueName}, function(error, data) {
        	    if (error)
        	        return cbk(error);
        	        
        	    existingPlayers = data;
        	    cbk();    
        	});
	    }
	    ], function(error) {
	        if (error)
	            return callback();
	            
            var languageData = {};
            
            var existingTeamsLookup = {};
            _.forEach(existingTeams, function(team) {
                if (team.parserids[Parser.Name] && !existingTeamsLookup[team.parserids[Parser.Name]]) 
                    existingTeamsLookup[team.parserids[Parser.Name]] = team;
            });
            
            var existingPlayersLookup = {};
            _.forEach(existingPlayers, function(player) {
                if (player.parserids[Parser.Name] && !existingPlayersLookup[player.parserids[Parser.Name]]) 
                    existingPlayersLookup[player.parserids[Parser.Name]] = player;
            });
            
            async.eachSeries(Parser.Configuration.supportedLanguages, function(language, cbk) {
                if (languageMapping[language]) {
                    Parser.GetTeamPlayers(leagueName, languageMapping[language], function(error, data) {
                        if (error)
                            return cbk(error);
                        
                        languageData[language] = data;
                        cbk();
                    });
                }
                else {
                    async.setImmediate(function () {
                        cbk(new Error('language ' + language + ' is not found amongst languageMapping dictionary.'));
                    });
                }
            },
            function(error) {
                if (error && !languageData["en"])
                    return callback(error);
                
                
                var parsedTeams = {};
                var parsedPlayers = {};
                var teamsToAdd = [];
                var teamsToUpdate = [];
                var playersToAdd = [];
                var playersToUpdate = [];
                
                var creationDate = new Date();
                
                // Scan the english data to get all teams
                _.forEach(languageData["en"].players, function(player) {
                    if (player.team && player.team.teamId)
                    {
                        if (!parsedTeams[player.team.teamId])
                        {
                            // If new team, add to teamsToAdd collection
                            if (!existingTeamsLookup[player.team.teamId])
                            {
                                var newTeam = new mongoDb.teams(); 
                                newTeam.name_en = player.team.displayName;
                                newTeam.name = { "en" : player.team.displayName };
                                newTeam.logo = null;
                                newTeam.league = leagueName;
                                newTeam.created = creationDate;
                                newTeam.parserids = { };
                                newTeam.parserids[Parser.Name] = player.team.teamId;

                                parsedTeams[player.team.teamId] = newTeam;
                                teamsToAdd.push(newTeam);
                            }
                            else
                            {
                                var oldTeam = existingTeamsLookup[player.team.teamId];
                                oldTeam.name_en = player.team.displayName;
                                if (!oldTeam.name)
                                    oldTeam.name = {};
                                oldTeam.name["en"] = player.team.displayName;
                                oldTeam.logo = null;
                                oldTeam.league = leagueName;
                                if (!oldTeam.parserids)
                                    oldTeam.parserids = {};
                                oldTeam.parserids[Parser.Name] = player.team.teamId;
                                
                                parsedTeams[player.team.teamId] = oldTeam;
                                teamsToUpdate.push(oldTeam);
                            }
                        }
                        
                        if (player.playerId && !parsedPlayers[player.playerId])
                        {
                            // If new player, add to playersToAdd collection
                            if (!existingPlayersLookup[player.playerId])
                            {
                                var newPlayer = new mongoDb.players();
                                newPlayer.name_en = player.firstName + " " + player.lastName;
                                newPlayer.name = { "en" : player.firstName + " " + player.lastName };
                                newPlayer.firstName_en = player.firstName;
                                newPlayer.firstName = { "en" : player.firstName };
                                newPlayer.lastName_en = player.lastName;
                                newPlayer.lastName = { "en" : player.lastName };
                                newPlayer.uniformNumber = player.uniform;
                                newPlayer.position = player.positions[0].name;
                                newPlayer.personalData = {
                                    height: player.height,
                                    weight: player.weight,
                                    birth: player.birth,
                                    nationality: player.nationality
                                };
                                newPlayer.parserids = { };
                                newPlayer.parserids[Parser.Name] = player.playerId;
                                newPlayer.created = creationDate;
                                
                                if (parsedTeams[player.team.teamId]._id)
                                    newPlayer.teamId = parsedTeams[player.team.teamId].id;
                                    
                                parsedPlayers[player.playerId] = newPlayer;
                                playersToAdd.push(newPlayer);
                            }
                            else
                            {
                                var oldPlayer = existingPlayersLookup[player.playerId];
                                oldPlayer.firstName_en = player.firstName;
                                if (!oldPlayer.firstName)
                                    oldPlayer.firstName = {};
                                oldPlayer.firstName["en"] = player.firstName;
                                oldPlayer.lastName_en = player.lastName;
                                if (!oldPlayer.lastName)
                                    oldPlayer.lastName = {};
                                oldPlayer.lastName["en"] = player.lastName;
                                oldPlayer.name_en = player.firstName + " " + player.lastName;
                                if (!oldPlayer.name)
                                    oldPlayer.name = {};
                                oldPlayer.name["en"] = player.firstName + " " + player.lastName;
                                oldPlayer.uniformNumber = player.uniform;
                                oldPlayer.position = player.positions[0].name;
                                oldPlayer.personalData = {
                                    height: player.height,
                                    weight: player.weight,
                                    birth: player.birth,
                                    nationality: player.nationality
                                };
                                if (!oldPlayer.parserids)
                                    oldPlayer.parserids = { };
                                oldPlayer.parserids[Parser.Name] = player.playerId;

                                if (parsedTeams[player.team.teamId]._id)
                                    oldPlayer.teamId = parsedTeams[player.team.teamId].id;
                                    
                                parsedPlayers[player.playerId] = oldPlayer;
                                playersToUpdate.push(oldPlayer);
                                
                            }
                        }
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
                            parsedPlayers[player.playerId].name[key] = player.firstName + " " + player.lastName;
                        }
                    });
                });
                
                // Now merge the parsed teams and players lookups with the existingTeamsLookup and existingPlayersLookup
                // _.forEach(existingTeams, function(existingTeam) {
                //     var key = existingTeam.parserids[Parser.Name];
                //     if (key && parsedTeams[key])
                //     {
                //       // Merge
                //       _.merge(existingTeam, parsedTeams[key]);
                //       //teamsToUpdate.push(existingTeam);
                //     }
                // });
        
                // _.forEach(existingPlayers, function(existingPlayer) {
                //   var key = existingPlayer.parserids[Parser.Name];
                //   if (key && parsedPlayers[key])
                //   {
                //       _.merge(existingPlayer, parsedPlayers[key]);
                //       //playersToUpdate.push((existingPlayer));
                //   }
                // });
                
                
                // Try Upserting in mongo all teams and players
                try
                {
                    if (teamsToAdd && teamsToAdd.length > 0)
                    {
                        _.forEach(teamsToAdd, function(team) {
                            team.save();
                        });
                    }
                    
                    if (playersToAdd && playersToAdd.length > 0)
                    {
                        _.forEach(playersToAdd, function(player) {
                            player.save();
                        });
                    }
                    
                    if (teamsToUpdate && teamsToUpdate.length > 0)
                    {
                        _.forEach(teamsToUpdate, function(team) {
                            team.save();
                        });
                    }
                    
                    if (playersToUpdate && playersToUpdate.length > 0)
                    {
                        _.forEach(playersToUpdate, function(player) {
                            player.save();
                        });
                    }

                }
                catch (err)
                {
                    return callback(error);
                }                
                
                
                callback(null, teamsToAdd, teamsToUpdate, playersToAdd, playersToUpdate);
            });	            
    });
    
};

Parser.UpdateStandings = function(leagueName, callback)
{
    if (!leagueName)
        return callback(new Error('No league name is defined in call'));

    Parser.GetLeagueStandings(leagueName, function(error, standings) {
        if (error)
            return callback(error);
            
        var translateStanding = function(teamStanding) {
            
        };
        
        // Translate the global properties and then iterate over the team properties inside the teams array.
    });
}

module.exports = Parser;