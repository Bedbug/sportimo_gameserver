// Module dependencies.
var express = require('express'),
router = express.Router(),
leaderboard = require('../apiObjects/leaderboard'),
l=require('../config/lib');

var api = {};

/**
 * Returns a leaderboard based on suplied conditions
 */
api.leaderboard = function (req, res) {
    
    /* The conditions for the leaderboard
     * (match_id, starts, ends, contry_id) */
	var conditions = req.body;
    var skip = req.body.skip;
    var limit = req.body.limit;
    
	leaderboard.getLeaderboard(conditions, skip, limit, function(err,data){
		if (err) {
			res.status(404).json(err);
		} else {
			res.status(200).json(data);
		}
	}); 
};

api.leaderboardWithRank = function (req, res) {
    
    /* The conditions for the leaderboard
     * (match_id, starts, ends, contry_id) */

    var skip = req.body.skip;
    var limit = req.body.limit;
    
	leaderboard.getLeaderboardWithRank(req, skip, limit, function(err,data){
		if (err) {
			res.status(404).json(err);
		} else {
			res.status(200).json(data);
		}
	}); 
};

router.post('/v1/leaderboards', api.leaderboard);

router.post('/v1/leaderboards/:uid', api.leaderboardWithRank);

module.exports = router;