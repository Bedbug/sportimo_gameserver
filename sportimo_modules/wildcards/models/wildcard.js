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


var wildcard = new mongoose.Schema({
    userid: String,
    gameid: String,
    minute: Number,
    segment: Number,
    duration: Number,
    timer: Number,
    appear_conditions: [Schema.Types.Mixed],
    win_conditions: Schema.Types.Mixed,
    points: Number,
    minpoints: Number,
    maxpoints: Number,
    created: Date,
    activated: Date,
    ended: Date,
    status: 0,
    linked_event: 0
});

module.exports = mongoose.model("wildcard", wildcard);
