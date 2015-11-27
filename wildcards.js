/**
 * Wildacard Module
 * Created by MasterBug on 19/10/15.
 */

var redis = require('redis');
var needle = require('needle');
var moment = require('moment');
var _ = require('underscore');
var bodyParser = require('body-parser');

// Caterpillar (logging stuff)
// var level   = process.argv.indexOf('-d') === -1 ? 6 : 7;
// var logger  = require('caterpillar').createLogger({level:level});
// var filter  = require('caterpillar-filter').createFilter();
// var human   = require('caterpillar-human').createHuman();
    
// // Pipe to filter to human to stdout
// logger.pipe(filter).pipe(human).pipe(process.stdout);
 
// // Set logging level
// level = 7

// // If we are debugging, then write the original logger data to debug.log
// if ( level === 7 ) {
//     logger.pipe(require('fs').createWriteStream('./debug.log'));
// }

// winston logger
var winston = require('winston');
var logger = new (winston.Logger)({
  levels: {
    trace: 9,
    input: 8,
    verbose: 7,
    prompt: 6,
    debug: 5,
    info: 4,
    core: 3,
    help: 2,
    warn: 1,
    error: 0
  },
  colors: {
    trace: 'magenta',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    debug: 'blue',
    info: 'green',
    core: 'grey',
    help: 'cyan',
    warn: 'yellow',
    error: 'red'
  }
});

// console.log("log_level: "+process.env.LOG_LEVEL);

logger.add(winston.transports.Console, {timestamp: true,level: process.env.LOG_LEVEL || 'debug', prettyPrint: true,colorize: 'level'});

logger.add(winston.transports.File, {
  prettyPrint: true,
  level: 'core',
  silent: false,
  colorize: false,
  timestamp: true,
  filename: 'debug.log',
  maxsize: 40000,
  maxFiles: 10,
  json: false
});
 // End Winston
  
 var databaseURL = "";
 
 if(process.env.NODE_ENV == "production") 
    databaseURL = process.env.PRODUCTION_DB || "http://162.13.157.7/soccerapp/client/";
 else
    databaseURL = process.env.DEVELOPMENT_DB || "http://162.13.157.7/beta_dashboard/client/";
    
console.log("DASHBOARD: "+ databaseURL);


var InsertCardPHP = "_playCard.php";
var UpdatePHP = "_updateCardStatus.php";
var AwardPointsPHP = "_reward.php";

var GetOpenCardsPHP = "get_active_cards.php";
var GetOpenCardsByLinkedEventPHP = "get_active_linked_cards.php";
var GetlastEventsPHP = "get_last_events.php";
var RemoveEventPHP = "remove_event.php";

function log(text,level) {
    var loglevel = level || 'core';
    logger.log(loglevel, "[Wildcards Module] " + text);
}


// Card Types: 0 - Goal, 1 - Corner, 2 - Yellow, 3 - Foul

var WildCard = function (cardid, userid, gameid, minute, cardtype, which_half, questionid) {

    log("[Card Registered] [userid: " + userid + " | matchid: " + gameid + " | minute: " + minute + "' | cardtype: " + TypeCard(cardtype) + " | which_half: " + which_half + " | questionid: " + questionid + "]","info");
    
    // Instance
    var self = this;

    // // Default settings
    this.defaults = {
        
        // Settings
        shouldUpdate: true,
        
        // properties
        max_cards_pertype: 2,

        // Max card points (min/max)
        card_points: [[60, 120], [30, 60], [40, 80], [20, 40]],

        // timers
        delay_timer: 20000,     // 20 seconds
        destroy_timer: 300000,  // 5 minutes
        points_step: 10000      // every 10"
    };

    this.attributes = {
        cardid: cardid,
        userid: userid,
        gameid: gameid,
        minute: minute,
        cardtype: cardtype,
        timer: this.defaults.destroy_timer / 1000,
        which_half: which_half,
        questionid: questionid,
        countpoints: this.defaults.card_points[cardtype][1] - this.defaults.card_points[cardtype][0], // Assign card points based on card type;
        minpoints: this.defaults.card_points[cardtype][0],
        points: this.defaults.card_points[cardtype][1],
        correct: 0,
        activated: 0,
        linked_event: 0,
        saved: false
    };

    this.pointIncrement = (this.defaults.card_points[cardtype][1] - this.defaults.card_points[cardtype][0]) / (this.defaults.destroy_timer / this.defaults.points_step);

    this.init = function (inMilliseconds) {
        setTimeout(function () { self.activate() }, inMilliseconds | this.defaults.delay_timer);
    };

    // Activate the card.
    // If activated is false, checks will ignore this card when an event is received
    this.activate = function () {
        this.attributes.activated = 1;
        log("[Card " + this.attributes.userid + "_" + this.attributes.cardid + "] [Activated]");
        this.save();
        this.startDestroyTimmer = setInterval(function () { self.countDownCard() }, 1000);
    }

    this.countDownCard = function () {
        this.defaults.destroy_timer = this.defaults.destroy_timer - 1000;
        // console.log(this.defaults.destroy_timer)  ;
        // console.log(this.defaults.points_step);
        // console.log(this.defaults.destroy_timer % this.defaults.points_step);
        
        // Update the card every points_step
        if (this.defaults.destroy_timer % this.defaults.points_step == 0) {

            // Assign the change in points
            this.attributes.countpoints = this.attributes.countpoints - this.pointIncrement;

            // Make sure that points don't became negative by mistake
            if (this.attributes.countpoints < 0) this.attributes.countpoints = 0;

            this.attributes.points = Math.round(this.attributes.countpoints + this.attributes.minpoints);     
            // Sync the timer that is used in the client for compatibility
            this.attributes.timer = this.defaults.destroy_timer / 1000;

            if (this.defaults.destroy_timer <= 0) {
                log("[Card " + this.attributes.userid + "_" + this.attributes.cardid + "] [Card Timer Finished]");
                this.activated = 2;
            }
             
            // We will have to update the database here to keep the card in sync 
            this.save();

        }

        if (this.defaults.destroy_timer <= 0) {
            // first remove the card from the Played Cards arra
            Wildcards.Remove(this);
            // then clear the interval
            clearInterval(this.startDestroyTimmer);
            
            // Time's Up - remove the card from play
            this.clear();
        }
    }

    this.save = function () {
        var options = {};
         
        //  console.log(self.attributes.saved+" "+this.defaults.shouldUpdate);
        // Now lets update the database entries
        if (this.attributes.saved && this.defaults.shouldUpdate) { // Update
            needle
                .post(databaseURL + UpdatePHP, this.attributes, options, function (error, response) {
                    if (!error && response.statusCode == 200) {
                        // log("[Card updated in DB] " + response.body);
                    } else
                        log(error,"error");
                });
        }
        else if (this.defaults.shouldUpdate) // save card for the first time
        {
            // console.log(databaseURL + InsertCardPHP);
            needle
                .post(databaseURL + InsertCardPHP, this.attributes, { json: false, parse: false }, function (error, response) {
                    if (!error && response.statusCode == 200) {
                        self.attributes.saved = true;
                        log("[Card saved in DB]");
                    } else
                        console.log(error.message);
                });

        }
    }

    this.win = function (event_id, delay) {
        var windelay = delay || 0; 
        self.attributes.correct = 1;
        self.attributes.activated = 2;
        self.attributes.linked_event = event_id;
        var options = {};

        if (self.defaults.shouldUpdate){
            setTimeout(function(){
                needle
                .post(databaseURL + AwardPointsPHP, self.attributes, options, function (error, response) {
                    if (!error && response.statusCode == 200) {
                        log("[Win response] " + response.body,"info");
                    } else
                        log("[error] "+error,"error");
                });
            }, windelay)
            
        }
    }

    this.clear = function () {
        // then clear the interval
        clearInterval(this.startDestroyTimmer);
        // first remove the card from the Played Cards array
        Wildcards.Remove(this);
    }
    // Initialize the wildcard
    // this.init();

};

// WildCard.prototype.defaults = {
//     // Settings
//     shouldUpdate: true,
        
//     // properties
//     max_cards_pertype: 2,

//     // Max card points (min/max)
//     card_points: [[60, 120], [30, 60], [40, 80], [20, 40]],

//     // timers
//     delay_timer: 20000,     // 20 seconds
//     destroy_timer: 300000,  // 5 minutes
//     points_step: 10000      // every 10"
// }

/*  ********************************************************
**  Wilcards Class
**  
**  Info: This class handles all the cards functionality.
**  It registers cards in its internal array and picks 
**  winners whenever it is called to respond to the 
**  method RewardFor.        
**  *******************************************************/

var PlayedCards = [];
var WonCards = [];

var Wildcards = {
    inPlay: PlayedCards,
    count: function () {
        return PlayedCards.length
    },
    Add: function (cardid, userid, gameid, minute, cardtype, which_half, questionid) {
        var newWildcard = new WildCard(cardid, userid, gameid, minute, cardtype, which_half, questionid);
        PlayedCards.push(newWildcard);
        newWildcard.save();
        newWildcard.init();
        return newWildcard;
    },
    Remove: function (card) {
        PlayedCards = _.without(PlayedCards, card);
    },
    RewardFor: function (event) {
        var event_typeid = TypeID(event.data.event_name);

        log("[Event received] Checking for cards of event_typeid: " + event_typeid + " | " + event.data.event_name,"info");
        // log(event.data.id);

        var WinningCards = _.filter(PlayedCards, function (item) {
            return (item.attributes.cardtype == event_typeid && item.attributes.gameid == event.data.match_id && item.attributes.activated == 1);
        });
        log("[Result] Winning cards: " + WinningCards.length,"info");
        var wincardsdelay = WinningCards.length;
        WinningCards.forEach(function (card) {
            card.win(event.data.id, wincardsdelay*100);
            card.save();
            WonCards.push(card);
            card.clear();
            
            wincardsdelay--;
            // console.log(WonCards.length);

        });
    },
    GetPoints: function (cardid, userid, gameid, cardtype) {
        // Delay by 2 secs so WonCards are able to catch up to the request.
        setTimeout(function(){
        var match = _.filter(WonCards, function (card) {
            return (card.attributes.cardtype == cardtype && card.attributes.userid == userid && card.attributes.gameid == gameid && card.attributes.cardid == cardid);
        });
        
        log(JSON.stringify(match),"debug");

        for (var i = 0; i < WonCards.length; i++) {
            if (WonCards[i].attributes.cardtype == cardtype && WonCards[i].attributes.userid == userid && WonCards[i].attributes.gameid == gameid && WonCards[i].attributes.cardid == cardid) {
                WonCards.splice(i, 1);
                break;
            }
        }

        return match[match.length - 1].attributes.points;
        },2000);
    },
    setDBScriptsURL: function (uri) {
        databaseURL = uri;
    },
    setRedisPubSub: function (RedisIP, RedisPort, RedisAuth) {
        // Initialize and connect to the Redis datastore
        var redisclient = redis.createClient(RedisPort, RedisIP);


        redisclient.auth(RedisAuth, function (err) {
            if (err) { throw err; }
        });

        redisclient.on("error", function (err) {
            log("{''Error'': ''" + err + "''}");
        });

        redisclient.on("subscribe", function (channel, count) {
             log("Subscribed to Sportimo Events PUB/SUB channel");
        });

        redisclient.on("unsubscribe", function (channel, count) {
            log("Subscribed from Sportimo Events PUB/SUB channel");
        });

        redisclient.on("end", function () {
            log("{Connection ended}");
        });

        redisclient.subscribe("socketServers");

        redisclient.on("message", function (channel, message) {
            if (message == "ping")
                return;

            var obj = JSON.parse(JSON.parse(message).data);

            if (obj.event == "new_game_event")
                Wildcards.RewardFor(obj);
        });
    },
    Validate: function (res, data) {

        needle
            .post(databaseURL + GetOpenCardsByLinkedEventPHP, data, options, function (error, response) {
                if (!error && response.statusCode == 200) {
                    log("Result: "+response.body,'debug');
                    playedActiveCards = JSON.parse(response.body);
                    needle
                        .post(databaseURL + GetlastEventsPHP, this.attributes, options, function (error, response) {
                            if (!error && response.statusCode == 200) {
                                lastGameEvents = JSON.parse(response.body);
                                ValidateCards();
                                return res.sendStatus(200);
                            } else {
                                log(error);
                                return res.send(error);
                            }
                        });
                } else
                    log(error,'error');
            });
    },
    setServerForRoutes: function (app) {
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));

        var thisWildcard = this;

        app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            next();
        });
        
        /*
        **    API endpoint /insertcard
        */
        app.post('/api/v1/insertcard', function (req, res) {
            var card = Wildcards.Add(req.body.cardid, req.body.userid, req.body.gameid, req.body.minute, req.body.cardtype, req.body.which_half, req.body.questionid);
            return res.send(JSON.stringify(card));
        });
        
        /*
        **    API endpoint /getpoints
        */
        app.post('/api/v1/getpoints', function (req, res) {
            // log(JSON.stringify(req.body));
            var card = Wildcards.GetPoints(req.body.cardid, req.body.userid, req.body.gameid, req.body.cardtype);
            return res.send(card.toString());
        });

        app.post('/api/v1/event', function (req, res) {
            var newevent = {
                event: 'new_game_event',
                data:
                {
                    which_half: 0,
                    minute: 65,
                    match_id: req.body.data.match_id,
                    event_id: 6,
                    event_name: req.body.data.event_name,
                }
            }

            Wildcards.RewardFor(newevent);

            return res.send(newevent);
        });

        app.post('/api/v1/removeEvent', function (req, res) {
            /**
             * When removing an event:
             * 1. Delete the event for the game_events table
             * 2. For each game_data card with a linked_event the deleted event:
             *      a. set card to activated 0
             *      b. remove points on card from math_leaderboard entry
             *      c. remove points from user_data entry 
             * 3. Validate cards again to set correct timers and points
             */
            log("Remove Event Request");
            var Event = JSON.parse(req.body.data);
            // // log(data.event);
            var data = {};
            // // Used in removing event and finding linked cards
            data.eventid = Event.data.id;
            // // Used in correcting match leaderboards
            data.matchid = Event.data.match_id;

            // log(JSON.stringify(data));

            needle
                .post(databaseURL + RemoveEventPHP, data, options, function (error, response) {
                    if (!error && response.statusCode == 200) {
                        log("Removal succesful - Proceeding to Validation",'info');
                        setTimeout(function () { return thisWildcard.Validate(res, data); }, 2000);
                    } else
                        return res.send(error,'error');
                });


        });

    }

};


    


/**
 * TODO: I have to implement a method where when the server starts it should receive
 * played crads that their timers are not finished, events on matches and cross 
 * reference them.
 * Steps:
 * 1.   From each open card get corresponding event. 
 * 2.   Check if there is an event in the cards range. If not, 
 * 3.   check if cards range has passed. If it has,
 * 4.   mark card failed. 
 * 5.   If not, calculate remaining time from timestamps and push
 *      it to the Played cards array    
 */

log("Start initial card validations");

var playedActiveCards = [];
var lastGameEvents = [];
var options = {};



needle
    .post(databaseURL + GetOpenCardsPHP, this.attributes, options, function (error, response) {
        if (!error && response.statusCode == 200) {
            // log(response.body);
            playedActiveCards = JSON.parse(response.body);
            log("Unhandled Active cards: "+playedActiveCards.length,'debug');
            needle
                .post(databaseURL + GetlastEventsPHP, this.attributes, options, function (error, response) {
                    if (!error && response.statusCode == 200) {
                        // log(response);
                        lastGameEvents = JSON.parse(response.body);
                        // log(lastGameEvents.length,'debug');
                        ValidateCards();
                    } else
                        log(error,'error');
                });
        } else
            log(error,'error');
    });



function ValidateCards() {
     log("Cards Validation Request");
    var indx = 0;

    playedActiveCards.forEach(function (card) {
        indx++;
        
        var timeout = setTimeout(function(){
            validate(); 
            
            }, indx * 200);
            
            // function check(){
            //     log("in:"+indx);
            // }
            
            function validate() {
            
            // log("Creating card");
            var newWildcard = new WildCard(card.cardid, card.userid, card.gameid, card.minute, card.cardtype, card.which_half, card.questionid);
            newWildcard.attributes.saved = true;
        
            // Get event
            var cardEvent = TypeCard(card.cardtype);
        
            // Get Card's range
            var cardRange = {
                starts: moment.utc(card.created).add(20, 's'),
                ends: moment.utc(card.created).add(newWildcard.defaults.destroy_timer).add(20, 's')
            }
         
            // First check if it is not active
            if (card.activated == 0) {
                log("Card has not activate yet in DB",'debug');
                var diff = moment.utc().diff(moment(card.created));
                if (diff < newWildcard.defaults.delay_timer) {
                    log("Corrected: card will be active in: " + ((newWildcard.defaults.delay_timer - diff) / 1000));
                    // We found a card wich is not active but not enough time has passed to activate it. We init it and set the correct activation timer
                    newWildcard.init(newWildcard.defaults.delay_timer - diff);
                    PlayedCards.push(newWildcard);
                    // We do't need to do anything else
                    return;
                }
                log("Result: But it should.",'debug');
            }
 
            // We must check if the card was won something in its time range.
            // Loop through all the latest events and see if there is a corresponding event in the time range
            log("Looping through game evets",'debug');
            var matchEvents = _.where(lastGameEvents, { match_id: card.gameid });
            matchEvents.forEach(function (event) {

                if (newWildcard.attributes.activated == 2) return;

                if (event.event_description == cardEvent && (moment.utc(event.created) > cardRange.starts && moment.utc(event.created) < cardRange.ends)) {
                    log("Result: We found an event in the card's time range","debug");
                    log(JSON.stringify(event),"debug"); 
                    // So, the card has finished
                    newWildcard.attributes.activated = 2;
                    
                    // Set the correct timer 
                    var millisecondsPassed = Math.round(moment.utc(event.created).diff(cardRange.starts) / 1000) * 1000;

                    // log("ms: " + millisecondsPassed);
                    newWildcard.defaults.destroy_timer = 300000 - millisecondsPassed;

                    // log("The new timer: " + newWildcard.defaults.destroy_timer);
                    // Count Points
                    newWildcard.attributes.countpoints -= Math.floor(millisecondsPassed / newWildcard.defaults.points_step) * newWildcard.pointIncrement;
                    newWildcard.attributes.points = Math.round(newWildcard.attributes.countpoints + newWildcard.attributes.minpoints);
                    // log(newWildcard.attributes.points);
                
                    // Sync the timer that is used in the client for compatibility
                    newWildcard.attributes.timer = newWildcard.defaults.destroy_timer / 1000;
                    
                    // And now win it
                    newWildcard.win(event.id);
                    newWildcard.save();

                }
            });
        
            // We don't need to preceed further is the card has won already
            if (newWildcard.attributes.activated == 2) return;

            log("Result: No event found","warn");
        
            // Now we check to see if the card has finished without winning anything
            log("Check if the card has finished","warn");

            if (moment.utc() > cardRange.ends) {
                newWildcard.attributes.activated = 2;
                newWildcard.attributes.points = 0;
                newWildcard.attributes.timer = 0;
                newWildcard.save();
                // No need to clear(). Card was not pushed in anything and timers have not started
                log("Result: It has finished.","warn");
                return;
            }
         
            // Now let's finish it. If we've reached this point, it means that card has not won but it has time left on the timer.
            // Lets calculate how much that is and send it on its way.
            log("Set data for active card","warn"); 
            // has been activated but not finished
            newWildcard.attributes.activated = 1;
          
            // Set the correct timer 
            var millisecondsPassed = Math.round(moment.utc().diff(cardRange.starts) / 1000) * 1000;
            log(moment.utc().format() + " | " + cardRange.starts.format(),"warn");
            // log("ms: " + millisecondsPassed);
            newWildcard.defaults.destroy_timer = 300000 - millisecondsPassed;
            // log("The new timer: " + newWildcard.defaults.destroy_timer);
            // Sync the timer that is used in the client for compatibility
            newWildcard.attributes.timer = newWildcard.defaults.destroy_timer / 1000;
            // Count Points
            newWildcard.attributes.countpoints -= Math.floor(millisecondsPassed / newWildcard.defaults.points_step) * newWildcard.pointIncrement;
            newWildcard.attributes.points = Math.round(newWildcard.attributes.countpoints + newWildcard.attributes.minpoints);
            PlayedCards.push(newWildcard);
            newWildcard.activate();
            
        }
    })
}

/*  ************************
**    Helper Methods
**  ************************/
var TypeID = function (event) {
    if (event == "Goal") return 0;
    if (event == "Corner") return 1;
    if (event == "Yellow card") return 2;
    if (event == "Foul") return 3;
}

var TypeCard = function (event) {
    if (event == 0) return "Goal";
    if (event == 1) return "Corner";
    if (event == 2) return "Yellow card";
    if (event == 3) return "Foul";
}

/*  *****************
**   EXPORTS
**  *****************/

module.exports = Wildcards;