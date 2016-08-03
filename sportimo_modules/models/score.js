'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var fields = {
    user_id: { type: String },
    pic: { type: String },
    user_name: { type: String },
    game_id: { type: String },
    score: { type: Number, default: 0 },
    prize_eligible: Boolean,
    country: { type: String },   
    level: { type: Number, default: 0 },
    created: { type: Date, default: Date.now },
    lastActive: Date
};

var scoreSchema = new Schema(fields,
  {
    timestamps: { updatedAt: 'lastActive', createdAt: 'created' }
  });


scoreSchema.index({ lastActive: -1 });
scoreSchema.index({ user_id: 1, game_id: 1 });

scoreSchema.statics.AddPoints = function (uid, room, points, cb) {

    return mongoose.model('scores').findOneAndUpdate({ game_id: room, user_id: uid },
        { $inc: { score: points } },
        { upsert: true },
        function (err, result) {
            if (err)
                console.log(err);

            if (cb)
                return cb(err, result);
        });
}

// Internal method used by sockets subscribe
scoreSchema.statics.AddLeaderboardEntry = function (uid, room) {
    mongoose.model('users').findById(uid, function (err, user) {
        if (user) {
            mongoose.model('scores').findOneAndUpdate({ game_id: room, user_id: uid },
                {
                    user_id: user._id,
                    pic: user.picture,
                    user_name: user.username,
                    game_id: room,
                    country: user.country,
                },
               { upsert: true },
                function (err, result) {
                    if (err)
                        console.log(err);
                });
        }
    });


}

module.exports = mongoose.model('scores', scoreSchema);
