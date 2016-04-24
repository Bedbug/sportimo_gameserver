// userWildcard is a wildcard definition after it has been played by a user, hence it is a wildcard instance in play.

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    moment = require('moment');

if (mongoose.models.userWildcards)
    module.exports = mongoose.models.userWildcards;
else {
    var userWildcard = new mongoose.Schema({
        userid: String,
        pointsAwarded: Number,
        matchid: String,
        text: Schema.Types.Mixed,
        // Trigger specifications
        minute: Number,
        segment: Number,
        activationLatency: Number,
        duration: Number,
        appearConditions: [Schema.Types.Mixed],
        winConditions: [Schema.Types.Mixed],
        pointStep: Number,
        minPoints: Number,
        maxPoints: Number,
        // States and state times
        creationTime: Date,
        activationTime: Date,
        terminationTime: Date,
        wonTime: Date,
        status: 0,  // 0: pending activation, 1: active, 2: terminated (dead)
        linkedDefinitionId: String, // the id of the referenced wildcard definition (if any)
        linkedEvent: 0
    });
    
    
    userWildcard.pre('save', function(next){
        let now = moment.utc();
    
        if (this.status == 0)   // auto-set times only if this is a new instance
        {
            if (!this.creationTime)
                this.creationTime = now;
            if (!this.activationTime)
                this.activationTime = now.add(this.activates_in, 's'); // add activates_in seconds
            if (!this.terminationTime)
                this.terminationTime = this.activationTime.add(this.duration, 's');
        }
      
        next();
    });
    
    module.exports = mongoose.model("userWildcards", userWildcard);
}