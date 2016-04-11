'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


if (mongoose.models.messages)
    module.exports = mongoose.models.messages;
else {
    var fields = {
        sender:{
            type:String,
            ref:'users'
        },
        recipients:[{
            type:String,
            ref:'users'
        }],
        img: { type: String },
        title: { type: String },
        msg: {type:String},
        read: {type:Number},
        created: { type: Date, default: Date.now }
    };
    
    var schema = new Schema(fields);
    
    module.exports = mongoose.model('messages', schema);
}
