/**
 * Wildcard Model
 *
 * @description :: Mongoose model schema for a wildcard
 * 
 */

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

if (mongoose.models.wildcard)
    module.exports = mongoose.models.wildcard;
else {
    var wildcard = new mongoose.Schema({
        userid: String,
        gameid: String,
        text: String,
        minute: Number,
        segment: Number,
        activates_in: Number,
        duration: Number,
        timer: Number,
        appear_conditions: [Schema.Types.Mixed],
        win_conditions: Schema.Types.Mixed,
        points: Number,
        points_step: Number,
        minpoints: Number,
        maxpoints: Number,
        created: Date,
        activated: Date,
        ended: Date,
        won: Date,
        status: 0,
        linked_event: 0
    });
    
    module.exports = mongoose.model("wildcards", wildcard);
}