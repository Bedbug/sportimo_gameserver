'use strict';
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;


var fields = {
    user: {
        type: String,
        ref: 'users'
    },
    matchesVisited: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    cardsPlayed: { type: Number, default: 0 },
    cardsWon: { type: Number, default: 0 },
    prizesWon: { type: Number, default: 0 }
};
var schema = new Schema(
    fields,
    {
        timestamps: { updatedAt: 'lastActive' }
    });

// Assign a method to create and increment stats
schema.statics.UpsertStat = function (uid, statChange, cb) {
    return mongoose.model('userstats').findOneAndUpdate({ user: uid }, { $inc: statChange }, { upsert: true }, cb);
}


module.exports = mongoose.model('userstats', schema);
