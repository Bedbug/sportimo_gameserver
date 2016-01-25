'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;


var event_schema = new mongoose.Schema({

    match_id: ObjectId,
    creared: Date

});

module.exports = mongoose.model("event", event_schema);
