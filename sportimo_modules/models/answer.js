'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;


var fields = {
    userid: String,
    questionid: String,
    matchid: String,
    answerid: String,
    created: { type: Date, default: Date.now }
};


var schema = new Schema(fields);

module.exports = mongoose.model('answers', schema);
