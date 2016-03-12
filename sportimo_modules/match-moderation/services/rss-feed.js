
/**
 * Services are attached to match-modules based on the configuration
 * of the scheduled-match. 
 * e.g. 
 * "moderation": [{
		"type": "rss-feed",
		"eventid": "15253",
		"feedurl": "http://feed-somewhere.com?event-id=",
		"interval": 500,
		"parsername": "Stats"
	}]
 * should add an rss-feed service with the above configurations. 
 * The service is then responsible to handle the moderation of
 * the scheduled-match. 
*/

var path = require('path'),
    fs = require('fs'),
    mongoose = require('../config/db.js');

var parsers = [ ];

var servicesPath = path.join(__dirname, '../parsers');
    fs.readdirSync(servicesPath).forEach(function (file) {
        parsers[path.basename(file, ".js")] = require(servicesPath + '/' + file);
    });

var modelsPath = path.join(__dirname, '../models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });

var feed_service = {};

// All services have a type attribute
feed_service.type = "rss-feed";

// The id of the corresponding event(match)
feed_service.eventid = "";

// The match module that this feed will moderate
feed_service.match_module = null;

// The url for the feed. // Note: Each parser knows and is responsible for its own feed url endpoint.
feed_service.feedurl = "";

// The interval that the module will request an update
feed_service.interval = 1;

// The parser name for this feed
feed_service.parsername = null;

// The parser used for this feed
feed_service.parser = null;

// Initialize feed and validate response
feed_service.init = function (matchHandler) {
  
    this.match_module = matchHandler;
    
    if (this.parsername == null)
        return "No parser attached to service";
    else
        this.parser = parsers[this.parsername];
  
    parsers[this.parsername].init(matchHandler.HookedMatch, this);
    
//    return console.log("[RSS-Feed] Service initialized");
};


feed_service.ParseEvent = function(event) {
    if (!this.match_module)
        return;
        
    this.match_module.parse(event, this.match_module.data, null);
};


feed_service.LoadPlayers = function(teamId, callback)
{
    if (!mongoose)
        return callback(null);
        
    mongoose.models.player.find({team: teamId}, function(error, data) {
        if (error)
            return;
            
        return callback(null, data);
    });
};

module.exports = feed_service;