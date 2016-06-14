
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
    
var serviceType = "rss-feed";

function feedService(service) {
    // All services have a type attribute
    if (service.type != serviceType)
        return null;
    this.type = serviceType;
    
    // The parser name for this feed
    if (!service.parsername)
        return null;
    this.parsername = service.parsername || null; 
    
    // The id of the corresponding event(match)
    this.parserid = service.parserid || 0;
    
    // The interval that the module will request an update
    this.interval = service.interval || 5000;
    
    this.active = service.active || true;
    
    this.parser = null;
};


 
// Initialize feed and validate response
feedService.prototype.init = function (matchHandler, cbk) {
    var that = this;
    
    if (that.parsername == null)
        return cbk(new Error("No parser attached to service"));
    if (!parsers[that.parsername])
        return cbk(new Error("No parser with the name " + this.parsername + " can be found."));

    log.info("Initializing rss-feed service for match id " + matchHandler.id);

    try
    {
        var selectedParser = new parsers[that.parsername](matchHandler, that);
        selectedParser.init(function(error) {
            if (error)
                return cbk(error);
                
            // Build a node.js event emitter (see: https://nodejs.org/api/events.html)
            var MyEmitter = function()
            {
                EventEmitter.call(that);
            };
            util.inherits(MyEmitter, EventEmitter);

                
            that.emitter = new MyEmitter();
            return cbk(null, that);
        });
        that.parser = selectedParser;
    }
    catch(error)
    {
        log.error("Error while initializing feed_service module for match %s : %s", matchHandler.id, error.message);
        return cbk(error);
    }
};

feedService.prototype.updateMatchStats = function(leagueName, matchId, manualCallback)
{
    // if (feedService.parsername == null)
    //     return "No parser attached to service";

    this.parser.GetMatchEventsWithBox(leagueName, matchId, manualCallback);    
};


feedService.prototype.pause = function()
{
    if (!this.parser || this.parsername == null)
        return "No parser attached to service";

    this.parser.isPaused = true;  
    this.active = false;
};

feedService.prototype.resume = function()
{
    if (!this.parser || this.parsername == null)
        return "No parser attached to service";

    this.parser.isPaused = false;  
    this.active = true;
};

feedService.prototype.isActive = function()
{
    if (!this.parser || !this.parsername)
        return false;
    else
        return this.parser.isPaused;
};

// Manage match events, simple proxy to match module
feedService.prototype.AddEvent = function(event) {

    this.emitter.emit('matchEvent', event);
};

// Manage match segment advances, simple proxy to match module
feedService.prototype.AdvanceMatchSegment = function(matchInstance) {

    this.emitter.emit('nextMatchSegment', matchInstance);
};

feedService.prototype.EndOfMatch = function(matchInstance) {
    
    this.emitter.emit('endOfMatch', matchInstance);
    
    // Try disposing all parser objects
    //for (var key in this.parser.keys(require.cache)) {delete require.cache[key];}
    this.parsername = null;
    this.parser = null;
};


// Helper function that loads a team players from the mongoDb store
feedService.prototype.LoadPlayers = function(teamId, callback)
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


feedService.prototype.LoadTeam = function(teamId, callback)
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


feedService.prototype.LoadCompetition = function(competitionId, callback)
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

feedService.prototype.SaveParsedEvents = function(matchId, events)
{
    if (!mongoose)
        return;
        
    try {
        mongoose.mongoose.models.matchfeedStatuses.findOneAndUpdate({matchid: matchId}, { $set: { matchid: matchId, parsed_eventids: events} }, { upsert: true }, function(err, result) {
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

feedService.prototype.LoadParsedEvents = function(matchId, callback)
{
    if (!mongoose)
        return;
        
    try {
        mongoose.mongoose.models.matchfeedStatuses.findOne({matchid: matchId}, function(err, result) {
            if (err)
            {
                log.error("Error while saving parser eventIds in match moderation");
                return callback(err);
            }
            if (!result || !result.parsed_eventids)
                return callback(null);
                
            callback(null, result);
        });
    }
    catch(error) {
        log.error("Error while loading competition from Mongo: %s", error.message);
        return callback(error);        
    }
};

module.exports = feedService;
