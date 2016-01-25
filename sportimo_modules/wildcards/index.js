var path = require('path'),
    fs = require('fs'),
    WildcardCtrl = require("./controllers/wildcard"),
    moment = require('moment'),
    _ = require('lodash'),
    bodyParser = require('body-parser');

var DatabaseWildcard;


var wildcards = {};


//  The list that holds all active cards 
wildcards.CardsInPlay = [];

// The database connection
wildcards.db = null;

// Load models and setup database connection
wildcards.SetupMongoDB = function (dbconenction) {
    this.db = dbconenction;
    var modelsPath = path.join(__dirname, 'models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });
    DatabaseWildcard = this.db.models.wildcard;
}

/************************************
 * Perform initialization functions */
wildcards.init = function () {
    if (this.db == null || DatabaseWildcard == null) {
        console.log("No active database connection found. Aborting.");
        return;
    }

    // Get All cards from database with status lower than 2 (not closed)
    DatabaseWildcard.find({
        "status": {
            $lt: 2
        }
    }, function (err, cards) {
        if (err)
            return;
        // If there are any, sort them out and handle them
        if (cards.length > 0) {
            ValidateTempCards(cards);
        }
    });
};

/****************************************
 * Validate the supplied list of cards.
 * Handle them according to their status.
 */
var ValidateTempCards = function (cards) {
    var idx = 0;
    cards.forEach(function (card) {
        idx++;

        setTimeout(function () {
            validate();
        }, idx * 200);

        function validate() {
            // Create a wildcard controller from the stored database card
            var wildcard = new WildcardCtrl(card);
        };


    });
};


/************************************
 *          Widlcards API           *
 ***********************************/

// ADD
wildcards.add = function (wildcard) {
    wildcards.CardsInPlay.push(wildcard);
    wildcard.init();

    return wildcard;
}
// REMOVE
// removes wildcard from CardsInplay
wildcards.remove = function (wildcard) {
    this.CardsInPlay = _.without(this.CardsInPlay, wildcard);
}
// DELETE
// removes wildcard from CardsInplay &
// from the database
wildcards.delete = function (wildcard_id) {
    var wildcard = _.find(this.CardsInPlay, {"id":wildcard_id});
    wildcards.remove(wildcard);
    wildcard.delete();   
}

// UPDATE



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
        console.log(apiPath + '/' + file);
        server.use('/', require(apiPath + '/' + file)(wildcards));
    });
}

//setServerForRoutes: function (app) {
//    app.use(bodyParser.json());
//    app.use(bodyParser.urlencoded({
//        extended: true
//    }));
//
//    var thisWildcard = this;
//
//    app.use(function (req, res, next) {
//        res.header("Access-Control-Allow-Origin", "*");
//        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//        next();
//    });
//
//    /*
//     **    API endpoint /insertcard
//     */
//    app.post('/api/v1/insertcard', function (req, res) {
//        var card = Wildcards.Add(req.body.cardid, req.body.userid, req.body.gameid, req.body.minute, req.body.cardtype, req.body.which_half, req.body.questionid);
//        return res.send(JSON.stringify(card));
//    });
//
//    /*
//     **    API endpoint /getpoints
//     */
//    app.post('/api/v1/getpoints', function (req, res) {
//
//        var cardpoints = Wildcards.GetPoints(req.body.cardid, req.body.userid, req.body.gameid, req.body.cardtype, res);
//        // return res.send(cardpoints);
//    });
//
//    app.post('/api/v1/event', function (req, res) {
//        var newevent = {
//            event: 'new_game_event',
//            data: {
//                which_half: 0,
//                minute: 65,
//                match_id: req.body.data.match_id,
//                event_id: 6,
//                event_name: req.body.data.event_name,
//            }
//        }
//
//        Wildcards.RewardFor(newevent);
//
//        return res.send(newevent);
//    });
//
//    app.post('/api/v1/removeEvent', function (req, res) {
//        /**
//         * When removing an event:
//         * 1. Delete the event for the game_events table
//         * 2. For each game_data card with a linked_event the deleted event:
//         *      a. set card to activated 0
//         *      b. remove points on card from math_leaderboard entry
//         *      c. remove points from user_data entry 
//         * 3. Validate cards again to set correct timers and points
//         */
//        log("Remove Event Request");
//        var Event = JSON.parse(req.body.data);
//        // // log(data.event);
//        var data = {};
//        // // Used in removing event and finding linked cards
//        data.eventid = Event.data.id;
//        // // Used in correcting match leaderboards
//        data.matchid = Event.data.match_id;
//
//        // log(JSON.stringify(data));
//
//        needle
//            .post(databaseURL + RemoveEventPHP, data, options, function (error, response) {
//                if (!error && response.statusCode == 200) {
//                    log("Removal succesful - Proceeding to Validation", 'info');
//                    setTimeout(function () {
//                        return thisWildcard.Validate(res, data);
//                    }, 2000);
//                } else
//                    return res.send(error, 'error');
//            });
//
//
//    });
//
//}

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
