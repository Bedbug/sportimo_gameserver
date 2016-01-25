/***********************************************************
 * Wildcard Controller
 *
 * @description :: Server-side logic for a wildcard
 * 
 ***********************************************************/
var moment = require('moment');
var WildcardModel = require('../models/wildcard');

var WildCard = function (CardObject) {
  
    // Instance
    var self = this;
    
    // Initialization
    this.init = function (inMilliseconds) {
        
        // Set card defaults according to dbModel data
        
        setTimeout(function () {
            self.activate()
        }, inMilliseconds | this.defaults.delay_timer);
        
        // Save initial state to database.
        self.save();
    };
    
    
    // Activate the card.
    // If activated is false, checks will ignore this card when an event is received
    this.activate = function () {
        this.model.status = 1;
        this.model.activated = moment.utc();
        this.startDestroyTimmer = setInterval(function () {
            self.countDownCard()
        }, 1000);
        
        // Save activated state to database
        this.save();
    }
    
    // // Default settings
    this.defaults = {

        // Settings
        shouldUpdate: true,

        // properties
        max_cards_pertype: 2,

        // Max card points (min/max)
        card_points: [[60, 120], [30, 60], [40, 80], [20, 40]],

        // timers
        delay_timer: 20000, // 20 seconds
        destroy_timer: 300000, // 5 minutes
        points_step: 10000 // every 10"
    };
    
    
    // Store the mongoose model
    this.model = new WildcardModel({
        userid: CardObject.userid,
        gameid: CardObject.gameid,
        minute: CardObject.minute,
        segment: CardObject.segment,
        duration: CardObject.duration,
        timer: CardObject.timer,
        appear_conditions: CardObject.appear_conditions,
        win_conditions: {
            match: CardObject.win_conditions.match,
            stats: CardObject.win_conditions.stats
        },
        points: 0,
        minpoints: CardObject.minpoints,
        maxpoints: CardObject.maxpoints,
        created: moment.utc(),
        activated: null,
        ended: null,
        status: 0,
        linked_event: 0
    })
   
    this.id = this.model._id.toString();

//    this.pointIncrement = (this.defaults.card_points[cardtype][1] - this.defaults.card_points[cardtype][0]) / (this.defaults.destroy_timer / this.defaults.points_step);
//
//
//
//
//
    this.countDownCard = function () {
//        this.defaults.destroy_timer = this.defaults.destroy_timer - 1000;
//        // console.log(this.defaults.destroy_timer)  ;
//        // console.log(this.defaults.points_step);
//        // console.log(this.defaults.destroy_timer % this.defaults.points_step);
//
//        // Update the card every points_step
//        if (this.defaults.destroy_timer % this.defaults.points_step == 0) {
//
//            // Assign the change in points
//            this.attributes.countpoints = this.attributes.countpoints - this.pointIncrement;
//
//            // Make sure that points don't became negative by mistake
//            if (this.attributes.countpoints < 0) this.attributes.countpoints = 0;
//
//            this.attributes.points = Math.round(this.attributes.countpoints + this.attributes.minpoints);
//            // Sync the timer that is used in the client for compatibility
//            this.attributes.timer = this.defaults.destroy_timer / 1000;
//
//            if (this.defaults.destroy_timer <= 0) {
//                log("[Card " + this.attributes.userid + "_" + this.attributes.cardid + "] [Card Timer Finished]", "info");
//                this.attributes.activated = 2;
//            }
//
//            // We will have to update the database here to keep the card in sync 
//            this.save();
//
//        }
//
//        if (this.defaults.destroy_timer <= 0) {
//            // first remove the card from the Played Cards arra
//            Wildcards.Remove(this);
//            // then clear the interval
//            clearInterval(this.startDestroyTimmer);
//
//            // Time's Up - remove the card from play
//            this.clear();
//        }
    }

    this.save = function () {
      self.model.save();
    }
//
//    this.win = function (event_id, delay) {
//        var windelay = delay || 0;
//        self.attributes.correct = 1;
//        self.attributes.activated = 2;
//        self.attributes.linked_event = event_id;
//        var options = {};
//
//        if (self.defaults.shouldUpdate) {
//            setTimeout(function () {
//                needle
//                    .post(databaseURL + AwardPointsPHP, self.attributes, options, function (error, response) {
//                        if (!error && response.statusCode == 200) {
//                            log("[Win response] " + response.body, "info");
//                        } else
//                            log("[error] " + error, "error");
//                    });
//            }, windelay)
//
//        }
//    }
//
    this.delete = function(){
        this.model.remove();
        this.clear();
    }
    
    this.clear = function () {
        // then clear the interval
        clearInterval(this.startDestroyTimmer);
        // first remove the card from the Played Cards array
//        Wildcards.Remove(this);
    }
//    // Initialize the wildcard
//    // this.init();

};

module.exports = WildCard;
