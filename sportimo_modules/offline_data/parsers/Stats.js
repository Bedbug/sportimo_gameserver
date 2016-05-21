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
    apiKey : "mct9w8ws4fbpvj5w66se4tns",//"83839j82xy3mty4bf6459rnt",
    apiSecret : "53U7SH6N5x", //"VqmfcMTdQe",
    parserIdName : "Stats"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Settings for the production environment
var statsComConfigProduction = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages : ["en"],
    urlPrefix : "http://api.stats.com/v1/stats/soccer/",
    apiKey : "mct9w8ws4fbpvj5w66se4tns",//"83839j82xy3mty4bf6459rnt",
    apiSecret : "53U7SH6N5x", //"VqmfcMTdQe",
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

// Get player stats. If season is null, then return the career stats, else the stats for the given season.
Parser.GetPlayerStats = function(leagueName, playerId, season, callback)
{
    var isCareer = false;
    if (!season) {
        callback = season;
        isCareer = true;
    }
    
    //soccer/epl/stats/players/345879?enc=true&
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/stats/players/" + playerId + ( isCareer ? "?accept=json&enc=true&careerOnly=true&" : "?accept=json&season=" + season + "&" ) + signature;

    needle.get(url, { timeout: 50000 }, function(error, response)
    {
        if (error)
            return callback(error);
        try {
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));
                
            var playerStats = response.body.apiResults[0].league.players[0].seasons[0].eventType[0].splits[0].playerStats;
            return callback(null, playerStats);
        }
        catch(err) {
            return callback(err);
        }
    });
};

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
                                    newTeam.name["short"] = player.team.abbreviation;
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
                                    if (!oldTeam.name)
                                        oldTeam.name = {};
                                    oldTeam.name["en"] = player.team.displayName;
                                    oldTeam.name["short"] = player.team.abbreviation;
                                    if (!oldTeam.logo)
                                        oldTeam.logo = null; // leave this property untouched to what it was
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
                                    newPlayer.name = { "en" : player.firstName + " " + player.lastName };
                                    newPlayer.firstName = { "en" : player.firstName };
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
                        competitionId: competition.id,
                        competitionName: competition.name,
                        home_score: 0,
                        away_score: 0,
                        time: null,
                        parserids: {},
                        start: fixture.startDate[1].full,
                        state: 0
                    };
                    
                    schedule.parserids["Stats"] = fixture.eventId;
                    return schedule;                    
                }
                catch(err) {
                    return;
                }
            });
            
            outerCallback(null, futureSchedules);
    });
};


Parser.UpdateTeamPlayersCareerStats = function(teamId, outerCallback) {
    // Schedule the following cascading callbacks:
    // 1. Get the team from Mongo by the teamId
    // 2. Get the linked competition
    // 3. Get the team's linked players in mongo and build a dictionary of their ids as keys
    // 4. Call for each player having a valid parserids["Stats"] id, the stats endpoint for the player career stats
    // 5. Finally, update each player's document and save back in Mongo
    
    async.waterfall([
        function(callback) {
            return mongoDb.teams.findById(teamId, callback);
        },
        function(team, callback) {
            GetLeagueFromMongo(team.competitionid, function(error, competition) {
                if (error)
                    return callback(error);
                callback(null, team, competition);
            });
        },
        function(team, competition, callback) {
            mongoDb.players.find({teamId: teamId}, function(error, data) {
                if (error)
                    return callback(error);
                    
                var playersLookup = {};
                _.forEach(data, function(player) {
                     if (player.parserids && player.parserids[Parser.Name] && !playersLookup[player.parserids[Parser.Name]])
                        playersLookup[player.parserids[Parser.Name]] = player;
                });
                
                callback(null, team, competition, playersLookup);
            });
        }
    ], function(error, team, competition, playersLookup) {
        if (error)
            return outerCallback(error);
            

        var playerStatIds = _.keys(playersLookup);
        var updatedPlayerStats = 0;
        
        async.eachSeries(playerStatIds, function(playerId, innerCallback) {
            Parser.GetPlayerStats(competition.parserids[Parser.Name], playerId, function(innerError, stats) {
                if (innerError)
                    //return innerCallback(innerError);
                    return innerCallback();
                    
                var playerDocInstance = playersLookup[playerId];
                playerDocInstance.stats = {};
                playerDocInstance.stats["career"] = TranslatePlayerStats(stats);
                
                setTimeout(function() {
                    // Save playerDocInstance document back in Mongo
                    playerDocInstance.save(innerCallback);
                    updatedPlayerStats++;
                }, 1000);
            });
        }, function(outerError) {
            if (outerError)
                return outerCallback(outerError);
                
            outerCallback(null, updatedPlayerStats);
        });

        //outerCallback(null, results);
    });
};


var TranslatePlayerStats = function(stats)
{
    return {
        gamesPlayed: stats.gamesPlayed,
        gamesStarted: stats.gamesStarted,
        minutesPlayed: stats.minutesPlayed,
        goalsTotal: stats.goals && stats.goals.total ? stats.goals.total : 0,
        goalsGameWinning: stats.goals && stats.goals.gameWinning ? stats.goals.gameWinning : 0,
        goalsOwn: stats.goals && stats.goals.goalsOwn ?  stats.goals.goalsOwn : 0,
        goalsHeaded: stats.goals && stats.goals.headed ?  stats.goals.headed : 0,
        goalsKicked: stats.goals && stats.goals.kicked ?  stats.goals.kicked : 0,
        assistsTotal: stats.assists && stats.assists.total ?  stats.assists.total : 0,
        assistsGameWinning: stats.assists && stats.assists.gameWinning ?  stats.assists.gameWinning : 0,
        shots: stats.shots,
        shotsOnGoal: stats.shotsOnGoal,
        crosses: stats.crosses,
        penaltyKicksShots: stats.penaltyKicks && stats.penaltyKicks.shots ? stats.penaltyKicks.shots : 0,
        penaltyKicksGoals: stats.penaltyKicks && stats.penaltyKicks.goals ? stats.penaltyKicks.goals : 0,
        foulsCommitted: stats.foulsCommitted,
        foulsSuffered: stats.foulsSuffered,
        yellowCards: stats.yellowCards,
        redCards: stats.redCards,
        offsides: stats.offsides,
        cornerKicks: stats.cornerKicks,
        clears: stats.clears,
        goalMouthBlocks: stats.goalMouthBlocks,
        touchesTotal: stats.touches && stats.touches.total ? stats.touches.total : 0,
        touchesPasses: stats.touches && stats.touches.passes ? stats.touches.passes : 0,
        touchesInterceptions: stats.touches && stats.touches.interceptions ? stats.touches.interceptions : 0,
        touchesBlocks: stats.touches && stats.touches.blocks ? stats.touches.blocks : 0,
        tackles: stats.tackles,
        attacks: stats.attacks,
        overtimeShots: stats.overtime && stats.overtime.shots ? stats.overtime.shots : 0,
        overtimeGoals: stats.overtime && stats.overtime.goals ? stats.overtime.goals : 0,
        overtimeAssists: stats.overtime && stats.overtime.assists ? stats.overtime.assists : 0,
        suspensions: stats.suspensions 
    };
};

module.exports = Parser;