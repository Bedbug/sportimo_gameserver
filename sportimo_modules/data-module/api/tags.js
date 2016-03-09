// Module dependencies.
var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    player = mongoose.models.player,
    team = mongoose.models.team,
    match = mongoose.models.scheduled_matches,
    api = {},
    tags = [];

// ALL
api.tags = function(req, res) {
    var skip = null, limit = null;
    tags = [];

    if (req.query.skip != undefined)
        skip = req.query.skip;

    if (req.query.limit != undefined)
        limit = req.query.limit;

    var q = player.find();
    q.select('name pic');
    q.exec(function(err, players) {
        players.forEach(function(player) {
            player = player.toObject();
            player.type = "Player";
            tags.push(player);
        });

        var t = team.find();
        t.select('name logo');
        t.exec(function(err, teams) {
            teams.forEach(function(team) {
                team = team.toObject();
                team.type = "Team";
                tags.push(team);
            });

            var m = match.find();
            m.select('home_team away_team')
            m.populate('home_team').populate('away_team');

            m.exec(function(err, matches) {
                matches.forEach(function(match) {
                    if (match.home_team) {
                        var matchTag = {};
                        matchTag['name.en'] = match.home_team.name.en + " - " + match.away_team.name.en;
                        matchTag._id = match._id;
                        matchTag.type = "Event";
                        tags.push(matchTag);
                    }
                });
                return res.send(tags);
            });

        });

    });

};
/*
=====================  ROUTES  =====================
*/

router.route('/v1/data/tags')
    .get(api.tags);


module.exports = router;
