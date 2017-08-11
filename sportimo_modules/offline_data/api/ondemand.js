var express = require('express'),
    router = express.Router(),
    path = require("path"),
    fs = require("fs"),
    async = require('async'),
    log = require('winston');


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


api.UpdateTeamStats = function (req, res) {
    if (!req.params.competitionId)
        return res.status(400).json({ error: "No 'competitionId' id parameter defined in the request path." });

    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };

    try {
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.UpdateAllCompetitionStats(req.params.competitionId, req.body.season, function (error, result) {
                if (!error) {
                    response.parsers[parser.Name] = result;

                    callback();
                }
                else {
                    log.warn('Error calling UpdateAllTeams for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


// POST //function(competitionId, season, schedulePattern, callback)
api.UpdateAllTeamsAddSchedule = function(req, res) {
    if (!req.params.competitionId)  
        return res.status(400).json({ error: "No 'competitionId' id parameter defined in the request path." });
    if (!req.body || !req.body.season)  
        return res.status(400).json({ error: "No 'season' parameter defined in the request body." });
    if (!req.body || !req.body.pattern)  
        return res.status(400).json({ error: "No 'pattern' parameter defined in the request body." });

    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };

    try {
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.CreateCompetitionTeamsStatsSchedule(req.params.competitionId, req.body.season, req.body.pattern, function (error, result) {
                if (!error) {
                    response.parsers[parser.Name] = result;

                    callback();
                }
                else {
                    log.warn('Error calling UpdateAllTeams for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }    
};

// GET //function(leagueName, callback)
api.UpdateAllTeamsGetSchedule = function(req, res) {
    if (!req.params.competitionId)  
        return res.status(400).json({ error: "No 'competitionId' id parameter defined in the request path." });

    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };

    try {
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.GetCompetitionTeamsStatsSchedule(req.params.competitionId, function (error, result) {
                if (error) {
                    log.warn('Error calling UpdateAllTeams for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
                else {
                    response.parsers[parser.Name] = result;

                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }    
};



// POST //function(leagueName, teamId, season, callback) UpdateOneTeamStats
api.UpdateOneTeamStats = function (req, res) {
    if (!req.body.leagueName)
        return res.status(400).json({ error: "No 'leagueName' parameter defined in the request body." });
    if (!req.body.teamid)
        return res.status(400).json({ error: "No 'teamid' Stats team id parameter defined in the request body." });
    if (!req.body.season)
        return res.status(400).json({ error: "No 'season' parameter defined in the request body." });


        api.GetTeamFullData(req.body.leagueName, req.body.teamid, req.body.season, function(err,response){
             if (err) {
                response.error = err.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });

};

api.GetTeamFullData = function (leagueName, teamid, season, outerCallback ) {
    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };

    try {
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.UpdateTeamStatsFull(leagueName, teamid, season, function (error, result) {
                if (!error) {
                    response.parsers[parser.Name] = result;

                    callback();
                }
                else {
                    log.warn('Error calling GetTeamFullData for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) 
                response.error = error.message;
                outerCallback(error, response);
            
        });
    }
    catch (error) {
        response.error = error.message;
        return outerCallback(error, response);
    }
};

// POST
api.UpdateAllTeams = function (req, res) {
    if (!req.params.competitionId)
        return res.status(400).json({ error: "No 'competitionId' id parameter defined in the request path." });

    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };

    try {

        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.UpdateTeams(req.params.competitionId, function (error, teamsToAdd, teamsToUpdate, playersToAdd, playersToUpdate) {
                if (!error) {
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
                    log.warn('Error calling UpdateAllTeams for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


// POST
api.UpdateAllPlayerStatsInTeam = function (req, res) {
    if (!req.params.teamId)
        return res.status(400).json({ error: "No 'teamId' id parameter defined in the request path." });

    var teamId = req.params.teamId;
    
    var season = req.body.season;

    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };

    try {

        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.UpdateTeamPlayersCareerStats(teamId, season, function (error, playersToUpdate) {
                if (!error) {
                    response.parsers[parser.Name] = {
                        error: null,
                        playersToUpdate: playersToUpdate
                    };

                    callback();
                }
                else {
                    log.warn('Error calling UpdateAllPlayerStatsInTeam for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


api.UpdateLeagueStandings = function (req, res) {
    if (!req.params.competitionId)
        return res.status(400).json({ error: "No 'competition' id parameter defined in the request path." });

    var leagueId = req.params.competitionId;
    
    var season = req.body.season;
    res.status(200).send("Request received.");
    
    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };

    try {
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.UpdateLeagueStandings(null, leagueId, season, null, function (error, teamsIncluded) {
                if (!error) {
                    response.parsers[parser.Name] = {
                        error: null,
                        teamsNumber: teamsIncluded
                    };

                    callback();
                }
                else {
                    log.warn('Error calling UpdateLeagueStandings for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


api.UpdateAllStandings = function (req, res) {    
    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };
    if (!req.body.season)
        return res.status(400).json({ error: "No 'season' id parameter defined in the request path." });

    try {
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.UpdateStandings(req.body.season, function (error, teamsIncluded) {
                if (!error) {
                    response.parsers[parser.Name] = {
                        error: null,
                        updatedCompetitions: teamsIncluded
                    };

                    callback();
                }
                else {
                    log.warn('Error calling UpdateAllStandings for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


api.GetCompetitionFixtures = function (req, res) {
    var response = { error: null, parsers: {} };

    if (!req.params.competitionId)
        return res.status(400).json({ error: "No 'competition' id parameter defined in the request path." });

    try {
        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        async.eachSeries(parsers, function (parser, callback) {
            parser.GetCompetitionFixtures(req.params.competitionId, !req.params.season ? null : req.params.season, function (error, fixtures) {
                if (!error) {
                    response.parsers[parser.Name] = {
                        error: null,
                        comingFixtures: fixtures
                    };

                    callback();
                }
                else {
                    log.warn('Error calling GetCompetitionFixtures for parser ' + parser.Name + ': ' + error.message);
                    response.parsers[parser.Name] = {
                        error: error.message
                    };
                    callback();
                }
            });
        }, function done(error) {
            if (error) {
                response.error = error.message;
                return res.status(500).json(response);
            }
            else
                return res.status(200).json(response);
        });
    }
    catch (error) {
        response.error = error.message;
        return res.status(500).json(response);
    }
};


api.Welcome = function (req, res) {
    return res.status(200).json({ error: null, response: 'The offline_data Api is up and running.' });
};



// Bind api actions to router paths:

router.get('/', api.Welcome);

// update all teams and players in each
router.post('/:competitionId/teams', api.UpdateAllTeams);

router.post('/teamstats/:competitionId/update', api.UpdateTeamStats);
router.get('/teamstats/:competitionId/schedule', api.UpdateAllTeamsGetSchedule);
router.post('/teamstats/:competitionId/schedule', api.UpdateAllTeamsAddSchedule);
//router.delete('/teamstats/:competitionId/schedule', api.UpdateAllTeamsDeleteSchedule);

// update team stats full
router.post('/teamstats/teamUpdate', api.UpdateOneTeamStats);

// update all player career stats for all players in teamId
router.post('/players/:teamId', api.UpdateAllPlayerStatsInTeam);

// update the team standings of the selected competition (id)
router.post('/standings/:competitionId', api.UpdateLeagueStandings);

// update all competition standings
router.post('/update/standings/all', api.UpdateAllStandings);

// return the future fixtures for the selected competition (id)
router.get('/fixtures/:competitionId/:season', api.GetCompetitionFixtures);
router.get('/fixtures/:competitionId', api.GetCompetitionFixtures);

module.exports = router;