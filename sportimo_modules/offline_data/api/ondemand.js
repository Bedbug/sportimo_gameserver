var express = require('express'),
    router = express.Router(),
    path = require("path"),
    fs = require("fs"),
    async = require('async'),
    winston = require('winston');


var parsers = {};

// Recursively add parsers
var servicesPath = path.join(__dirname, '../parsers');
    fs.readdirSync(servicesPath).forEach(function (file) {
        parsers[path.basename(file, ".js")] = require(servicesPath + '/' + file);
    });

// Recursively add models
var modelsPath = path.join(__dirname, '../../models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });

var api = {};

// var mongoDb = mongoose.mongoose.models;
// var mongoConn = mongoose.mongoose.connections[0];

// Define api actions:

// POST
api.UpdateAllTeams = function (req, res) {

    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };
    
	try
    {
        
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
    	async.eachSeries(parsers, function(parser, callback) {
            parser.UpdateTeams(function(error, teamsToAdd, teamsToUpdate, playersToAdd, playersToUpdate) {
                if (!error)
                {
                    response.parsers[parser.Name] = { 
                        error: null,
                        teamsToAdd: teamsToAdd.length, 
                        teamsToUpdate: teamsToUpdate.length,
                        playersToAdd: playersToAdd.length,
                        playersToUpdate: playersToUpdate.length
                    };
    
                    callback();
                }
                else {
                    winston.warn('Error calling UpdateAllTeams for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error)
            {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch(error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


// POST
api.UpdateAllPlayerStatsInTeam = function (req, res) {
	if(!req.params.teamId)
		return res.status(400).json({error: "No 'teamId' id parameter defined in the request path."});
		
	var teamId = req.params.teamId;

    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };
    
	try
    {
        
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
    	async.eachSeries(parsers, function(parser, callback) {
            parser.UpdateTeamPlayersCareerStats(teamId, function(error, playersToUpdate) {
                if (!error)
                {
                    response.parsers[parser.Name] = { 
                        error: null,
                        playersToUpdate: playersToUpdate
                    };
    
                    callback();
                }
                else {
                    winston.warn('Error calling UpdateAllPlayerStatsInTeam for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error)
            {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch(error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


api.UpdateLeagueStandings = function(req, res) {
	if(!req.params.competitionId)
		return res.status(400).json({error: "No 'competition' id parameter defined in the request path."});
		
	var leagueId = req.params.competitionId;
		
    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };
    	        
	try
	{
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
    	async.eachSeries(parsers, function(parser, callback) {
            parser.UpdateLeagueStandings(leagueId, leagueId, function(error, teamsIncluded) {
                if (!error)
                {
                    response.parsers[parser.Name] = { 
                        error: null,
                        teamsNumber: teamsIncluded
                    };
    
                    callback();
                }
                else {
                    winston.warn('Error calling UpdateLeagueStandings for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error)
            {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
	}
	catch(error) {
        response.error = error.message;
        return res.status(500).json(response);
	}
};


api.UpdateAllStandings = function(req, res) {
    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };
	        
	try
	{
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
    	async.eachSeries(parsers, function(parser, callback) {
            parser.UpdateStandings(function(error, teamsIncluded) {
                if (!error)
                {
                    response.parsers[parser.Name] = { 
                        error: null,
                        updatedCompetitions: teamsIncluded
                    };
    
                    callback();
                }
                else {
                    winston.warn('Error calling UpdateAllStandings for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error)
            {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
	}
	catch(error) {
        response.error = error.message;
        return res.status(500).json(response);
	}
};


api.GetCompetitionFixtures = function(req, res)
{
    var response = { error: null, parsers: {} };

	if(!req.params.competitionId)
	    return res.status(400).json({error: "No 'competition' id parameter defined in the request path."});

	try
	{
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
    	async.eachSeries(parsers, function(parser, callback) {
            parser.GetCompetitionFixtures(req.params.competitionId, function(error, fixtures) {
                if (!error)
                {
                    response.parsers[parser.Name] = { 
                        error: null,
                        comingFixtures : fixtures
                    };
    
                    callback();
                }
                else {
                    winston.warn('Error calling GetCompetitionFixtures for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error)
            {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
	}
	catch(error) {
        response.error = error.message;
        return res.status(500).json(response);
	}
};


api.Welcome = function(req, res)
{
    return res.status(200).json({ error: null, response: 'The offline_data Api is up and running.'});
};



// Bind api actions to router paths:

router.get('/', api.Welcome);

// update all teams and players in each
router.post('/teams', api.UpdateAllTeams);

// update all player career stats for all players in teamId
router.post('/players/:teamId', api.UpdateAllPlayerStatsInTeam);

// update all competition standings
router.post('/standings', api.UpdateAllStandings);

// update the team standings of the selected competition (id)
router.post('/standings/:competitionId', api.UpdateLeagueStandings);

// return the future fixtures for the selected competition (id)
router.get('/fixtures/:competitionId', api.GetCompetitionFixtures);

module.exports = router;