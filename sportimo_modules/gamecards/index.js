/*
 * ***********************************************************************
 * Gamecards Module
 *
 * @description :: The Gamecards Module is repsonsible for handling
 * cards in the game. It is repsonsible for holding the list of active
 * cards and handle their destruction or winnings.
 * 
 * At its core there is the gamecards class that handles 
 * all card types, saving to the database, managing their states through the lifetime of each one, checking for winning conditions, etc.
 * 
 * It also creates API routes that instruct the module to ADD cards
 * from clients. Once the call has been received and a new gamecard
 * has been created the class handles everything else (activation /
 * destruction / db connections)
 * 
 * **********************************************************************
 */
 
"use strict"

var path = require('path'),
    fs = require('fs'),
    express = require('express'),
    moment = require('moment'),
    async = require('async'),
    log = require('winston'),
    _ = require('lodash'),
    bodyParser = require('body-parser');


/* Mongoose model
Used to access wildcards store in database*/
var UserGamecard;


/*Main module*/
var gamecards = {};

/*The database connection*/
var db = null;

/*The redis pub/sub chanel for publishing*/
var redisPublish = null;

/*The tick handler*/
var tickSchedule = null;


/************************************
 * Perform initialization functions */
gamecards.init = function (dbconnection, redisPublishChannel, match) {
    if (!db)
    {
        db = dbconnection;
        UserGamecard = db.models.userGamecards;
    }
    
    if (!redisPublish)
        redisPublish = redisPublishChannel;
    
    if (db == null || UserGamecard == null) {
        log.error("No active database connection found. Aborting.");
        return new Error('No active database connection found. Aborting.');
    }
    
    if (!tickSchedule)
        tickSchedule = setInterval(gamecards.Tick, 1000);
        
    // Check if match has gamecardDefinitions written in mongo from the gamecardTemplates and if their appearanceConditions are met, if not, create them.
    async.waterfall([
        function(callback) {
            db.models.gamecardTemplates.find({}, function(error, templates){
                if (error)
                    return callback(error);
                callback(null, templates);
            });
        },
        function(templates, callback) {
            db.models.gamecardDefinitions.find({matchid: match._id.toString()}, function(error, definitions) {
             
                if (error) 
                    return callback(error);
                
                if (templates == null || templates.length == 0)
                    return callback(null);
                //callback(null, definitions);
                let usedTemplateIds = [];
                _.forEach(definitions, function(definition) {
                    if (_.indexOf(usedTemplateIds, definition.gamecardTemplateId))
                        usedTemplateIds.push(definition.gamecardTemplateId);
                });
                
                // Now instantiate all not found templates into new gamecardDefinitions
                _.forEach(templates, function(template) {
                    if (_.indexOf(usedTemplateIds, template.id) == -1)
                    {
                        gamecards.createDefinitionFromTemplate(template, match);
                    }
                });
            });        
        }
        ], function(error, result) {
            if (error)
                log.error('Error while initializing gamecards module: ' + error.message);
        });
    
    
};



/************************************
 *          Gamecards API           *
 ***********************************/
gamecards.getTemplates = function(callback) {
    return db.models.gamecardTemplates.find({}, callback);
};


gamecards.upsertTemplate = function(template, callback) {
    let processedTemplate = null;
    try
    {
        if (template._id)
        {
            processedTemplate = db.models.gamecardTemplates.findById(template._id);
            processedTemplate.text = template.text;
            processedTemplate.activationLatency = template.activationLatency;
            processedTemplate.duration = template.duration;
            processedTemplate.appearConditions = template.appearConditions;
            processedTemplate.winConditions = template.winConditions;
            processedTemplate.terminationConditions = template.terminationConditions;
            processedTemplate.startPoints = template.startPoints;
            processedTemplate.endPoints = template.endPoints;
            processedTemplate.pointsPerMinute = template.pointsPerMinute;
            processedTemplate.options = template.options;
            // processedTemplate.cardType cannot be edited
        }
        else
        {
            processedTemplate = new db.models.gamecardTemplates();
            processedTemplate.text = template.text;
            processedTemplate.activationLatency = template.activationLatency;
            processedTemplate.duration = template.duration;
            processedTemplate.appearConditions = template.appearConditions;
            processedTemplate.winConditions = template.winConditions;
            processedTemplate.terminationConditions = template.terminationConditions;
            processedTemplate.startPoints = template.startPoints;
            processedTemplate.endPoints = template.endPoints;
            processedTemplate.pointsPerMinute = template.pointsPerMinute;
            processedTemplate.options = template.options;
            processedTemplate.cardType = template.cardType;
        }
        
        processedTemplate.save(function(error, done) {
            if (error)
                return callback(error);
                
            callback(null, done);
        });
        
    }
    catch(error)
    {
        return callback(error);
    }
    
};



gamecards.getDefinitions = function(state, callback) {
    if (!state || typeof(state) == 'function') {
        callback = state;
        state = 1; // get active ones
    }
        
    db.models.gamecardDefinitions.find({state: state, isVisible: true}, function(error, data) {
        if (error)
            return callback(error);
        callback(null, data);
    });
};


gamecards.upsertDefinition = function(gamecard, callback) {
    let processedDefinition = null;
    try
    {
        if (gamecards.validateDefinition(gamecard) == false)
            return callback(new Error('bad request: validation error in request body'));
            
        if (gamecard._id)
        {
            processedDefinition = db.models.gamecardDefinitions.findById(gamecard._id);
            processedDefinition.text = gamecard.text;
            processedDefinition.activationTime = gamecard.activationTime;
            processedDefinition.duration = gamecard.duration;
            processedDefinition.appearConditions = gamecard.appearConditions;
            processedDefinition.winConditions = gamecard.winConditions;
            processedDefinition.terminationConditions = gamecard.terminationConditions;
            processedDefinition.options = gamecard.options;
            processedDefinition.startPoints = gamecard.startPoints;
            processedDefinition.endPoints = gamecard.endPoints;
            processedDefinition.pointsPerMinute = gamecard.pointsPerMinute;
            processedDefinition.maxUserInstances = gamecard.maxUserInstances;
            processedDefinition.isVisible = gamecard.isVisible || false;
            processedDefinition.cardType = gamecard.cardType;
        }
        else
        {
            let existingDefinition = db.models.gamecardDefinitions.findById(gamecard._id);
            if (existingDefinition.state > 0)
                return callback(new Error('bad request: cannot modify a gamecard definition that is not in the pending activation state'));
                
            processedDefinition = new db.models.gamecardDefinitions({
                matchid: gamecard.matchid,
                text: gamecard.text,
                activationTime: gamecard.activationTime,
                duration: gamecard.duration,
                appearConditions: gamecard.appearConditions,
                winConditions: gamecard.winConditions,
                terminationConditions: gamecard.terminationConditions,
                options: gamecard.options,
                startPoints: gamecard.startPoints,
                endPoints: gamecard.endPoints,
                pointsPerMinute: gamecard.pointsPerMinute,
                maxUserInstances: gamecard.maxUserInstances,
                isVisible: gamecard.isVisible || false,
                cardType: gamecard.cardType,
                status: 0
            });
        }
        processedDefinition.save(function(error, done) {
            if (error)
                return callback(error);
            callback(null, done);
        });
    }
    catch(error)
    {
        return callback(error);
    }
};


// Validate the incoming gamecard definition
gamecards.validateDefinition = function(gamecardDefinition) {
    let itsNow = moment.utc();
    
    if (gamecardDefinition.creationTime && moment.utc(gamecardDefinition).creationTime >= itsNow)
        return false;
    if (gamecardDefinition.activationTime && moment.utc(gamecardDefinition).activationTime <= itsNow)
        return false;
    if (gamecardDefinition.terminationTime)
        return false;
    if (gamecardDefinition.wonTime)
        return false;
    if (!gamecardDefinition.winConditions || gamecardDefinition.winConditions.length == 0)
        return false;
    if (gamecardDefinition.startPoints < gamecardDefinition.endPoints)
        return false;
    if (gamecardDefinition.maxUserInstances && gamecardDefinition.maxUserInstances <= 0)
        return false;
    if (!gamecardDefinition.duration)
        return false;
    if (gamecardDefinition.activationLatency && gamecardDefinition.activationLatency < 0)
        return false;
        
    return true;
};


gamecards.createDefinitionFromTemplate = function(template, match) {
    let newDefinition = new db.models.gamecardDefinitions({
        matchid: match._id.toString(),
        gamecardTemplateId: template.id,
        text: template.text,
        activationTime: template.activationTime,
        duration: template.duration,
        appearConditions: template.appearConditions,
        winConditions: template.winConditions,
        terminationConditions: template.terminationConditions,
        options: template.options,
        startPoints: template.startPoints,
        endPoints: template.endPoints,
        pointsPerMinute: template.pointsPerMinute,
        maxUserInstances: template.maxUserInstances,
        isVisible: template.isVisible || false,
        cardType: template.cardType,
        status: 1
    });  
    
    // ToDo: replace text placeholders [[home_team_name]], [[away_team_name]], [[player_name]]
    
    newDefinition.save();
};


// Select all gamecardDefinitions, and filter for those that have remainingUserInstances in their userGamecards counterparts null or > 0
gamecards.getUserInstances = function(matchId, userId, callback)
{
    async.waterfall([
        function(callback) {
            db.models.gamecardDefinitions.find({isVisible: true, status: {$ne: 2}}, function(error, definitions) {
                if (error)
                    return callback(error);
                callback(null, definitions);
            });
        },
        function(definitions, callback) {
            // from the definitions, filter out those that the user has played maxUserInstances
            db.models.userGamecards.find({matchid: matchId, userid: userId, maxUserInstances: {$ne: null}}, function(error, userCards) {
                if (error)
                    return callback(error);
                
                let instancesPerDefinition = _.groupBy(userCards, 'gamecardDefinitionId');
                _.forEach(instancesPerDefinition, function(instancePerDefinition) {
                    log.debug(instancePerDefinition);
                });
                callback(null, definitions);
            });
        }
        ], function(error) {
        
    });
    
};

/* 
* Each time a gamecard is played by a user, it has to be validated before being added to the userWildcards collection in Mongo
*
* Validation Rules:
* ----------------
* the userWildcard has to include a matchId to a scheduled_match instance
* this scheduled_match instance should be existent and active
* the userWildcard has to include a reference to a gamecard definition (wildcardDefinitionId)
* this definition should be existing and active in the wildcardDefinitions collection
* the userWildcard has to include the userid of the respective user
* this user has to be existent and valid
* the userWildcard has to include the creationTime (timestamp) of the actual time that the card has been played
* this timestamp should be in utc time, earlier than now, later than the gamecard definition's activation time
* the user should not have played the same gamecard (wildcardDefinitionId) more than the maxUserInstances (if null ignore this rule)
*/
gamecards.validateUserInstance = function(matchId, userGamecard, callback) {
    if (!userGamecard.gamecardDefinitionId)
        return callback(false);
        
    if (!userGamecard.matchid)
        return callback(false);
    
    if (userGamecard.matchid != matchId)
        return callback(false);
        
    if (!userGamecard.userid)
        return callback(false);
        
    let itsNow = moment.utc();
        
    if (!userGamecard.creationTime || moment.utc(userGamecard.creationTime).isAfter(itsNow))
        return callback(false);
        
    // search for the referenced wildcardDefinitionId in the defaultDefinitions first, then to the mongo collection
    let referencedDefinition = null;
    let sameInstanceCount = 0;
    let scheduledMatch = null;
    
    async.parallel([
        function(cbk) {
            db.models.users.findById(userGamecard.userid, function(error, data) {
                if (error)
                    return cbk(error);
                cbk(null, data);
            });
        },
        function(cbk) {
            db.models.gamecardDefinitions.findById(userGamecard.gamecardDefinitionId, function(error, data) {
                if (error)
                    return cbk(false);
                
                if (data) {
                    referencedDefinition = data;
                    
                    // Found referenced definition, keep validating
                    if (!referencedDefinition.matchid || matchId != referencedDefinition.matchid)
                        return cbk(false);
                        
                    if (data.status != 1)
                        return cbk(false);
                        
                    if (data.options && data.options.length > 0 && !userGamecard.optionId)
                        return cbk(false);
                        
                    if (moment.utc(userGamecard.creationTime).isBefore(moment.utc(referencedDefinition.creationTime)))
                        return cbk(false);
                }
                
                cbk(null, referencedDefinition);
            });
        },
        function(cbk) {
            db.models.userGamecards.count({matchid: matchId, userid: userGamecard.userid, gamecardDefinitionId: userGamecard.gamecardDefinitionId}, function(error, count) {
                if (error)
                    return cbk(error);
                sameInstanceCount = count;
                cbk(null, count);
            });
        },
        function(cbk) {
            db.models.scheduled_matches.findById(matchId, function(error, match) {
                if (error)
                    return cbk(error);

                scheduledMatch = match;
                cbk(null, match);
            });
        }
        ], function(error, results) {
            if (error)
                return callback(false);
                
            let user = results[0];
            if (!user)
                return callback(false);
            // ToDo in the future: consider testing if the user is active and not banned.
                
            referencedDefinition = results[1];
                
            if (!referencedDefinition)
                return callback(false);
                
            if (!referencedDefinition.status || referencedDefinition.status != 1)
                return callback(false);
                
            if (referencedDefinition.maxUserInstances && referencedDefinition.maxUserInstances <= sameInstanceCount)
                return callback(false);
                
            return callback(true, referencedDefinition, scheduledMatch);
        });
};


// Add a user played gamecard, after first validating it against fraud, latency and inconsistency
    // {
    //     "wildcardDefinitionId": "",
    //     "userId": "",
    //     "matchid": "",
    //     "creationTime": "",
    // }

gamecards.addUserInstance = function (matchId, gamecard, callback) {
    // First of all, validate this card
    gamecards.validateUserInstance(matchId, gamecard, function(validationOutcome, gamecardDefinition, scheduledMatch)
    {
        if (!validationOutcome)
        {
            return callback(null, new Error('Bad request: validation error in request body for this user gamecard.'));
        }
    
        let itsNow = moment.utc();
        let creationMoment = moment.utc(gamecard.creationTime);
        
        // Store the mongoose model
        let newCard = null;
        try
        {
            newCard = new UserGamecard({
                userid: gamecard.userid,
                gamecardDefinitionId: gamecardDefinition.id,
                matchid: gamecard.matchid,
                minute: gamecard.minute,
                segment: gamecard.segment,
                duration: gamecardDefinition.duration || null,
                activationLatency: gamecardDefinition.activationLatency || null,
                appearConditions: gamecardDefinition.appearConditions,
                winConditions: gamecardDefinition.winConditions,
                terminationConditions: gamecardDefinition.terminationConditions,
                pointsPerMinute: gamecardDefinition.pointsPerMinute || 0,
                startPoints: gamecardDefinition.startPoints || 0,
                endPoints: gamecardDefinition.endPoints || 0,
                optionId: gamecard.optionId || null,
                cardType: gamecardDefinition.cardType,
                creationTime: moment.utc(gamecard.creationTime).toDate(),
                //activationTime: gamecardDefinition.activationTime,    // let the schema pre-save handle these times
                //terminationTime: gamecardDefinition.terminationTime,
                wonTime: null,
                pointsAwarded: null,
                status: gamecardDefinition.status || 1
            });

            if (gamecardDefinition.options && gamecard.optionId)
            {
                let optionsIndex = _.find(gamecardDefinition.options, function(option) {
                    return option.optionId == gamecard.optionId; 
                });
                if (optionsIndex)
                {
                    newCard.winConditions = optionsIndex.winConditions || null;
                    if (optionsIndex.terminationConditions)
                        newCard.terminationConditions = optionsIndex.terminationConditions || null;
                    if (optionsIndex.text)
                        newCard.text = optionsIndex.text;
                    if (optionsIndex.startPoints)
                        newCard.startPoints = optionsIndex.startPoints;
                    if (optionsIndex.endPoints)
                        newCard.endPoints = optionsIndex.endPoints;
                    if (optionsIndex.pointsPerMinute)
                        newCard.pointsPerMinute = optionsIndex.pointsPerMinute;
                    if (optionsIndex.activationLatency)
                        newCard.activationLatency = optionsIndex.activationLatency;
                    if (optionsIndex.duration)
                        newCard.duration = optionsIndex.duration;
                    newCard.optionId = optionsIndex.optionId;
                }
            }
            
            if (newCard.cardType == "Overall" && newCard.pointsPerMinute && scheduledMatch && scheduledMatch.start)
            {
                // Compute the updated starting time if the match has already started (is live)
                if (scheduledMatch.state > 0)
                    newCard.startPoints -= Math.round( moment.utc(gamecard.creationTime).subtract(moment.utc(scheduledMatch.start)).get("minute") * newCard.pointsPerMinute );
            }
            
            newCard.save(function(error) {
                if (error)
                    return callback(error);
                callback(null, null, newCard);
            });
        }
        catch(error)
        {
            return callback(error);
        }
        
    });
};

// DELETE
// removes gamecard from CardsInplay &
// from the database.
// CAUTION: USE ONLY FOR TESTING PURPOSES IN DEVELOPMENT ENVIRONMENT
gamecards.deleteUserInstance = function (gamecardId, callback) {
    db.models.gamecards.findById({_id : gamecardId}, function(error, gamecard) {
        if (error)
            return callback(error);
            
        gamecard.delete(function(error) {
            if (error)
                return callback(error);
            callback(null);
        });  
    });
};


// Manage wildcards in time, activate the ones pending activation, terminate the ones pending termination
gamecards.Tick = function()
{
    // Update all wildcards pending to be activated
    let itsNow = moment.utc();
    
    if (!db)
    {
        log.warn('Gamecards module is not yet connected to Mongo store. Aborting Tick.');
        return;
    }
    
    // Check terminationConditions on overall cards
    // Terminate active instant cards if terminationTime is passed
    
    async.parallel([
        function(callback) {
            // Update all wildcards that are due for activation
            // ToDo: Check that the appearance criteria are also met
            return db.models.gamecardDefinitions.update({status: 0, activationTime: { $lt: itsNow } }, { $set: {status: 1} }, {multi: true}, callback);
        },
        function(callback) {
            // Update all wildcards that have terminated without success
            //return db.models.gamecardDefinitions.update({status: 1, terminationTime: { $lt: itsNow } }, { $set: {status: 2} }, {multi: true}, callback);
        },
        function(callback) {
            let lostCards = null;
            db.models.userGamecards.find({ status: 1, activationTime: { $lt: itsNow },  $or: [{terminationTime: null}, {terminationTime: { $lt: itsNow}} ] }, function(error, data) {
                if (error)
                    return callback(error);
                _.forEach(data, function(card) {
                    card.status = 2;
                    
                });
                lostCards = data;
                if (!lostCards || lostCards.length == 0)
                    return callback();
                
                // Update all user gamecards that have terminated without success
                db.models.userGamecards.update(
                    { status: 1, activationTime: { $lt: itsNow },  $or: [{terminationTime: null}, {terminationTime: { $lt: itsNow}} ] },
                    { $set: {status: 2} }, {multi: true}, 
                    function(error) {
                    if (error)
                        return callback(error);   
                        
                    _.forEach(lostCards, function(lostCard) {
    				    // Send an event through Redis pu/sub:
    				    log.debug('Detected a lost gamecard: ' + lostCard);
                        redisPublish.publish("socketServers", JSON.stringify({
                            sockets: true,
                            payload: {
                                type: "Card_lost",
                                client: lostCard.userid,
                                room: lostCard.matchid,
                                data: lostCard
                            }
                        }));                    
                    });
                });
            });
        }
        ], function(error) {
            if (error)
                return;
    });
};

// Resolve an incoming match event and see if some matching wildcards win
gamecards.ResolveEvent = function(matchEvent)
{
    
    const eventSplit = function(compositeEvent)
    {
        let events = [];
        let eventData = compositeEvent.data;
        for (let name in eventData.stats)
        {
            let newEvent = {
              id: eventData.id,
              sender: !eventData.sender ? null : eventData.sender,
              matchid: eventData.match_id,
              team: eventData.team,
              playerid: !eventData.players || eventData.players.length == 0 ? null : eventData.players[0].id,
              stat: name,
              incr: eventData.stats[name],
              state: eventData.state,
              timelineEvent: eventData.timeline_event
            };
            
            events.push(newEvent);
        }
        
        return events;
    };
        
	const wildCardsHandle = function(mongoGamecards, event, cbk){
		mongoGamecards.forEach(function(gamecard){
			gamecard.winConditions.forEach(function(condition){
				if(gamecard.status!=1){
					return cbk();
				}
				if(condition.stat == event.stat && (condition.playerid == null || condition.playerid == event.playerid) && (condition.teamid == null || condition.teamid == event.team)){
					condition.remaining -= event.incr;
					if(condition.remaining <= 0){
						condition.remaining = 0;
						if (checkIfWins(gamecard)) {
						    gamecard.save();
						    // Send an event through Redis pu/sub:
						    log.debug("Detected a winning gamecard: " + gamecard);
                            redisPublish.publish("socketServers", JSON.stringify({
                                sockets: true,
                                payload: {
                                    type: "Card_won",
                                    client: gamecard.userid,
                                    room: event.matchid,
                                    data: gamecard
                                }
                            }));
						}
					}
				}
			});
		});
	};

	const checkIfWins = function(gamecard){
		const conditions = gamecard.winConditions;
		for(let i=0;  i< conditions.length; i++){
			let condition = conditions[i];
			if(condition.remaining > 0){
				return false;
			}
		}
		gamecard.status = 2; // terminated
		gamecard.terminationTime = itsNow.toDate();
		gamecard.wonTime = itsNow.toDate();
		const startInt = moment.utc(gamecard.activationTime);
		const endInt = itsNow;
		// Award points
		if (gamecard.cardType == "Instant")
		    gamecard.pointsAwarded = gamecard.startPoints - Math.round( (gamecard.endPoints - gamecard.startPoints) * (endInt.subtract(startInt).get('millisecond') / gamecard.duration ));
		else
		    gamecard.pointsAwarded = gamecard.startPoints;
		return true;
	};

	
    // Split stats property in matchEvent.data into individual transformed simpler event objects and loop the resolution logic over each one
    let individualEvents = eventSplit(matchEvent);
    const itsNow = moment.utc();
    
    async.each(individualEvents, function(event, callback) {
        try{
            const wildcardsQuery = {
        		status : 1,
        		creationTime : {$lt : event.time || itsNow},
        		matchid : event.matchid
        	};
        	const orPlayerQuery = [{playerid : null}];
        	if(event.playerid != null){
        		orPlayerQuery.push({playerid: event.playerid});
        	}
        	
        	// ToDo: matching the team ids, not 'home' or 'away'
        	
        	const orTeamQuery = [{teamid : null}];
        	if(event.team != null){
        		orTeamQuery.push({teamid: event.team});
        	}
            
        	wildcardsQuery.winConditions = {$elemMatch : {$and : [{stat: event.stat} , {remaining:{$ne:0}}, {$or : orPlayerQuery}, {$or : orTeamQuery}]}};
            let mongoWildcards;
            db.models.userGamecards.find(wildcardsQuery, function(error, data) {
                if (error)
                {
                    log.error("Error while resolving event: " + error.message);
                    return callback(error);
                }
                
                mongoWildcards = data;
                return wildCardsHandle(mongoWildcards, event, callback);
            });
        }
        catch(error) 
        {
            log.error("Error while resolving event: " + error.message);
            return callback(error);
        }
    }, function(error) {
        if (error)
        {
            log.error(error);
        }
        
        return;
    });
    
};




/************************************
 *           Routes                  *
 ************************************/

var app = null;

try {
    let testServer = require('./../../server');
    app = testServer.server;
    //module.exports = this;
} catch (ex) {
    // Start server
    app =  module.exports = exports.app = express.Router();
    var port = process.env.PORT || 8081;
    app.listen(port, function () {
        console.log('Express server listening on port %d in %s mode', port, app.get('env'));
    });
}

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Access-Token");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Loading gamecard API routes
var apiPath = path.join(__dirname, 'api');
fs.readdirSync(apiPath).forEach(function (file) {
    app.use('/', require(apiPath + '/' + file)(gamecards));
});



module.exports = gamecards;
