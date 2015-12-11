var _ = require('lodash');

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

// Parsers based on sports
var parsers = {
	e: {},
	soccer: {
		Add: function (event, match, log) {
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


		},
		Update: function (event, match, log) {
			CurrentMatch = match;
			StatsMethods.toObject(event);
			Log = log;
			
			var newEvent = event.data;	
			var previousEvent = _.find(match.timeline[newEvent.state], { id: newEvent.id, match_id: newEvent.match_id });
			
			this.Delete({data:previousEvent}, match, log);
			this.Add(event, match, log);
        
		 },
		Delete: function (event, match, log) {
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
			var statIndex = _.findIndex(CurrentMatch.stats, { id: id });

			if (statIndex > -1) {
				// if it does, update stat keys
				StatsMethods.InsertStatIfEmpty(CurrentMatch.stats[statIndex], stats);
				if (names[idscount] != null)
					StatsMethods.InsertStatIfEmpty(CurrentMatch.stats[statIndex], { name: names[idscount] });
			} else {
				// if it doesn't, create first and then update stat keys
				CurrentMatch.stats.push({ id: id });
				StatsMethods.InsertStatIfEmpty(_.last(CurrentMatch.stats), stats);
				if (names[idscount] != null)
					StatsMethods.InsertStatIfEmpty(_.last(CurrentMatch.stats), { name: names[idscount] });
			}

			idscount++;
		});

	},
	DowndelStat: function (ids, stats) {
		// For each id that needs updating
		_.forEach(ids, function (id) {
			
			//First check if stat id exists
			var statIndex = _.findIndex(CurrentMatch.stats, { id: id });

			if (statIndex > -1) {
				// if it does, update stat keys
				StatsMethods.DecreaseStat(CurrentMatch.stats[statIndex], stats);	
			}
		});

	},
	InsertStatIfEmpty: function (statkey, statsToChange) {

		var stats = Object.keys(statsToChange);

		_.forEach(stats, function (stat) {
			if (_.has(statkey, stat)) {
				if (_.isString(statsToChange[stat]))
					statkey[stat] = statsToChange[stat];
				else
					statkey[stat] += statsToChange[stat];
			} else {
				statkey[stat] = statsToChange[stat];
			}
		});

	},
	DecreaseStat: function (statkey, statsToChange) {

		var stats = Object.keys(statsToChange);

		_.forEach(stats, function (stat) {
			if (_.has(statkey, stat)) {
				statkey[stat] -= statsToChange[stat];
				if(statkey[stat]< 0) statkey[stat] = 0;
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