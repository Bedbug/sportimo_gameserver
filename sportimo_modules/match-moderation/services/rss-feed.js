
/**
 * Services are attached to match-modules based on the configuration
 * of the scheduled-match. 
 * e.g. 
 * "moderation": [{
		"type": "rss-feed",
		"eventid": "15253",
		"interval": 500,
		"parsername": "Stats"
	}]
 * should add an rss-feed service with the above configurations. 
 * The service is then responsible to handle the moderation of
 * the scheduled-match. 
*/

var path = require('path'),
    fs = require('fs'),
    mongoose = require('../config/db.js'),
    EventEmitter = require('events'),
    util = require('util');

var parsers = {};

var servicesPath = path.join(__dirname, '../parsers');
    fs.readdirSync(servicesPath).forEach(function (file) {
        parsers[path.basename(file, ".js")] = require(servicesPath + '/' + file);
    });

var modelsPath = path.join(__dirname, '../../models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });

var feed_service = {};

// All services have a type attribute
feed_service.type = "rss-feed";

// The id of the corresponding event(match)
feed_service.eventid = "";

// The interval that the module will request an update
feed_service.interval = 1;

// The parser name for this feed
feed_service.parsername = null;

// Build a node.js event emitter (see: https://nodejs.org/api/events.html)
var MyEmitter = function()
{
    EventEmitter.call(this);
};
util.inherits(MyEmitter, EventEmitter);

feed_service.emitter = new MyEmitter();

feed_service.parser = null;

// Initialize feed and validate response
feed_service.init = function (matchHandler, cbk) {
    if (feed_service.parsername == null)
        return "No parser attached to service";

    parsers[feed_service.parsername].init(matchHandler, this, function(error) {
        if (error)
            return cbk(error);
            
        feed_service.parser = parsers[feed_service.parsername];
        cbk(null, true);
    });
};

feed_service.pause = function()
{
    if (feed_service.parsername == null)
        return "No parser attached to service";

    parsers[feed_service.parsername].isPaused = true;    
};

feed_service.resume = function()
{
    if (feed_service.parsername == null)
        return "No parser attached to service";

    parsers[feed_service.parsername].isPaused = false;    
};

// Manage match events, simple proxy to match module
feed_service.AddEvent = function(event) {

    feed_service.emitter.emit('matchEvent', event);
};

// Manage match segment advances, simple proxy to match module
feed_service.AdvanceMatchSegment = function(matchInstance) {

    feed_service.emitter.emit('nextMatchSegment', matchInstance);
};

feed_service.EndOfMatch = function(matchInstance) {
    
    feed_service.emitter.emit('endOfMatch', matchInstance);
    
    // Try disposing all parser objects
    //for (var key in this.parser.keys(require.cache)) {delete require.cache[key];}
    feed_service.parsername = null;
};


// Helper function that loads a team players from the mongoDb store
feed_service.LoadPlayers = function(teamId, callback)
{
    if (!mongoose)
        return callback(null);
        
    mongoose.mongoose.models.players.find({teamId: teamId}, function(error, data) {
        if (error)
            return;
            
        return callback(null, data);
    });
};


feed_service.LoadTeam = function(teamId, callback)
{
    if (!mongoose)
        return callback(null);
        
    mongoose.mongoose.models.teams.findById(teamId, function(error, data) {
        if (error)
            return;
            
        return callback(null, data);
    });
};


feed_service.LoadCompetition = function(competitionId, callback)
{
    if (!mongoose)
        return callback(null);
        
    mongoose.mongoose.models.competitions.findById(competitionId, function(error, data) {
        if (error)
            return;
            
        return callback(null, data);
    });
};

module.exports = feed_service;