/*
 * ***********************************************************************
 * Wildcards Module
 *
 * @description :: The Wildcards Module is repsonsible for handling
 * cards in the game. It is repsonsible for holding the list of active
 * cards and handle their destruction or winnings.
 * 
 * At its core there is the wildcard controller/class that hadndles 
 * internal timers, saving to the database, winning conditions, etc.
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
    //WildcardCtrl = require("./controllers/wildcard"),
    moment = require('moment'),
    async = require('async'),
    log = require('winston'),
    _ = require('lodash'),
    bodyParser = require('body-parser');

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
    this.db = dbconnection;
    
    var modelsPath = path.join(__dirname, '../models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });
    
    DatabaseWildcard = this.db.models.wildcard;

    
    if (this.db == null || DatabaseWildcard == null) {
        log.error("No active database connection found. Aborting.");
        return;
    }

    wildcards.tickSchedule = setInterval(wildcards.Tick, 1000);
    
    /*Get All cards from database with status lower than 2 (not closed)*/
    DatabaseWildcard.find({
        "status": {
            $lt: 2
        }
    }, function (err, cards) {
        if (err)
            return;
    });
};



/************************************
 *          Widlcards API           *
 ***********************************/

// ADD
wildcards.add = function (wildcard) {
    // Store the mongoose model
    let newCard = new DatabaseWildcard({
        userid: wildcard.userid,
        gameid: wildcard.gameid,
        minute: wildcard.minute,
        segment: wildcard.segment,
        duration: wildcard.duration,
        activates_in: wildcard.activates_in,
        appear_conditions: wildcard.appear_conditions,
        win_conditions: {
            match: wildcard.win_conditions.match,
            stats: wildcard.win_conditions.stats
        },
        points: wildcard.maxpoints,
        points_step: (wildcard.maxpoints - wildcard.minpoints) / (wildcard.duration / 1000),
        minpoints: wildcard.minpoints,
        maxpoints: wildcard.maxpoints,
        status: 0,
        linked_event: 0
    });
    
    newCard.save();

    return newCard;
};

// DELETE
// removes wildcard from CardsInplay &
// from the database
wildcards.delete = function (wildcard_id) {
    this.db.models.wildcards.findById({_id : wildcard_id}, function(error, wildcard) {
        if (error)
            return error;
            
        wildcard.delete();  
        return;
    });
};


// Manage wildcards in time, activate the ones pending activation, terminate the ones pending termination
wildcards.Tick = function()
{
    // Update all wildcards pending to be activated
    let itsNow = moment.utc();
    
    async.parallel([
        function(callback) {
            // Update all wildcards that are due for activation
            // ToDo: Check that the appearance criteria are also met
            this.db.models.wildcards.update({status: 0, activationTime: { $lt: itsNow } }, { $set: {state: 1} }, {multi: true}, callback);
        },
        function(callback) {
            // Update all wildcards that have terminated without success
            this.db.models.wildcards.update({status: 1, terminationTime: { $lt: itsNow } }, { $set: {state: 2} }, {multi: true}, callback);
        }
        ], function(error) {
            if (error)
                return;
    });
};

// Resolve an incoming match event and see if some wildcards win
wildcards.ResolveEvent = function(matchEvent)
{
    const itsNow = moment.utc();
    const wildcardsQuery = {
		state : 'pending',
		creationTime : {$lt : matchEvent.time},
		activationTime : {$lt : matchEvent.time},
		matchid : matchEvent.data.match_id
	};
	const orPlayerQuery = [{playerid : null}];
	if(matchEvent.data.playerid != null){
		orPlayerQuery.push({playerid: matchEvent.data.players[0]});
	}
	// ToDo: matching the team ids, not 'home' or 'away'
	
    // 	const orTeamQuery = [{teamid : null}];
    // 	if(teamid != null){
    // 		orTeamQuery.push({teamid: teamid});
    // 	}
    
    // ToDo: Get from stats the aggregate stat of the given event
    
	wildcardsQuery.win_conditions = {$elemMatch : {$and : [{tag: tag} , {remaining:{$ne:0}}, {$or : orPlayerQuery}, {$or : orTeamQuery}]}};
    this.db.models.wildcards.find(wildcardsQuery, function(error, wildcardsToWin) {
        if (error)
        {
            log.error("Error while resolving event: " + error.message);
            return;
        }
        
        _.forEach(wildcardsToWin, function(cardToWin) {
             
        });
    });
}


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
