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

Parser.GetPlayerCareerStats = function(leagueName, playerId, callback)
{
    //soccer/epl/stats/players/345879?enc=true&
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/stats/players/" + playerId + "?enc=true&careerOnly=true&" + signature;

    needle.get(url, { timeout: 50000 }, function(error, response)
    {
        if (error)
            return callback(error);
        try {
            var playerStats = response.body.apiResults[0].league.players[0].seasons[0].eventType[0].splits[0].playerStats;
            callback(null, playerStats);
        }
        catch(err) {
            return callback(err);
        }
    });
}

Parser.GetTeamPlayers = function(leagueName, languageId, callback)
{
    //soccer/epl/participants/teams/6154?languageId=19
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/participants/?" + signature + "&languageId=" + languageId;

    needle.get(url, { timeout: 60000 }, function(error, response)
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

    needle.get(url, { timeout: 60000 }, function(error, response)
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

    needle.get(url, { timeout: 60000 }, function(error, response)
    {
        if (error)
            return callback(error);
        try {
            var standings = response.body.apiResults[0].league.season.eventType[0].conferences[0].divisions[0].teams;
            var season = response.body.apiResults[0].league.season.season;
            callback(null, standings, season);
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
    
    needle.get(url, { timeout: 60000 }, function(error, response) {
        if (error)
            return callback(error);
            
        if (response.body.status != 'OK' || response.body.recordCount == 0)
            return callback(new Error('Invalid response from Parser'));
            
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

Parser.UpdateTeams = function(callback)
{
    mongoDb.competitions.find({}, function(err, competitions) {
        if (err)
            return callback(err);
            
        var leagueName = competitions[0].parserids[Parser.Name]; 
        var leagueId = competitions[0].id;
    
        if (!leagueName || !leagueId)
            return callback(new Error('No league name or league Id is defined in call'));
        
        if (! Parser.Configuration.supportedLanguages)
            return callback(new Error('No supported languages are defined in parser&apos;s configuration'));
            
        if (_.indexOf(Parser.Configuration.supportedLanguages, "en") < 0)
            return callback(new Error('The default english language ("en") is NOT set amongst the supported languages in parser&apos;s configuration.'));
            

        // get all teams, and then collect all teamIds and query for the related players
        mongoDb.teams.find({competitionid: leagueId}, function(teamError, existingTeams) {
            if (teamError)
                return callback(teamError);
            
            var existingTeamIds = _.map(existingTeams, function(team) { return team.id; });
        
            var existingTeamsLookup = {};
            _.forEach(existingTeams, function(team) {
                if (team.parserids[Parser.Name] && !existingTeamsLookup[team.parserids[Parser.Name]]) 
                    existingTeamsLookup[team.parserids[Parser.Name]] = team;
            });
            
            mongoDb.players.find({teamId: {'$in': existingTeamIds}}, function(playerError, existingPlayers) {
        	    if (playerError)
        	        return callback(playerError);

                var languageData = {};
                
                
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
                                    //newTeam.name_en = player.team.displayName;
                                    newTeam.name = { "en" : player.team.displayName };
                                    newTeam.logo = null;
                                    //newTeam.league = leagueName;
                                    newTeam.created = creationDate;
                                    newTeam.parserids = { };
                                    newTeam.parserids[Parser.Name] = player.team.teamId;
                                    newTeam.competitionid = leagueId;
    
                                    parsedTeams[player.team.teamId] = newTeam;
                                    newTeam.save();
                                    teamsToAdd.push(newTeam);
                                }
                                else
                                {
                                    var oldTeam = existingTeamsLookup[player.team.teamId];
                                    //oldTeam.name_en = player.team.displayName;
                                    if (!oldTeam.name)
                                        oldTeam.name = {};
                                    oldTeam.name["en"] = player.team.displayName;
                                    oldTeam.logo = null;
                                    //oldTeam.league = leagueName;
                                    if (!oldTeam.parserids)
                                        oldTeam.parserids = {};
                                    oldTeam.parserids[Parser.Name] = player.team.teamId;
                                    oldTeam.competitionid = leagueId;
                                    
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
                                    //newPlayer.name_en = player.firstName + " " + player.lastName;
                                    newPlayer.name = { "en" : player.firstName + " " + player.lastName };
                                    //newPlayer.firstName_en = player.firstName;
                                    newPlayer.firstName = { "en" : player.firstName };
                                    //newPlayer.lastName_en = player.lastName;
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
                                    //oldPlayer.firstName["en"] = player.firstName;
                                    oldPlayer.lastName_en = player.lastName;
                                    if (!oldPlayer.lastName)
                                        oldPlayer.lastName = {};
                                    //oldPlayer.lastName["en"] = player.lastName;
                                    oldPlayer.name_en = player.firstName + " " + player.lastName;
                                    if (!oldPlayer.name)
                                        oldPlayer.name = {};
                                    //oldPlayer.name["en"] = player.firstName + " " + player.lastName;
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
            
        }); // competitionid: leagueId
    });
};


var GetLeagueFromMongo = function(leagueId, callback) {
    mongoDb.competitions.findById(leagueId, function(error, competition) {
        if (error)
            return callback(error);
        
        if (!competition.parserids || !competition.parserids[Parser.Name])
            return callback(new Error('The selected competition (id:' + leagueId + ') does not have a valid ' + Parser.Name + ' parser id.' ));
        
        callback(null, competition);
    });
};


Parser.UpdateLeagueStandings = function(competitionDocument, leagueId, outerCallback)
{
    leagueId = competitionDocument ? competitionDocument.id : leagueId;
    //statsLeagueId = competitionDocument.parserids[Parser.Name] || statsLeagueId;
    
    if (!leagueId)
        return outerCallback(new Error('No league id is defined in call'));

    // Schedule cascading callback functions: 
    // get competition, 
    // get teams for this competition and build a lookup dictionary
    // get standings for this competition and fill in team ids from lookup dictionary
    async.waterfall(
        [
            function(callback)
            {
                if (competitionDocument && competitionDocument.parserids && competitionDocument.parserids[Parser.Name])
                    return async.setImmediate(function() {
                        return callback(null, competitionDocument); 
                    });
                GetLeagueFromMongo(leagueId, function(error, competition) {
                    if (error)
                        return callback(error);
                    return callback(null, competition);
                });
            },
            function(competition, callback) {
                var parserQuery = 'parserids.' + Parser.Name;
                
                mongoDb.teams.find().ne(parserQuery, null).where('competitionid', leagueId).exec( function(teamError, teams) {
                    if (teamError)
                        return callback(teamError);
                        
                    var existingTeamIds = {};
                    _.forEach(teams, function(team) {
                        if (team.parserids[Parser.Name] && !existingTeamIds[team.parserids[Parser.Name]]) 
                            existingTeamIds[team.parserids[Parser.Name]] = team;
                    }); 
                    
                    return callback(null, competition, existingTeamIds);
                });
            },
            function(competition, existingTeamIds, callback) {
                var statsLeagueId = competition.parserids[Parser.Name];
                
                Parser.GetLeagueStandings(statsLeagueId, function(error, standings, seasonYear) {
                    if (error)
                        return callback(error);
                        
                    callback(null, competition, existingTeamIds, standings, seasonYear);    
                });                    
            },
            function(competition, existingTeamIds, standings, seasonYear, callback) {
                mongoDb.standings.where('identity', Parser.Name).where('season', seasonYear).where('competitionid', competition.id).exec(function(error, standing) {
                    if (error)
                        return callback(error);
                        
                    callback(null, competition, existingTeamIds, standings, seasonYear, standing? standing[0]: null); 
                });
            }
        ], function(error, competition, existingTeamIds, standings, seasonYear, standing) {
            if (error)
                return outerCallback(error);
                
           // Translate the global properties and then iterate over the team properties inside the teams array.
           var newStandings = null;
            if (standing)
                newStandings = standing;
            else
                newStandings = new mongoDb.standings();
                
            newStandings.competitionid = leagueId;
            newStandings.name = competition.name;
            newStandings.identity = Parser.Name;
            newStandings.season = seasonYear;
            newStandings.teams = [];
            //newStandings.lastUpdate = new Date();
            
            standings.forEach(function(teamStanding) {
                if (existingTeamIds[teamStanding.teamId]) {
                    var team = {
                        rank: teamStanding.league.rank,
                        teamName: existingTeamIds[teamStanding.teamId].name,
                        teamId: existingTeamIds[teamStanding.teamId].id,
                        points: teamStanding.teamPoints,
                        pointsPerGame: teamStanding.teamPointsPerGame,
                        penaltyPoints: teamStanding.penaltyPoints,
                        wins: teamStanding.record.wins,
                        losses: teamStanding.record.losses,
                        ties: teamStanding.record.ties,
                        gamesPlayed: teamStanding.record.ties,
                        goalsFor: teamStanding.goalsFor.overall,
                        goalsAgainst: teamStanding.goalsAgainst.overall
                    };
                    
                    newStandings.teams.push(team);
                }
            });
            
            //newStandings.teams.markModified();
            newStandings.save(function(err) {   
                if (err)
                    return outerCallback(err);
                    
                outerCallback(null, leagueId);
            });                
    });
    
};

Parser.UpdateStandings = function(callback)
{
        
    var leagueStandingsUpdated = [];

    // Get all competitions from Mongo
    mongoDb.competitions.find({}, function(competitionError, leagues) {
        if (competitionError)
            return callback(competitionError, leagueStandingsUpdated);
        
        async.each(leagues, function(league, cbk)
        {
            // Get all teams foreach competition
            Parser.UpdateLeagueStandings(league, league.id, function(error) {
                if (error)
                    return cbk(error);
                    
                leagueStandingsUpdated.push(league.id);
                cbk();
            });
        }, function (asyncError) {
            if (asyncError)
                return callback(asyncError, leagueStandingsUpdated);
                
            callback(null, leagueStandingsUpdated);
        });
    });
};


Parser.GetCompetitionFixtures = function(competitionId, outerCallback) {
    if (!competitionId)
        return outerCallback(new Error('No competition id parameter is included in the request.'));
        
    var season = Parser.GetSeasonYear();
    
    // Get competition from Mongo
    // Get teams from Mongo and build the team lookup dictionary
    // Get the fixtures
    // Filter the fixtures for the ones scheduled in the future, and return the results
    async.waterfall([
            function(callback)
            {
                GetLeagueFromMongo(competitionId, function(error, competition) {
                    if (error)
                        return callback(error);
                    return callback(null, competition);
                });
            },
            function(competition, callback) {
                var parserQuery = 'parserids.' + Parser.Name;
                
                mongoDb.teams.find().ne(parserQuery, null).where('competitionid', competitionId).exec( function(teamError, teams) {
                    if (teamError)
                        return callback(teamError);
                        
                    var existingTeamIds = {};
                    _.forEach(teams, function(team) {
                        if (team.parserids[Parser.Name] && !existingTeamIds[team.parserids[Parser.Name]]) 
                            existingTeamIds[team.parserids[Parser.Name]] = team;
                    }); 
                    
                    return callback(null, competition, existingTeamIds);
                });
            },
            function(competition, existingTeamIds, callback) {
                var statsLeagueId = competition.parserids[Parser.Name];
                
                Parser.GetLeagueSeasonFixtures(statsLeagueId, season, function(error, fixtures) {
                    if (error)
                        return callback(error);
                        
                    callback(null, competition, existingTeamIds, fixtures);    
                });                    
            },
        ], function(asyncError, competition, existingTeamIds, fixtures) {
            if (asyncError)
                return outerCallback(asyncError);
            
            var now = new Date();
            var futureFixtures = _.filter(fixtures, function(fixture) {
                if (!fixture.startDate || fixture.startDate.length < 2)
                    return false;
                if (fixture.eventStatus.isActive)
                    return false;
                    
               var startDateString = fixture.startDate[1].full;
               var startDate = Date.parse(startDateString);
               
               return startDate > now;
            });
            
            var futureSchedules = _.map(futureFixtures, function(fixture) {
                try {
                    var homeTeam, awayTeam;
                    if (fixture.teams[0].teamLocationType.teamLocationTypeId == 1)
                        homeTeam = fixture.teams[0];
                    if (fixture.teams[0].teamLocationType.teamLocationTypeId == 2)
                        awayTeam = fixture.teams[0];
                    if (fixture.teams[1].teamLocationType.teamLocationTypeId == 1)
                        homeTeam = fixture.teams[1];
                    if (fixture.teams[1].teamLocationType.teamLocationTypeId == 2)
                        awayTeam = fixture.teams[1];
                        
                    var schedule = {
                        sport: 'soccer',
                        home_team: existingTeamIds[homeTeam.teamId] ? existingTeamIds[homeTeam.teamId].id : null,
                        away_team: existingTeamIds[awayTeam.teamId] ? existingTeamIds[awayTeam.teamId].id : null,
                        color: {
                            home_team: { 
                                primary: homeTeam.teamColors.primary,
                                secondary: homeTeam.teamColors.shorts
                            },
                            away_team: { 
                                primary: awayTeam.teamColors.primary,
                                secondary: awayTeam.teamColors.shorts
                            }
                        },
                        competitionId: competition.id,
                        competitionName: competition.name,
                        home_score: 0,
                        away_score: 0,
                        time: null,
                        start: fixture.startDate[1].full,
                        state: 0
                    };
                    
                    return schedule;                    
                }
                catch(err) {
                    return;
                }
            });
            
            outerCallback(null, futureSchedules);
    });
};



module.exports = Parser;