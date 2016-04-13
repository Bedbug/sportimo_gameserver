/**
 * Wildcard Model
 *
 * @description :: Mongoose model schema for a wildcard
 * 
 */

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    moment = require('moment');

if (mongoose.models.wildcard)
    module.exports = mongoose.models.wildcard;
else {
    var wildcard = new mongoose.Schema({
        userid: String,
        matchid: String,
        text: String,
        // Trigger specifications
        minute: Number,
        segment: Number,
        activates_in: Number,
        duration: Number,
        appear_conditions: [Schema.Types.Mixed],
        win_conditions: Schema.Types.Mixed,
        // Awarded points specs
        points: Number,
        points_step: Number,
        minpoints: Number,
        maxpoints: Number,
        // States and state times
        creationTime: Date,
        activationTime: Date,
        terminationTime: Date,
        wonTime: Date,
        status: 0,  // 0: pending activation, 1: active, 2: terminated (dead)
        linked_event: 0
    });
    
    
    wildcard.pre('save', function(next){
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
    
    module.exports = mongoose.model("wildcards", wildcard);
}