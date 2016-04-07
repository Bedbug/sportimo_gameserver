'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var fields = {
    user_id: {type: String},
    pic: {type: String},
    user_name: {type: String},
    game_id: {type: String},
    score: {type: Number},
    country: {type: String},
    created: {type: Date, default: Date.now}
};

var scoreSchema = new Schema(fields);

module.exports = mongoose.model('scores', scoreSchema);
