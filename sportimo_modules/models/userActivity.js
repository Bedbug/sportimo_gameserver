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
  matchesPlayed: Number,
  cardsPlayed: Number,
  cardsWon: Number,
  lastActive: Date,
  isPresent: Boolean
};

var schema = new Schema(fields,
  {
    timestamps: { updatedAt: 'lastActive' }
  });

schema.index({ lastActive: -1 });
schema.index({ uid: 1, room: 1 });

// Assign a method to create and increment stats
schema.statics.IncrementStat = function (uid, room, stat, byvalue, cb) {
  var statIncr = {};
  statIncr[stat] = byvalue;
  return mongoose.model('useractivities').findOneAndUpdate({ user: uid, room: room }, { $inc: statIncr }, { upsert: true }, function () {

    var statsPath = {};
    statsPath['stats.' + stat] = byvalue;

    return mongoose.model('users').findByIdAndUpdate(uid, { $inc: statsPath }, { upsert: true }, function (err, result) {
      if (err)
        console.log(err);
      else
        if (cb)
          return cb(err, result);
    });

  });
}

schema.statics.SetMatchPlayed = function (uid, room, cb) {

  mongoose.model('useractivities').findOneAndUpdate({ user: uid, room: room }, { $set: { matchesPlayed: 1 } }, { upsert: true }, function (err, result) {
    if (err)
      console.log(err);
    // console.log("SET MATCHES PLAYED:");
    // console.log("------------------------------------------");
    // console.log(result.matchesPlayed);
    if (!result.matchesPlayed) {
      return mongoose.model('users').findByIdAndUpdate(uid, { $inc: { 'stats.matchesPlayed': 1 } }, { upsert: true }, function (err, result) {
        if (err)
          console.log(err);
        else
          if (cb)
            return cb(err, result);
      });
    }
  });
}

module.exports = mongoose.model('useractivities', schema);


