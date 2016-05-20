'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;


var answer = new Schema({
    text: { type: Schema.Types.Mixed },
    img: String,
    answered: {type:Number,default:0},
    voters: [{
            type:String,
            ref:'users'
        }]
})

var fields = {
    text: { type: Schema.Types.Mixed },
    answers: [answer],
    matchid: String,
    type: {type: String},
    img: { type: String },
    status: Number,
    sponsor: { type: Schema.Types.Mixed },
    created: { type: Date, default: Date.now }
};



var schema = new Schema(fields);

module.exports = mongoose.model('polls', schema);
