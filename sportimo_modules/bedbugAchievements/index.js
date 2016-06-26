var mongoose = require('mongoose'),
    _ = require('lodash'),
    async = require('async');

var MessagingTools = require.main.require('./sportimo_modules/messaging-tools');

Handler = { Reward: {} };

/**
 * Achievement: persist_gamer
 * This achievement rewards players when they are active
 * at the end of the game.
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
            if (callback)
                callback("Done");
        });
}


/**
 * Achievement: rank_achievements
 * This method rewards players for their rank position
 */
Handler.Reward.rank_achievements = function (matchid, outerCallback) {

    async.waterfall([
        // First we must find all leaderboards for the matchid
        function (callback) {
            var p = mongoose.models.pool.find({ gameid: matchid });
            p.exec(callback);
        },
        // Get all leaderboards from match pools, assign arrays with player positions
        function (pools, callback) {
            var top1s = [];
            var top10s = [];
            var top100s = [];
            var loosers = [];

            if (!pools[0]) {
                pools[0] = { game_id: matchid };
            }

            var poolsCount = pools.length;
            _.each(pools, function (pool) {
                var q = mongoose.models.scores.aggregate({
                    $match: parseConditons(pool)
                });

                q.sort({ score: -1 });
                var usersCount = 0;
                q.exec(function (err, leaderboard) {
                    _.each(leaderboard, function (user) {
                        if (usersCount == 0 && user.score > 0)
                            top1s.push(user.user_id.toString());
                        if (usersCount > 0 && usersCount < 11 && user.score > 0)
                            top10s.push(user.user_id.toString());
                        if (usersCount > 10 && usersCount < 101 && user.score > 0)
                            top100s.push(user.user_id.toString());
                        if (usersCount > 100 && user.score > 0)
                            loosers.push(user.user_id.toString());

                        usersCount++;
                    })

                    poolsCount--;

                    if (poolsCount == 0)
                        callback(null, top1s, top10s, top100s, loosers);
                })
            });
        },
        function (top1s, top10s, top100s, loosers, callback) {
            _.each(top1s, function (user) {
                mongoose.models.users.addAchievementPoint(user, { uniqueid: 'mike_drop', value: 1 }, function (err, result) {
                    if (err)
                        console.log(err);
                })
            });
            
            if (top1s.length > 0)
                MessagingTools.sendPushToUsers(top1s, MessagingTools.preMessages.top1, null, "all");


            _.each(top10s, function (user) {
                mongoose.models.users.addAchievementPoint(user, { uniqueid: 'top_10', value: 1 }, function (err, result) {
                    if (err)
                        console.log(err);

                })
            });
            if (top10s.length > 0)
                MessagingTools.sendPushToUsers(top10s, MessagingTools.preMessages.top10, null, "all");
            _.each(top100s, function (user) {
                mongoose.models.users.addAchievementPoint(user, { uniqueid: 'top_100', value: 1 }, function (err, result) {
                    if (err)
                        console.log(err);

                })
            });
            if (top100s.length > 0)
                MessagingTools.sendPushToUsers(top100s, MessagingTools.preMessages.top100, null, "all");
            _.each(loosers, function (user) {
                mongoose.models.users.addAchievementPoint(user, { uniqueid: 'loosers_reward', value: 1 }, function (err, result) {
                    if (err)
                        console.log(err);
                })
            });

            callback(null, 'Done')

        }],
        function (err, result) {
            if (outerCallback)
                outerCallback(err, result);
        })

}


module.exports = Handler;


function parseConditons(conditions) {

    // Conditions is not a Pool Room
    if (conditions.conditions) {
        var conditions = conditions.conditions;
        if (conditions.created) {
            if (conditions.created.$gt)
                conditions.created.$gt = new Date(conditions.created.$gt);
            if (conditions.created.$gte)
                conditions.created.$gte = new Date(conditions.created.$gte);
            if (conditions.created.$lte)
                conditions.created.$lte = new Date(conditions.created.$lte);
            if (conditions.created.$lt)
                conditions.created.$lt = new Date(conditions.created.$lt);
        }
        return conditions;
    }

    var parsed_conditions = {};

    if (conditions.gameid)
        parsed_conditions.game_id = conditions.gameid;
    else {
        parsed_conditions.created = {};
        if (conditions.starts)
            parsed_conditions.created.$gte = new Date(conditions.starts);
        if (conditions.ends)
            parsed_conditions.created.$lte = new Date(conditions.ends);
    }
    if (conditions.country.length > 0 && conditions.country[0] != "All")
        parsed_conditions.country = { "$in": conditions.country };

    return parsed_conditions;

}