'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    l = require('../config/lib');

var fields = {
    user_id: {
        type: String
    },
    user_pic: {
        type: String
    },
    user_name: {
        type: String
    },
    match_id: {
        type: String
    },
    score: {
        type: Number
    },
    country_id: {
        type: String
    },
    created: {
        type: Date,
        default: Date.now
    }
};

var scoreSchema = new Schema(fields);

module.exports = mongoose.model('Score', scoreSchema);
