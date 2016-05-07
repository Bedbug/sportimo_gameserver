// userWildcard is a wildcard definition after it has been played by a user, hence it is a wildcard instance in play.

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    moment = require('moment');

if (mongoose.models.userGamecards)
    module.exports = mongoose.models.userGamecards;
else {
    
    var condition = new mongoose.Schema({
       text: Schema.Types.Mixed,
       stat: String,
       target: Number,
       remaining: Number,
       team: String,
       startPoints: Number,
       endPoints: Number,
       pointsPerMinute: Number,
       conditionNegation: { type: Boolean, default: false }
    });
    
    var userGamecard = new mongoose.Schema({
        userid: String,
        gamecardDefinitionId: {
            type: String,
            ref: 'gamecardDefinitions'
        },
        optionId: String, // valid only if the definition includdes options.
        pointsAwarded: Number,
        matchid: String,
        text: Schema.Types.Mixed,
        // Trigger specifications
        minute: Number,
        segment: Number,
        activationLatency: Number,
        duration: Number,
        appearConditions: [condition],
        winConditions: [condition],
        terminationConditions: [condition],
        pointsPerMinute: Number,
        startPoints: Number,
        endPoints: Number,
        // States and state times
        cardType: { type: String, enum: ['Instant', 'Overall']},
        maxUserInstances: Number,   // maximum number of times a user may play this card
        //remainingUserInstances: Number,
        creationTime: Date,
        activationTime: Date,
        terminationTime: Date,
        wonTime: Date,
        status: 0,  // 0: pending activation, 1: active, 2: terminated (dead)
    });
    
    
    userGamecard.pre('save', function(next){
        let now = moment.utc();
    
        if (this.status == 0)   // auto-set times only if this is a new instance
        {
            if (!this.creationTime)
                this.creationTime = now.toDate();
            if (!this.activationTime && !this.activationLatency)
                this.activationTime = now.add(this.activationLatency, 'ms').toDate(); // add activates_in seconds
            if (!this.terminationTime && !this.duration)
                this.terminationTime = now.add(this.activationLatency, 'ms').add(this.duration, 'ms').toDate();
        }
      
        next();
    });
    
    module.exports = mongoose.model("userGamecards", userGamecard);
}