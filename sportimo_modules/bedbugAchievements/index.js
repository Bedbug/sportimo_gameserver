var mongoose = require('mongoose'),
    _ = require('lodash');



Handler = {Reward:{}};

/**
 * Achievement: persist_gamer
 * This achievement rewards players when they are active
 * at th end of the game.
 */
Handler.Reward.persist_gamer = function (matchid, callback) {
    mongoose.models.useractivities.find({ room: matchid, isPresent: true })
        .exec(function (err, users) {
            _.each(users, function (user) {
                mongoose.models.users.addAchievementPoint(user.user, { uniqueid: 'persist_gamer', value: 1 }, function (err, result) {
                    if (err)
                        console.log(err);
                })
            })
            if(callback)
            callback("Done");
        });
}

module.exports = Handler;