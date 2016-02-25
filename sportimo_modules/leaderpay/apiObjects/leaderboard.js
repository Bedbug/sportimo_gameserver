// Module dependencies.
var mongoose = require('mongoose'),
    Score = mongoose.models.Score,
    api = {},
    l = require('../config/lib');



/*
========= [ CORE METHODS ] =========
*/

// ALL
api.getLeaderboard = function (conditions, skip, limit, cb) {


    var q = Score.aggregate({
        $match: conditions
    });
    
     
    q.group({
        _id: "$user_id",
        score: {$sum: "$score"},
        name : { $first: '$user_name' },
        pic: { $first: '$user_pic'}
    });
    
        

    
    if (skip != undefined)
        q.skip(skip * 1);

    if (limit != undefined)
        q.limit(limit * 1);
    
    q.sort({score: -1});

    return q.exec(function (err, leaderboard) {
        cbf(cb, err, leaderboard);
    });
};



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
