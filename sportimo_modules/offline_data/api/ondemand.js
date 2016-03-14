var express = require('express'),
    router = express.Router(),
    path = require("path"),
    fs = require("fs"),
    _ = require("lodash"),
    mongoose = require('../config/db.js'),
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

var mongoDb = mongoose.mongoose.models;

// Define api actions:

// POST
api.UpdateTeams = function (req, res) {

	if(!req.params.leagueName)
		return res.status(400).json({error: "No 'league' name parameter defined in the request path."});
		
	var leagueName = req.params.leagueName;
	var leagueTeams = null;
	var leaguePlayers = null;
	
	// Retrieve both league teams and league players in parallel
	async.parallel([
	    function(callback) {
	        mongoDb.teams.find({league: leagueName}, function(error, data) {
        	    if (error)
        	        return callback(error);
        	        
        	    leagueTeams = data;
        	    callback();    
        	});
	    },
	    function(callback) {
	        mongoDb.players.find({league: leagueName}, function(error, data) {
        	    if (error)
        	        return callback(error);
        	        
        	    leaguePlayers = data;
        	    callback();    
        	});
	    }
	    ], function(error) {
	        if (error)
	            return res.status(500).json({error: error.message});
	    
	        // UpdateTeams for each supported parser
	        var response = { error: null, parsers: {} };
	        
	        // ToDo: maybe change the sequential order, and break the loop when the first parser completes the action without error.
        	_.forEach(parsers, function(parser) {
                parser.UpdateTeams(leagueName, leagueTeams, leaguePlayers, function(error, teamsToAdd, teamsToUpdate, playersToAdd, playersToUpdate) {
                    if (!error)
                    {
                        // Upsert to mongo all teams and players
                        // ...
                        
                        response.parsers[parser.Name] = { 
                            error: null,
                            teamsToAdd: teamsToAdd.length, 
                            teamsToUpdate: teamsToUpdate.length,
                            playersToAdd: playersToAdd.length,
                            playersToUpdate: playersToUpdate.length
                        }
                    }
                    else {
                        response.parsers[parser.Name] = {
                            error: error.message
                        }
                    }
                });
            });	    
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