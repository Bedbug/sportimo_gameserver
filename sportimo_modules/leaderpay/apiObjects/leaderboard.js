// Module dependencies.
var mongoose = require('mongoose'),
    Score = mongoose.models.scores,
    api = {},
    _ = require('lodash');



/*
========= [ CORE METHODS ] =========
*/

// ALL
api.getLeaderboard = function(conditions, skip, limit, cb) {

    var leader_conditions = parseConditons(conditions);
    console.log(leader_conditions);

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

    return q.exec(function(err, leaderboard) {
        cbf(cb, err, leaderboard);
    });
};

api.getLeaderboardWithRank = function(req, skip, limit, cb) {

    var leader_conditions = parseConditons(req.body);
    var uid = req.params.uid;
    var rank = 1;
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
    
    q.exec (function(err, leaderboard) {
       var user = _.find(leaderboard,{_id:uid});
       var rank = _.size(_.find(leaderboard,function(o){
           return o.score > user.score;
       }));
       
       if(rank)
       user.rank = rank + 1;
       
       return cbf(cb, err,{user:user,leaderboad:leaderboard});
    })
    
   
};


function parseConditons(conditions) {
    var parsed_conditions = {};

    // Conditions is not a Pool Room
    if (conditions.conditions)
        return conditions.conditions;

    if (conditions.gameid)
        parsed_conditions.match_id = conditions.gameid;
    else {
        parsed_conditions.created = {};
        if (conditions.starts)
            parsed_conditions.created.$gte = conditions.starts;
        if (conditions.ends)
            parsed_conditions.created.$lte = conditions.ends;
    }
    if (conditions.country.length>0 && conditions.country[0] != "All" )
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

var cbf = function(cb, err, data) {
    if (cb && typeof (cb) == 'function') {
        if (err) cb(err);
        else cb(false, data);
    }
};



module.exports = api;
