// Module dependencies.
var express = require('express'),
router = express.Router(),
player = require('../apiObjects/player'),
l=require('../config/lib');

var api = {};
// ALL
api.players = function (req, res) {
	var skip=null,limit=10;

	if(req.query.skip!=undefined)
		skip=req.query.skip;

	if(req.query.limit!=undefined)
		limit=req.query.limit;

	player.getAllPlayers(skip,limit,function(err,data){
		if (err) {
			res.status(500).json(err);
		} else {
			res.status(200).json({players: data});
		}
	}); 
};

// POST
api.addplayer = function (req, res) {
	player.addPlayer(req.body.player,function	(err,data){
		if(err) res.status(500).json(err);
		else {
			res.status(201).json(data);
		}
	});	
};

// GET
api.player = function (req, res) {
	var id = req.params.id;
	player.getPlayer(id,function(err,data){
		if (err) {
			res.status(404).json(err);
		} else {
			res.status(200).json({player: data});
		}
	}); 
};

// PUT
api.editPlayer = function (req, res) {
	var id = req.params.id;

	return player.editPlayer(id,req.body.player, function (err, data) {
		if (!err) {
			l.p("updated player");
			return res.status(200).json(data);
		} else {
			return res.status(500).json(err);
		}
		return res.status(200).json(data);   
	});

};

// DELETE
api.deletePlayer = function (req, res) {
	var id = req.params.id;
	return player.deletePlayer(id, function (err, data) {
		if (!err) {
			l.p("removed player");
			return res.status(204).send();
		} else {
			l.p(err);
			return res.status(500).json(err);
		}
	});
};

// DELETE All
api.deleteAllPlayers = function (req, res) {
	return player.deleteAllPlayers( function (err, data) {
		if (!err) {
			l.p("removed All player");
			return res.status(204).send();
		} else {
			l.p(err);
			return res.status(500).json(err);
		}
	});
};

/*
=====================  ROUTES  =====================
*/


router.post('/player',api.addplayer);

router.route('/player/:id')
.get(api.player)
.put(api.editPlayer)
.delete(api.deletePlayer);


router.route('/players')
.get(api.players)
.delete(api.deleteAllPlayers);


router.get('/players/test',function(req,res){
	return player.test(function (err, data) {
		res.status(200).json(data);
	});
});

module.exports = router;
