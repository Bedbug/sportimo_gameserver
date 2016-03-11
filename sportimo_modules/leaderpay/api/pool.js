// Module dependencies.
var express = require('express'),
router = express.Router(),
mongoose = require('mongoose'),
Pool = mongoose.models.pool,
l=require('../config/lib');

var api = {};

/**
 * Returns a pool based on suplied condtions
 */
api.pool = function (req, res) {
 
};

/**
 * Returns all pools for a specific game
 */
api.poolbygameid = function (req, res) {
    
	var q = Pool.find({gameid:req.params.id});
    
    q.exec(function(err, pools){
        if(err) res.satus(500).send(err);
            else
        res.status(200).send(pools);
    })
};

/**
 * Returns all pools for a specific game
 */
api.timedpools = function (req, res) {
    
	var q = Pool.find({gameid:{ "$exists" : false }});
    
    q.exec(function(err, pools){
        if(err) res.satus(500).send(err);
            else
        res.status(200).send(pools);
    })
};



// POST
api.addPool = function(req, res) {

    if (req.body == 'undefined') {
        return res.status(500).json('No Pool Provided. Please provide valid Pool data.');
    }

    var newItem = new Pool(req.body);

    return newItem.save(function(err, data) {
        if (!err) {
            return res.status(200).json(data);
        } else {
            return res.status(500).json(err);
        }
    });

};


router.post('/v1/pools', api.addPool);

// A pool atatched to a gameid is basicaly attached to the leaderboard
// of that specific game. It will start and finish during this game's 
// period and wiiners will be evaluated automaticaly.
router.get('/v1/pools/forgame/:id', api.poolbygameid);

// Timed pools are pools not tied up to a specific game but to a certain
// time-span. They can repeat in specific intervals or they can last an
// exact period of time. 
router.get('/v1/pools/timed', api.timedpools);

module.exports = router;