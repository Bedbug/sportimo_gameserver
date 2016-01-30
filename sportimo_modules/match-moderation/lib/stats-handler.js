var _ = require('lodash'),
    StatMods = require('../models/stats-mod'),
    moment = require('moment');

/**
 * Stats Analyzer - is a layered service in between the incomming call from the moderation service
 * and the game manager service. It handles the actual repsonses to the events like scoring, stats
 * gathering, etc
 * 
 * Soccer stast acronyms:
 * yc:	yellow card
 * rc:	red card
 * cr:	corner
 * ofs:	offside
 * fc:	fouls commited
 * g:	goal
 * 
 */

var CurrentMatch;
var Log;
var match_id;
var team_id;
var player_id;

// Array that holds register stat modifications in case there is a need to make corrections
// at an uknown later time
var linked_stat_mods = [];

// Parsers based on sports
var parsers = {
    e: {},
    soccer: {
        Add: function (event, match, log) {
            linked_stat_mods = [];
            CurrentMatch = match;
            StatsMethods.toObject(event);
            Log = log;

            var evtData = event.data;

            // Filter based on different sport based event types
            switch (evtData.type) {
                default:
                    // Update Match stats (ids, stats to update, names if there are any)
                    StatsMethods.UpsertStat([parsers.e.match_id, parsers.e.team_id, parsers.e.player_id], evtData.stats, ["match", parsers.e.team_name, parsers.e.player_name]);
                    break;
            }

            return linked_stat_mods;

        },
        Update: function (event, match, log) {
            linked_stat_mods = [];
            CurrentMatch = match;
            StatsMethods.toObject(event);
            Log = log;

            var newEvent = event.data;
            var previousEvent = _.find(match.timeline[newEvent.state].events, {
                id: newEvent.id,
                match_id: newEvent.match_id
            });

            this.Delete({
                data: previousEvent
            }, match, log);
            this.Add(event, match, log);

        },
        Delete: function (event, match, log) {
            linked_stat_mods = [];
            CurrentMatch = match;
            StatsMethods.toObject(event);
            Log = log;

            var evtData = event.data;
            
 
            // Filter based on different sport based event types
            switch (evtData.type) {
                default:
                    // Update Match stats (ids, stats to update, names if there are any)
                    StatsMethods.DowndelStat([parsers.e.match_id, parsers.e.team_id, parsers.e.player_id], evtData.stats, ["match", parsers.e.team_name, parsers.e.player_name]);
                    break;
            }

        },
    },
    basket: {},
    tennis: {},

}


var StatsMethods = {
    toObject: function (event) {
        parsers.e.data = event.data;
        parsers.e.match_id = event.data.match_id;
        parsers.e.team_id = CurrentMatch[event.data.team]._id.toString();
        parsers.e.team_name = event.data.team;
        parsers.e.player_id = event.data.players[0].id;
        parsers.e.player_name = event.data.players[0].name;

    },
    UpsertStat: function (ids, stats, names) {

        var idscount = 0;
        // For each id that needs updating
        _.forEach(ids, function (id) {


            //First check if stat id exists
            var statIndex = _.findIndex(CurrentMatch.stats, {
                id: id
            });

            var changedStat = {};
            var newStatMod;

            if (statIndex > -1) {
                // if it does, update stat keys
                changedStat = StatsMethods.InsertStatIfEmpty(CurrentMatch.stats[statIndex], stats);

                if (changedStat.key != "events_sent") {
                    // Creating and saving the modification on the stat
                    newStatMod = new StatMods({
                        match_id: CurrentMatch._id,
                        stat_for: id,
                        stat: changedStat.key,
                        by: 1,
                        was: changedStat.was,
                        segment: CurrentMatch.state,
                        created: moment.utc()
                    });
                    linked_stat_mods.push(newStatMod._id);
                    // console.log(newStatMod);
                    newStatMod.save(function (err) {
                        if (err)
                            console.log("error: " + err);
                        else {
                            // console.log("pushed: " + newStatMod._id);

                        }
                    });
                }

                if (names[idscount] != null)
                    StatsMethods.InsertStatIfEmpty(CurrentMatch.stats[statIndex], {
                        name: names[idscount]
                    });
            } else {
                // if it doesn't, create first and then update stat keys
                CurrentMatch.stats.push({
                    id: id
                });

                // Creating and saving the modification on the stat
                changedStat = StatsMethods.InsertStatIfEmpty(_.last(CurrentMatch.stats), stats);
                if (changedStat.key != "events_sent") {
                    newStatMod = new StatMods({
                        match_id: CurrentMatch._id,
                        stat_for: id,
                        stat: changedStat.key,
                        by: 1,
                        was: changedStat.was,
                        segment: CurrentMatch.state,
                        created: moment.utc()
                    });

                    linked_stat_mods.push(newStatMod._id);

                    newStatMod.save(function (err) {
                        if (err)
                            console.log("error: " + err);
                        else {

                            // console.log("pushed: " + newStatMod._id);

                        }
                    });


                }

                if (names[idscount] != null)
                    StatsMethods.InsertStatIfEmpty(_.last(CurrentMatch.stats), {
                        name: names[idscount]
                    });
            }



            idscount++;
        });

    },
    DowndelStat: function (ids, stats) {
        // For each id that needs updating
        _.forEach(ids, function (id) {

            //First check if stat id exists
            var statIndex = _.findIndex(CurrentMatch.stats, {
                id: id
            });

            if (statIndex > -1) {
                // if it does, update stat keys
                StatsMethods.DecreaseStat(CurrentMatch.stats[statIndex], stats);
            }
        });

    },
    InsertStatIfEmpty: function (statkey, statsToChange) {

        var stats = Object.keys(statsToChange);
        var statChanged = {
            key: "",
            was: 0
        };

        _.forEach(stats, function (stat) {
            if (_.has(statkey, stat)) {
                if (_.isString(statsToChange[stat])) {
                    statkey[stat] = statsToChange[stat];
                }
                else {
                    statChanged.key = stat;
                    statChanged.was = statkey[stat];
                    statkey[stat] += statsToChange[stat];
                }
            } else {
                statChanged.key = stat;
                statkey[stat] = statsToChange[stat];
            }
        });

        return statChanged;

    },
    DecreaseStat: function (statkey, statsToChange) {

        var stats = Object.keys(statsToChange);

        _.forEach(stats, function (stat) {
            if (_.has(statkey, stat)) {
                statkey[stat] -= statsToChange[stat];
                if (statkey[stat] < 0) statkey[stat] = 0;
            }
        });

    }
}

var StatsAnalyzer = {
    Parse: function (event, match, log) {
        return parsers[match.sport][event.type](event, match, log);
    },
    UpsertStat: function (id, stat, stats) {
        if (stats) CurrentMatch = stats;
        StatsMethods.UpsertStat([id], stat, [null]);
    }
}


module.exports = StatsAnalyzer;



// log("[Stats Analyzer] "+ match.sport,"info");
// 			switch(event.type){

// 			}