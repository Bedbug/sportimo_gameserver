/*
 * ***********************************************************************
 * Wildcards Module
 *
 * @description :: The Wildcards Module is repsonsible for handling
 * cards in the game. It is repsonsible for holding the list of active
 * cards and handle their destruction or winnings.
 * 
 * At its core there is the wildcards class that handles 
 * all wildcard types, saving to the database, managing their states through the lifetime of each one, checking for winning conditions, etc.
 * 
 * The module hooks and listens the pub/sub Redis channel for events
 * on stat changes and handles them accordingly.
 * 
 * It also creates API routes that instruct the module to ADD cards
 * from clients. Once the call has been received and a new wildcard
 * has been created the class handles everything else (activation /
 * destruction / db connections)
 * 
 * **********************************************************************
 */
 
"use strict"

var path = require('path'),
    fs = require('fs'),
    moment = require('moment'),
    async = require('async'),
    log = require('winston'),
    _ = require('lodash'),
    bodyParser = require('body-parser');

var defaultDefinitions = require('./defaultWildcardDefinitions.js');

/* Mongoose model
Used to access wildcards store in database*/
var DatabaseWildcard;


/*Main module*/
var wildcards = {};

/*The database connection*/
wildcards.db = null;

/*The tick handler*/
wildcards.tickSchedule = null;


/************************************
 * Perform initialization functions */
wildcards.init = function (dbconnection) {
    wildcards.db = dbconnection;
    
    var modelsPath = path.join(__dirname, '../models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });
    
    DatabaseWildcard = wildcards.db.models.userWildcards;

    
    if (wildcards.db == null || DatabaseWildcard == null) {
        log.error("No active database connection found. Aborting.");
        return new Error('No active database connection found. Aborting.');
    }

    wildcards.tickSchedule = setInterval(wildcards.Tick, 1000);
    
    /*Get All cards from database with status lower than 2 (not closed)*/
    // DatabaseWildcard.find({
    //     "status": {
    //         $lt: 2
    //     }
    // }, function (err, cards) {
    //     if (err)
    //         return;
    // });
};



/************************************
 *          Widlcards API           *
 ***********************************/
wildcards.getTemplates = function(callback) {
    return wildcards.db.models.wildcardTemplates.find({}, callback);
};


wildcards.upsertTemplate = function(template, callback) {
    let processedTemplate = null;
    try
    {
        if (template._id)
        {
            processedTemplate = wildcards.db.models.wildcardTemplates.findById(template._id);
            processedTemplate.text = template.text;
            processedTemplate.timeToActivate = template.timeToActivate;
            processedTemplate.duration = template.duration;
            processedTemplate.conditionsToAppear = template.conditionsToAppear;
            processedTemplate.winConditions = template.winConditions;
            processedTemplate.terminationConditions = template.terminationConditions;
            processedTemplate.maxPoints = template.maxPoints;
            processedTemplate.minPoints = template.minPoints;
            processedTemplate.pointStep = template.pointStep;
        }
        else
        {
            processedTemplate = new wildcards.db.models.wildcardTemplates();
            processedTemplate.text = template.text;
            processedTemplate.timeToActivate = template.timeToActivate;
            processedTemplate.duration = template.duration;
            processedTemplate.conditionsToAppear = template.conditionsToAppear;
            processedTemplate.winConditions = template.winConditions;
            processedTemplate.terminationConditions = template.terminationConditions;
            processedTemplate.maxPoints = template.maxPoints;
            processedTemplate.minPoints = template.minPoints;
            processedTemplate.pointStep = template.pointStep;
        }
    }
    catch(error)
    {
        return callback(error);
    }
    
    let result = processedTemplate.save();
    callback(null, result);
};



wildcards.getDefinitions = function(state, callback) {
    if (!state || typeof(state) == 'function') {
        callback = state;
        state = 1; // get active ones
    }
        
    wildcards.db.models.wildcardDefinitions.find({state: state}, function(error, data) {
        if (error)
            return callback(error);
        // merge data with default definitions
        //let augmentedWildcardDefinitions = _.concat(data, defaultDefinitions);
        _.forEach(defaultDefinitions, function(def) {
            data.push(def);
        });
        callback(null, data);
    });
};


wildcards.upsertDefinition = function(wildcard, callback) {
    let processedDefinition = null;
    try
    {
        if (wildcards.validateDefinition(wildcard) == false)
            return callback(new Error('bad request: validation error in request body'));
            
        if (wildcard._id)
        {
            processedDefinition = wildcards.db.models.wildcardDefinitions.findById(wildcard._id);
            processedDefinition.text = wildcard.text;
            processedDefinition.timeToActivate = wildcard.timeToActivate;
            processedDefinition.duration = wildcard.duration;
            processedDefinition.conditionsToAppear = wildcard.conditionsToAppear;
            processedDefinition.winConditions = wildcard.winConditions;
            processedDefinition.terminationConditions = wildcard.terminationConditions;
            processedDefinition.maxPoints = wildcard.maxPoints;
            processedDefinition.minPoints = wildcard.minPoints;
            processedDefinition.pointStep = wildcard.pointStep;
        }
        else
        {
            let existingDefinition = wildcards.db.models.wildcardDefinitions.findById(wildcard._id);
            if (existingDefinition.state > 0)
                return callback(new Error('bad request: cannot modify a wildcard definition that is not in the pending activation state'));
                
            processedDefinition = new wildcards.db.models.wildcardDefinition({
                text: wildcard.text,
                timeToActivate: wildcard.timeToActivate,
                duration: wildcard.duration,
                conditionsToAppear: wildcard.conditionsToAppear,
                winConditions: wildcard.winConditions,
                terminationConditions: wildcard.terminationConditions,
                maxPoints: wildcard.maxPoints,
                minPoints: wildcard.minPoints,
                pointStep: wildcard.pointStep
            });
        }
    }
    catch(error)
    {
        return callback(error);
    }
    
    let result = processedDefinition.save();
    callback(null, result);
};


// Validate the incoming wildcard definition
wildcards.validateDefinition = function(wildcardDefinition) {
    let itsNow = moment.utc();
    
    if (wildcardDefinition.creationTime && wildcardDefinition.creationTime >= itsNow)
        return false;
    if (wildcardDefinition.activationTime && wildcardDefinition.activationTime <= itsNow)
        return false;
    if (wildcardDefinition.terminationTime)
        return false;
    if (wildcardDefinition.wonTime)
        return false;
    if (!wildcardDefinition.winConditions || wildcardDefinition.winConditions.length == 0)
        return false;
    if (wildcardDefinition.maxPoints < wildcardDefinition.minPoints)
        return false;
        
    return true;
};


/* 
* Each time a wildcard is played by a user, it has to be validated before being added to the userWildcards collection in Mongo
*
* Validation Rules:
* ----------------
* the userWildcard has to include a matchId to a scheduled_match instance
* this scheduled_match instance should be existent and active
* the userWildcard has to include a reference to a wildcard definition (wildcardDefinitionId)
* this definition should be existing and active in the wildcardDefinitions collection
* the userWildcard has to include the userid of the respective user
* this user has to be existent and valid
* the userWildcard has to include the creationTime (timestamp) of the actual time that the card has been played
* this timestamp should be in utc time, earlier than now, later than the wildcard definition's activation time
* the user should not have played the same wildcard (wildcardDefinitionId) more than the maxUserInstances (if null ignore this rule)
*/
wildcards.validateUserInstance = function(matchId, userWildcard, callback) {
    if (!userWildcard.wildcardDefinitionId)
        return callback(false);
        
    if (!userWildcard.matchid)
        return callback(false);
    
    if (userWildcard.matchid != matchId)
        return callback(false);
        
    if (!userWildcard.userid)
        return callback(false);
        
    let itsNow = moment.utc();
        
    if (!userWildcard.creationTime || userWildcard > itsNow)
        return callback(false);
        
    // search for the referenced wildcardDefinitionId in the defaultDefinitions first, then to the mongo collection
    let referencedDefinition = null;
    
    _.forEach(defaultDefinitions, function(def) {
        if (def.id == userWildcard.wildcardDefinitionId)
            referencedDefinition = def;
    });
    
    async.parallel([
        function(cbk) {
            wildcards.db.models.users.findById(userWildcard.userid, function(error, data) {
                if (error)
                    return cbk(error);
                cbk(null, data);
            });
        },
        function(cbk) {
            wildcards.db.models.wildcardDefinitions.findById(userWildcard.wildcardDefinitionId, function(error, data) {
                if (error && !referencedDefinition)
                    return cbk(false);
                
                if (data) {
                    referencedDefinition = data;
                    
                    // Found referenced definition, keep validating
                    if (!referencedDefinition.matchid || matchId != referencedDefinition.matchid)
                        return cbk(false);
                        
                    if (data.status != 1)
                        return cbk(false);
                        
                    if (userWildcard.creationTime < data.activationTime)
                        return cbk(false);
                }
                
                cbk(null, referencedDefinition);
            });
        }
        ], function(error, results) {
            if (error)
                return callback(false);
                
            let user = results[0];
            // ToDo in the future: consider testing if the user is active and not banned.
                
            referencedDefinition = results[1];
                
            if (!referencedDefinition)
                return callback(false);
                
            if (!referencedDefinition.status || referencedDefinition.status != 1)
                return callback(false);
                
            return callback(true, referencedDefinition);
        });
};


// Add a user played wildcard, after first validating it against fraud, latency and inconsistency
    // {
    //     "wildcardDefinitionId": "",
    //     "userId": "",
    //     "matchid": "",
    //     "creationTime": "",
    // }

wildcards.addUserInstance = function (matchId, wildcard, callback) {
    // First of all, validate this card
    wildcards.validateUserInstance(matchId, wildcard, function(validationOutcome, wildcardDefinition)
    {
        if (!validationOutcome)
        {
            return callback(null, new Error('Bad request: validation error in request body for this user wildcard.'));
        }
    
        let itsNow = moment.utc();
        
        // Store the mongoose model
        let newCard = null;
        try
        {
            newCard = new DatabaseWildcard({
                userid: wildcard.userid,
                matchid: wildcard.matchid,
                minute: wildcard.minute,
                segment: wildcard.segment,
                duration: wildcardDefinition.duration,
                activationLatency: wildcardDefinition.activationLatency,
                appearConditions: wildcardDefinition.appearConditions,
                winConditions: wildcardDefinition.winConditions,
                pointStep: (wildcardDefinition.maxPoints - wildcardDefinition.minPoints) / (wildcardDefinition.duration / 1000),
                minPoints: wildcardDefinition.minPoints,
                maxPoints: wildcardDefinition.maxPoints,
                creationTime: wildcard.creationTime,
                status: wildcardDefinition.status,
                linkedEvent: 0
            });
            
            let result = newCard.save();
            callback(null, null, newCard);
        }
        catch(error)
        {
            return callback(error);
        }
        
    });
};

// DELETE
// removes wildcard from CardsInplay &
// from the database
wildcards.deleteUserInstance = function (wildcard_id, callback) {
    wildcards.db.models.wildcards.findById({_id : wildcard_id}, function(error, wildcard) {
        if (error)
            return callback(error);
            
        let result = wildcard.delete();  
        callback(result);
    });
};


// Manage wildcards in time, activate the ones pending activation, terminate the ones pending termination
wildcards.Tick = function()
{
    // Update all wildcards pending to be activated
    let itsNow = moment.utc();
    
    if (!wildcards.db)
    {
        log.warn('Wildcards module is not yet connected to Mongo store. Aborting Tick.');
        return;
    }
    
    async.parallel([
        function(callback) {
            // Update all wildcards that are due for activation
            // ToDo: Check that the appearance criteria are also met
            return wildcards.db.models.wildcardDefinitions.update({status: 0, activationTime: { $lt: itsNow } }, { $set: {state: 1} }, {multi: true}, callback);
        },
        function(callback) {
            // Update all wildcards that have terminated without success
            return wildcards.db.models.wildcardDefinitions.update({status: 1, terminationTime: { $lt: itsNow } }, { $set: {state: 2} }, {multi: true}, callback);
        }
        ], function(error) {
            if (error)
                return;
    });
};

// Resolve an incoming match event and see if some matching wildcards win
wildcards.ResolveEvent = function(matchEvent, outerCallback)
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
              playerid: !eventData.players ? null : eventData.players[0].id,
              stat: name,
              incr: eventData.stats[name],
              state: eventData.state,
              timelineEvent: eventData.timeline_event
            };
            
            events.push(newEvent);
        }
        
        return events;
    };
        
	const wildCardsHandle = function(mongoWildcards){
		mongoWildcards.forEach(function(wildcard){
			wildcard.win_conditions.forEach(function(condition){
				if(wildcard.state!=0){
					return;
				}
				if(condition.stat == event.stat && (condition.playerid == null || condition.playerid == event.playerid) && (condition.team == null || condition.teamid == event.team)){
					condition.remaining -= event.incr;
					if(condition.remaining <= 0){
						condition.remaining = 0;
						checkIfWins(wildcard);
					}
				}
			});
		});
		updateWildcards(mongoWildcards);
	};

	const checkIfWins = function(wildcard){
		const conditions = wildcard.conditions;
		for(let i=0;  i< conditions.length; i++){
			let condition = conditions[i];
			if(condition.remaining > 0){
				return;
			}
		}
		wildcard.state = 2; // terminated
		wildcard.terminationTime = itsNow;
		wildcard.wonTime = itsNow;
		const startInt = (new Date(wildcard.activationTime)).getTime();
		const endInt = itsNow;
		// Award points
		wildcard.winPoints = wildcard.maxpoints - Math.round(wildcard.points_step * (endInt - startInt));
	};

	const updateWildcards = function(mongoWildcards){
		console.log('updating mongoWildcards: ', mongoWildcards);
		if(mongoWildcards.length==0){
			return;
		}
		wildcards.db.collection('userWildcards').save(mongoWildcards, function(){});
		const batch = wildcards.db.collection('userWildcards').initializeUnorderedBulkOp();
		mongoWildcards.forEach(function(o){
			batch.find({_id:o._id}).updateOne(o)
		});
		batch.execute(function(){});
	};
	
	
    // Split stats property in matchEvent.data into individual transformed simpler event objects and loop the resolution logic over each one
    let individualEvents = eventSplit(matchEvent);
    const itsNow = moment.utc();
    
    async.each(individualEvents, function(event, callback) {
    
        const wildcardsQuery = {
    		state : 0,
    		creationTime : {$lt : event.time},
    		activationTime : {$lt : event.time},
    		matchid : event.match_id
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
        
    	wildcardsQuery.win_conditions = {$elemMatch : {$and : [{stat: event.stat} , {remaining:{$ne:0}}, {$or : orPlayerQuery}, {$or : orTeamQuery}]}};
        let mongoWildcards;
        wildcards.db.models.userWildcards.find(wildcardsQuery, function(error, data) {
            if (error)
            {
                log.error("Error while resolving event: " + error.message);
                return callback(error);
            }
            
            mongoWildcards = data;
            wildCardsHandle(mongoWildcards);
        });
    }, function(error) {
        if (error)
            return outerCallback(error);
        
        outerCallback(null);
    });
    
};




/************************************
 *           Routes                  *
 ************************************/
wildcards.SetupAPIRoutes = function (server) {
    // Load up the Rest-API routes
    server.use(bodyParser.json());
    server.use(bodyParser.urlencoded({
        extended: true
    }));
    server.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        next();
    });

    // Loading wildcard schemas
    var apiPath = path.join(__dirname, 'api');
    fs.readdirSync(apiPath).forEach(function (file) {
        server.use('/', require(apiPath + '/' + file)(wildcards));
    });
}



module.exports = wildcards;

//function ValidateCards() {
//    log("Cards Validation Request");
//    var indx = 0;
//
//    playedActiveCards.forEach(function (card) {
//        indx++;
//
//        var timeout = setTimeout(function () {
//            validate();
//
//        }, indx * 200);
//            
//        // function check(){
//        //     log("in:"+indx);
//        // }
//            
//        function validate() {
//            
//            // log("Creating card");
//            var newWildcard = new WildCard(card.cardid, card.userid, card.gameid, card.minute, card.cardtype, card.which_half, card.questionid);
//            newWildcard.attributes.saved = true;
//        
//            // Get event
//            var cardEvent = TypeCard(card.cardtype);
//        
//            // Get Card's range
//            var cardRange = {
//                starts: moment.utc(card.created).add(20, 's'),
//                ends: moment.utc(card.created).add(newWildcard.defaults.destroy_timer).add(20, 's')
//            }
//         
//            // First check if it is not active
//            if (card.activated == 0) {
//                log("Card has not activate yet in DB", 'debug');
//                var diff = moment.utc().diff(moment(card.created));
//                if (diff < newWildcard.defaults.delay_timer) {
//                    log("Corrected: card will be active in: " + ((newWildcard.defaults.delay_timer - diff) / 1000));
//                    // We found a card wich is not active but not enough time has passed to activate it. We init it and set the correct activation timer
//                    newWildcard.init(newWildcard.defaults.delay_timer - diff);
//                    PlayedCards.push(newWildcard);
//                    // We do't need to do anything else
//                    return;
//                }
//                log("Result: But it should.", 'debug');
//            }
// 
//            // We must check if the card was won something in its time range.
//            // Loop through all the latest events and see if there is a corresponding event in the time range
//            log("Looping through game evets", 'debug');
//            var matchEvents = _.where(lastGameEvents, { match_id: card.gameid });
//            matchEvents.forEach(function (event) {
//
//                if (newWildcard.attributes.activated == 2) return;
//
//                if (event.event_description == cardEvent && (moment.utc(event.created) > cardRange.starts && moment.utc(event.created) < cardRange.ends)) {
//                    log("Result: We found an event in the card's time range", "debug");
//                    log(JSON.stringify(event), "debug"); 
//                    // So, the card has finished
//                    newWildcard.attributes.activated = 2;
//                    
//                    // Set the correct timer 
//                    var millisecondsPassed = Math.round(moment.utc(event.created).diff(cardRange.starts) / 1000) * 1000;
//
//                    // log("ms: " + millisecondsPassed);
//                    newWildcard.defaults.destroy_timer = 300000 - millisecondsPassed;
//
//                    // log("The new timer: " + newWildcard.defaults.destroy_timer);
//                    // Count Points
//                    newWildcard.attributes.countpoints -= Math.floor(millisecondsPassed / newWildcard.defaults.points_step) * newWildcard.pointIncrement;
//                    newWildcard.attributes.points = Math.round(newWildcard.attributes.countpoints + newWildcard.attributes.minpoints);
//                    // log(newWildcard.attributes.points);
//                
//                    // Sync the timer that is used in the client for compatibility
//                    newWildcard.attributes.timer = newWildcard.defaults.destroy_timer / 1000;
//                    
//                    // And now win it
//                    newWildcard.win(event.id);
//                    newWildcard.save();
//
//                }
//            });
//        
//            // We don't need to preceed further is the card has won already
//            if (newWildcard.attributes.activated == 2) return;
//
//            log("Result: No event found", "warn");
//        
//            // Now we check to see if the card has finished without winning anything
//            log("Check if the card has finished", "warn");
//
//            if (moment.utc() > cardRange.ends) {
//                newWildcard.attributes.activated = 2;
//                newWildcard.attributes.points = 0;
//                newWildcard.attributes.timer = 0;
//                newWildcard.save();
//                // No need to clear(). Card was not pushed in anything and timers have not started
//                log("Result: It has finished.", "warn");
//                return;
//            }
//         
//            // Now let's finish it. If we've reached this point, it means that card has not won but it has time left on the timer.
//            // Lets calculate how much that is and send it on its way.
//            log("Set data for active card", "warn"); 
//            // has been activated but not finished
//            newWildcard.attributes.activated = 1;
//          
//            // Set the correct timer 
//            var millisecondsPassed = Math.round(moment.utc().diff(cardRange.starts) / 1000) * 1000;
//            log(moment.utc().format() + " | " + cardRange.starts.format(), "warn");
//            // log("ms: " + millisecondsPassed);
//            newWildcard.defaults.destroy_timer = 300000 - millisecondsPassed;
//            // log("The new timer: " + newWildcard.defaults.destroy_timer);
//            // Sync the timer that is used in the client for compatibility
//            newWildcard.attributes.timer = newWildcard.defaults.destroy_timer / 1000;
//            // Count Points
//            newWildcard.attributes.countpoints -= Math.floor(millisecondsPassed / newWildcard.defaults.points_step) * newWildcard.pointIncrement;
//            newWildcard.attributes.points = Math.round(newWildcard.attributes.countpoints + newWildcard.attributes.minpoints);
//            PlayedCards.push(newWildcard);
//            newWildcard.activate();
//
//        }
//    })
//}
