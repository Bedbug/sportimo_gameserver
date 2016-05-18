'use strict';
var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var fields = {
  user: {
    type: String,
    ref: 'users'
  },
  room: String,
  cardsPlayed: Number,
  cardsWon: Number,
  lastActive: Date,
  isPresent: Boolean
};

var schema = new Schema(fields,
  {
    timestamps: { updatedAt: 'lastActive' }
  });
  
  // Assign a method to create and increment stats
schema.statics.IncrementStat = function (uid, room, statChange, cb) {
    return mongoose.model('useractivities').findOneAndUpdate({ user: uid, room: room }, { $inc: statChange }, { upsert: true }, function(){
       return  mongoose.model('users').findOneAndUpdate({ _id: uid }, { stats: { $inc: statChange} }, { upsert: true }, cb);
    });
}


module.exports = mongoose.model('useractivities', schema);


