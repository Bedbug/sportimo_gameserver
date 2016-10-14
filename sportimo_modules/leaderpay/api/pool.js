// Module dependencies.
var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    Pool = mongoose.models.pool,
    l = require('../config/lib');
_ = require('lodash');

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

    var querry = { gameid: req.params.id, $or: [{ country: { "$size": 0 } }] };

    if (req.params.country)
        querry.$or[1] = { country: req.params.country.toUpperCase() };

    var q = Pool.find(querry);

    q.exec(function (err, pools) {
        if (err) res.satus(500).send(err);
        else {
            // var uniqueArray = _.pluck(pools, 'roomtype');
            // uniqueArray = _.uniq(uniqueArray);

            var uniqueArray = ['Season', 'Week'];

            _.each(uniqueArray, function (type) {
                var poolsWithType = _.filter(pools, { roomtype: type });
                if (_.size(poolsWithType) > 1) {
                    pools = _.remove(pools, function (n) {
                        return !(n.roomtype == type && n.country.length == 0);
                    });
                }
            })

            res.status(200).send(pools);
        }

    })


};

/**
 * Returns all timed pools
 */
api.timedpools = function (req, res) {
    
    // if (!req.params.country)
    //     return res.status(404).send("You didn't leave the user's country code empty on purpose, did you?");

    var querry = { gameid: { "$exists": false } };

    if (req.params.country)
        querry.$or = [{ country: { "$size": 0 } }, { country: req.params.country.toUpperCase() }];

    var q = Pool.find(querry);

    q.exec(function (err, pools) {
        if (err) res.satus(500).send(err);
        else {
            var uniqueArray = ['Season', 'Week'];
            if (req.params.country)
                _.each(uniqueArray, function (type) {
                    var poolsWithType = _.filter(pools, { roomtype: type });
                    if (_.size(poolsWithType) > 1) {
                        pools = _.remove(pools, function (n) {
                            return !(n.roomtype == type && n.country.length == 0);
                        });
                    }
                })

            res.status(200).send(pools);
        }

    })
};



// POST
api.addPool = function (req, res) {

    if (req.body == 'undefined') {
        return res.status(500).json('No Pool Provided. Please provide valid Pool data.');
    }

    var newItem = new Pool(req.body);

    return newItem.save(function (err, data) {
        if (!err) {
            return res.status(200).json(data);
        } else {
            return res.status(500).json(err);
        }
    });

};

// PUT
api.editPool = function (req, res) {

    Pool.findOneAndUpdate({ _id: req.params.id }, req.body, function (err) {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send({ success: true });
        }

    });
};


// PUT
api.deletePool = function (req, res) {
    Pool.findById(req.params.id, function (err, pool) {
        pool.remove(function (err) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.send({ success: true });
            }
        });

    });
};


router.post('/v1/pools', api.addPool);

router.put('/v1/pools/:id', api.editPool);
router.delete('/v1/pools/:id', api.deletePool);

// A pool atatched to a gameid is basicaly attached to the leaderboard
// of that specific game. It will start and finish during this game's 
// period and winners will be evaluated automaticaly.
router.get('/v1/pools/forgame/:id', api.poolbygameid);
router.get('/v1/pools/forgame/:id/:country', api.poolbygameid);

router.get('/v1/pools/for/country/:country', api.timedpools);
router.get('/v1/pools/for/country/', api.timedpools);

// Timed pools are pools not tied up to a specific game but to a certain
// time-span. They can repeat in specific intervals or they can last an
// exact period of time. 
router.get('/v1/pools/timed/', api.timedpools);
router.get('/v1/pools/timed/:country', api.timedpools);

module.exports = router;