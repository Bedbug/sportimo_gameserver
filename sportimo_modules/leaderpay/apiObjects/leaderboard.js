// Module dependencies.
var mongoose = require('mongoose'),
    Score = mongoose.models.scores,
    api = {},
    _ = require('lodash');



/*
========= [ CORE METHODS ] =========
*/

// ALL
api.getLeaderboard = function (conditions, skip, limit, cb) {

    var leader_conditions = parseConditons(conditions);

    var q = Score.aggregate({
        $match: leader_conditions
    });

    q.group({
        _id: "$user_id",
        score: { $sum: "$score" },
        name: { $first: '$user_name' },
        pic: { $first: '$pic' },
        country: { $first: '$country' }
    });


    if (skip != undefined)
        q.skip(skip * 1);

    if (limit != undefined)
        q.limit(limit * 1);

    q.sort({ score: -1 });

    return q.exec(function (err, leaderboard) {
        cbf(cb, err, leaderboard);
    });
};

api.getLeaderboardWithRank = function (req, skip, limit, cb) {

    var leader_conditions = parseConditons(req.body);
    var uid = req.params.uid;

    var q = Score.aggregate({
        $match: leader_conditions
    });

    q.group({
        _id: "$user_id",
        score: { $sum: "$score" },
        name: { $first: '$user_name' },
        pic: { $first: '$pic' },
        country: { $first: '$country' }
    });


    if (skip != undefined)
        q.skip(skip * 1);

    if (limit != undefined)
        q.limit(limit * 1);

    q.sort({ score: -1 });

    var rank;
    var user;
    q.exec(function (err, leaderboard) {

        user = _.find(leaderboard, { _id: uid });
        rank = _.size(_.filter(leaderboard, function (o) {
            if (o._id != user._id && o.score > user.score)
                return true;
            else
                return false;
        }));
        user.rank = rank + 1;
        return cbf(cb, err, { user: user, leaderboad: leaderboard });
    })


};


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


/*
========= [ UTILITY METHODS ] =========
*/

/** Callback Helper
 * @param  {Function} - Callback Function
 * @param  {Object} - The Error Object
 * @param  {Object} - Data Object
 * @return {Function} - Callback
 */

var cbf = function (cb, err, data) {
    if (cb && typeof (cb) == 'function') {
        if (err) cb(err);
        else cb(false, data);
    }
};



module.exports = api;
