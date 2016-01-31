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

    // The var holding the interval
    this.CountDownTimmer;

    // The ref to the parent module
    var WildCardsModule;

    // Initialization
    this.init = function (module) {

        // Set the reference to the module
        WildCardsModule = module;

        // Set card defaults according to dbModel data
        setTimeout(function () {
            self.activate();
        }, CardObject.activates_in);

        // Save initial state to database.
        self.save();
    };

    // // Default settings
    this.defaults = {

    };

    // Store the mongoose model
    this.model = new WildcardModel({
        userid: CardObject.userid,
        gameid: CardObject.gameid,
        minute: CardObject.minute,
        segment: CardObject.segment,
        duration: CardObject.duration,
        activates_in: CardObject.activates_in,
        timer: CardObject.timer,
        appear_conditions: CardObject.appear_conditions,
        win_conditions: {
            match: CardObject.win_conditions.match,
            stats: CardObject.win_conditions.stats
        },
        points: CardObject.maxpoints,
        points_step: (CardObject.maxpoints - CardObject.minpoints) / (CardObject.duration / 1000),
        minpoints: CardObject.minpoints,
        maxpoints: CardObject.maxpoints,
        created: moment.utc(),
        activated: null,
        ended: null,
        won: null,
        status: 0,
        linked_event: 0
    });
    
    // Set the Id of the card from the model
    this.id = this.model._id.toString();

    // Activate the card.
    // If model.status == 0, checks will ignore this card when an event is received
    this.activate = function () {
        this.model.status = 1;
        this.model.activated = moment.utc();
        this.CountDownTimmer = setInterval(function () {
            self.countDown()
        }, 1000);

        // Save activated state to database
        this.save();
    }


    this.countDown = function () {

        // Raise timer by 1"
        this.model.timer += 1000;

        console.log(this.model.timer);

        // Decrease points
        this.model.points -= this.model.points_step;

        // Safeguard that points cannot be lower tahn the min points 
        if (this.model.points < this.model.minpoints) this.model.points = this.model.minpoints;

        if (this.model.timer >= this.model.duration) {
           console.log("[Card " + this.id + "] [Card Timer Finished]", "info");
            this.model.status = 2;
            this.model.ended = moment.utc();

            // Clear the interval
            clearInterval(this.CountDownTimmer);

            // Save state
            this.save();

            // Remove the card from the cardsInPlay Array
            WildCardsModule.remove(self);

            // Release object
            delete self;
        } else {
            // Save state
            this.save();
        }


    };

    this.save = function () {
        self.model.save();
    };

    this.win = function () {

    };

    // WARNING: This should not be used.
    // It is for testing purposes ONLY.
    this.delete = function () {
        this.model.remove();
        this.clear();
    };

    this.clear = function () {
        clearInterval(this.CountDownTimmer);
    };

};

module.exports = WildCard;
