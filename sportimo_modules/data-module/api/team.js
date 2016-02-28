// Module dependencies.
var express = require('express'),
router = express.Router(),
team = require('../apiObjects/team'),
l=require('../config/lib');

var api = {};
// ALL
api.teams = function (req, res) {
	var skip=null,limit=10;

	if(req.query.skip!=undefined)
		skip=req.query.skip;

	if(req.query.limit!=undefined)
		limit=req.query.limit;

	team.getAllTeams(skip,limit,function(err,data){
		if (err) {
			res.status(500).json(err);
		} else {
			res.status(200).json({teams: data});
		}
	}); 
};

// POST
api.addteam = function (req, res) {
	team.addTeam(req.body.team,function	(err,data){
		if(err) res.status(500).json(err);
		else {
			res.status(201).json(data);
		}
	});	
};

// GET
api.team = function (req, res) {
	var id = req.params.id;
	team.getTeam(id,function(err,data){
		if (err) {
			res.status(404).json(err);
		} else {
			res.status(200).json({team: data});
		}
	}); 
};

// PUT
api.editTeam = function (req, res) {
	var id = req.params.id;

	return team.editTeam(id,req.body.team, function (err, data) {
		if (!err) {
			l.p("updated team");
			return res.status(200).json(data);
		} else {
			return res.status(500).json(err);
		}
		return res.status(200).json(data);   
	});

};

// DELETE
api.deleteTeam = function (req, res) {
	var id = req.params.id;
	return team.deleteTeam(id, function (err, data) {
		if (!err) {
			l.p("removed team");
			return res.status(204).send();
		} else {
			l.p(err);
			return res.status(500).json(err);
		}
	});
};

// DELETE All
api.deleteAllTeams = function (req, res) {
	return team.deleteAllTeams( function (err, data) {
		if (!err) {
			l.p("removed All team");
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


router.post('/team',api.addteam);

router.route('/team/:id')
.get(api.team)
.put(api.editTeam)
.delete(api.deleteTeam);


router.route('/teams')
.get(api.teams)
.delete(api.deleteAllTeams);


router.get('/teams/test',function(req,res){
	return team.test(function (err, data) {
		res.status(200).json(data);
	});
});

module.exports = router;
