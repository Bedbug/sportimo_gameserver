var express = require('express'),
    router = express.Router(),
    path = require("path"),
    fs = require("fs"),
    async = require('async');


var parsers = {};

// Recursively add parsers
var servicesPath = path.join(__dirname, '../parsers');
    fs.readdirSync(servicesPath).forEach(function (file) {
        parsers[path.basename(file, ".js")] = require(servicesPath + '/' + file);
    });

// Recursively add models
var modelsPath = path.join(__dirname, '../models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });

var api = {};

// var mongoDb = mongoose.mongoose.models;
// var mongoConn = mongoose.mongoose.connections[0];

// Define api actions:

// POST
api.UpdateTeams = function (req, res) {

	if(!req.params.leagueName)
		return res.status(400).json({error: "No 'league' name parameter defined in the request path."});
		
	var leagueName = req.params.leagueName;
	var leagueTeams = null;
	var leaguePlayers = null;
	
    // UpdateTeams for each supported parser
    var response = { error: null, parsers: {} };
	        
    // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
	async.eachSeries(parsers, function(parser, callback) {
        parser.UpdateTeams(leagueName, function(error, teamsToAdd, teamsToUpdate, playersToAdd, playersToUpdate) {
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
            
};

api.Welcome = function(req, res)
{
    return res.status(200).json({response: 'The offline_data Api is up and running.'});
};



// Bind api actions to router paths:

router.get('/', api.Welcome);

router.post('/:leagueName/teams', api.UpdateTeams);

module.exports = router;