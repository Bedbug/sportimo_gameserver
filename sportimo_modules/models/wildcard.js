// wildcard is a definition that the moderator (manual or automatic) creates, to be played by users. It is not related with wildcards in play, this is handled by the userWildcard model.

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    moment = require('moment');

if (mongoose.models.wildcardDefinitions)
    module.exports = mongoose.models.wildcardDefinitions;
else {
    var wildcardDefinition = new mongoose.Schema({
        matchid: String,
        text: Schema.Types.Mixed,
        // Trigger specifications
        minute: Number,
        segment: Number,
        activationLatency: Number,
        duration: Number,
        appearConditions: [Schema.Types.Mixed],
        winConditions: [Schema.Types.Mixed],
        terminationConditions: [Schema.Types.Mixed],
        // Awarded points specs
        points: Number,
        pointStep: Number,
        minPoints: Number,
        maxPoints: Number,
        // States and state times
        maxUserInstances: Number,   // maximum number of times a user may play this card
        creationTime: Date,
        activationTime: Date,
        terminationTime: Date,
        status: 0,  // 0: pending activation, 1: active, 2: terminated (dead)
    });
    
    
    wildcardDefinition.pre('save', function(next){
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
    
    module.exports = mongoose.model("wildcardDefinitions", wildcardDefinition);
}