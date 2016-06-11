
/**
 * Services are attached to match-modules based on the configuration
 * of the scheduled-match. 
 * e.g. 
 * "moderation": [{
		"type": "rss-feed",
		"parserid": "15253",
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
    util = require('util'),
    log = require('winston'),
    _ = require('lodash');

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
feed_service.parserid = "";

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


feed_service.parser = null;
 
// Initialize feed and validate response
feed_service.init = function (matchHandler, cbk) {
    if (this.parsername == null)
        return cbk(new Error("No parser attached to service"));
    if (!parsers[this.parsername])
        return cbk(new Error("No parser with the name " + this.parsername + " can be found."));

    log.info("Initializing rss-feed service for match id " + matchHandler.id);

    try
    {
        var selectedParser = _.cloneDeep(parsers[this.parsername]);
        selectedParser.init(matchHandler, this, function(error) {
            if (error)
                return cbk(error);
                
            feed_service.parser = parsers[this.parsername];
            feed_service.emitter = new MyEmitter();
            return cbk(null, feed_service);
        });
    }
    catch(error)
    {
        log.error("Error while initializing feed_service module for match %s : %s", matchHandler.id, error.message);
        return cbk(error);
    }
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

feed_service.isActive = function()
{
    if (!feed_service.parsername || !parsers.length > 0 || !parsers[feed_service.parsername])
        return false;
    else
        return parsers[feed_service.parsername].isPaused;
}

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
    try
    {    
        return mongoose.mongoose.models.players.find({teamId: teamId}, callback);
    }
    catch(error) {
        log.error("Error while loading players from Mongo: %s", error.message);
        return callback(error);
    }
};


feed_service.LoadTeam = function(teamId, callback)
{
    if (!mongoose)
        return callback(null);
    try
    {
        return mongoose.mongoose.models.teams.findById(teamId, callback);
    }
    catch(error) {
        log.error("Error while loading team from Mongo: %s", error.message);
        return callback(error);
    }
};


feed_service.LoadCompetition = function(competitionId, callback)
{
    if (!mongoose)
        return callback(null);
    
    try {
        return mongoose.mongoose.models.competitions.findById(competitionId, callback);
    }
    catch(error) {
        log.error("Error while loading competition from Mongo: %s", error.message);
        return callback(error);
    }
};

feed_service.SaveParsedEvents = function(matchId, events)
{
    if (!mongoose)
        return;
        
    try {
        mongoose.mongoose.models.matchfeedStatus.findOneAndUpdate({matchid: matchId}, { $set: { parsed_eventids: events} }, function(err, result) {
            if (err)
            {
                log.error("Error while saving parser eventIds in match moderation");
                return;
            }
        });
    }
    catch(error) {
        log.error("Error while loading competition from Mongo: %s", error.message);
        return;        
    }
};

feed_service.LoadParsedEvents = function(matchId, callback)
{
    if (!mongoose)
        return;
        
    try {
        mongoose.mongoose.models.matchfeedStatus.findOne({matchid: matchId}, function(err, result) {
            if (err)
            {
                log.error("Error while saving parser eventIds in match moderation");
                return callback(err);
            }
            if (!result.parsed_eventids)
                return callback(null);
                
            callback(result.parsed_eventids);
        });
    }
    catch(error) {
        log.error("Error while loading competition from Mongo: %s", error.message);
        return callback(error);        
    }
};

module.exports = feed_service;