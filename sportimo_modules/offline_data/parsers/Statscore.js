'use strict';


var scheduler = require('node-schedule');
var needle = require("needle");
var crypto = require("crypto-js");
var async = require('async');
var _ = require('lodash');
var mongoose = require('../config/db.js');
var winston = require('winston');
var objectId = mongoose.mongoose.Types.ObjectId;
var moment = require('moment');
//var unidecode = require('unidecode');

// Settings for the development environment
var mongoDb = mongoose.mongoose.models;
//var mongoConn = mongoose.mongoose.connections[0];

var log = new (winston.Logger)({
    levels: {
        prompt: 6,
        debug: 5,
        info: 4,
        core: 3,
        warn: 1,
        error: 0
    },
    colors: {
        prompt: 'grey',
        debug: 'blue',
        info: 'green',
        core: 'magenta',
        warn: 'yellow',
        error: 'red'
    }
});

log.add(winston.transports.Console, {
    timestamp: true,
    level: process.env.LOG_LEVEL || 'debug',
    prettyPrint: true,
    colorize: 'level'
});

// languageMapping maps Sportimo langage locale to Stats.com language Ids. For a list of ISO codes, see https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
var languageMapping = {
    //"ar": "", // arabic not supported yet
    "en": "1", // english
    //"yi": "", // yiddish (hebrew) not supported yet
    "ru": "23", // russian
    "el": "12"
    // Add all required language mappings here from Stats.com
};

var statsComConfigDevelopment = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages: ["en"],
    urlPrefix: "https://api.softnetsport.com/v2/",
    apiKey: "132",  // actually, this is the client_id
    apiSecret: "3iqAJvFlU0Y4bjB7MNkA4tu8tDMNI4QVYkh", 
    parserIdName: "Statscore"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Settings for the production environment
var statsComConfigProduction = {
    // if not supportedLanguages is set in the function parameter, then set it to a default value of 1 language supported: english.
    supportedLanguages: ["en", "ar", "ru"],
    urlPrefix: "https://api.softnetsport.com/v2/",
    apiKey: "132",  // actually, this is the client_id
    apiSecret: "3iqAJvFlU0Y4bjB7MNkA4tu8tDMNI4QVYkh", 
    parserIdName: "Statscore"  // the name inside GameServer data parserId object, that maps to THIS parser's data ids. This is how we map stats.com objects to Sportimo gameServer objects.
};

// Assign the settings for the current environment
//var localConfiguration = statsComConfigDevelopment;
var configuration = statsComConfigDevelopment;

var Parser = function () {
    // Settings properties
    //Parser.name = configuration.parserIdName;

    //update configuration settings with this object settings
    if (this.interval)
        configuration.eventsInterval = this.interval;
    if (this.parsername)
        configuration.parserIdName = this.parsername;

    this.authToken = null;

    // Restrict to Only call this once in the lifetime of this object
    this.init = _.once(function (feedServiceContext) {
    });

};



Parser.Configuration = configuration;
Parser.Name = configuration.parserIdName;
Parser.methodSchedules = {};

// Initialize scheduled tasks on (re)start, but wait 5 secs for the mongo connection to be established first.
/* Temporarily commented out until implemented
setTimeout(function () {
    mongoDb.gameserversettings.findOne().exec(function (error, settings) {
        if (error)
            log.error('Failed to get the game server settings during offline_data Stats parser initialization');
        else {
            if (settings && process.env.NODE_ENV != "development") {                //  != "development"
                if (settings.scheduledTasks) {
                    _.forEach(settings.scheduledTasks, function (updateTeamSchedule) {
                        // if(updateTeamSchedule.competitionId != "56f4800fe4b02f2226646297") return;
                        let competitionId = updateTeamSchedule.competitionId;
                        let season = updateTeamSchedule.season;
                        let pattern = updateTeamSchedule.cronPattern;

                        log.info('Scheduling UpdateCompetitionStats for season %s with the pattern %s', season, pattern);
                        Parser.methodSchedules['UpdateCompetitionStats'] = scheduler.scheduleJob(pattern, function () {
                            log.info('Scheduled job is running for %s : %s : %s', updateTeamSchedule.competitionId, updateTeamSchedule.season, updateTeamSchedule.cronPattern);
                            Parser.UpdateAllCompetitionStats(competitionId, season, function (error, data) {
                                if (error)
                                    log.error(error.message);
                            });
                        });
                    });
                }
            }
        }

    });
}, 5000);

setTimeout(function () {
    setInterval(function () {
        var cutOffTime = moment.utc().subtract(3, 'hours').toDate();
        //mongoDb.scheduled_matches.find({ completed: false, guruStats: null, start: {$gte: cutOffTime} }, function(error, matches) {
        mongoDb.scheduled_matches.find({ completed: false, guruStats: null, guruStatsChecked: { $ne: true } }, '_id home_team away_team competition state time start', function (error, matches) {
            if (error)
                return;

            async.eachSeries(matches, function (match, cb) {
                setTimeout(function () {
                    Parser.UpdateGuruStats(match, function (err) {
                        if (err) {
                            log.error('Failed saving the Guru-stats for match %s, due to: %s', match.id, err.message);
                        }

                        mongoDb.scheduled_matches.findByIdAndUpdate(match._id, { $set: { guruStatsChecked: true } }, function (err, res) {
                            log.info("Updated match so we don't have to test for Guru stats anymore.")
                        })

                        cb(null);
                    });
                }, 500);
            }, function (eachSeriesError) {

            });
        });
    }, 60000);
}, 5000);
*/


// Helper Methods

// Approximate calculation of season Year from current date
Parser.GetSeasonYear = function () {
    const now = new Date();

    if (now.getMonth() > 5)
        return now.getFullYear();
    else return now.getFullYear() - 1;
};


Parser.FindCompetitionByParserid = function (leagueName, callback) {
    var findQuery = { 'parserids.Statscore': leagueName };

    var q = mongoDb.competitions.findOne(findQuery);

    q.exec(function (error, competition) {
        if (error)
            return callback(error);

        if (!competition)
            return callback(new Error('No competition found in database with this Id:' + leagueName));

        return callback(null, competition);
    });
}

// Helper method to retrieve a team based on the parser id
Parser.FindMongoTeamId = function (competitionId, parserid, fieldProjection, callback, teamId) {

    var findConditions = { competitionid: competitionId, "parserids.Statscore": parserid };

    if (teamId)
        findConditions._id = teamId;

    var q = mongoDb.teams.findOne(findConditions);

    if (fieldProjection)
        q.select(fieldProjection);

    q.exec(function (err, team) {
        if (err)
            return callback(err);

        if (!team)
            return callback(new Error('No team found in database with this parserId:' + parserid));

        return callback(null, team);
    });
};

Parser.FindMongoTeamsInCompetition = function (competitionId, callback) {
    mongoDb.teams.find({ competitionid: competitionId, parserids: { $ne: null } }, function (error, teams) {
        if (error)
            return callback(error);
        callback(null, teams);
    });
};

// Statscore.com Endpoint invocation Methods

Parser.Authenticate = function (callback) {

    const url = configuration.urlPrefix + "oauth.xml?client_id=" + configuration.apiKey + "&secret_key=" + configuration.apiSecret;
    needle.get(url, function (error, response) {
        if (error)
            return callback(error);

        if (response.statusCode != 200)
            return callback(new Error('[Statscore]: failed to get the authorization token.'));

        /* parse xml response of the type (example)

            <api ver="2.94" timestamp="1510163874">
	            <method name="oauth" details="https://softnet.atlassian.net/wiki/display/APS/oauth" total_items="" previous_page="" next_page="">
		            <parameter name="client_id" value="132"/>
		            <parameter name="secret_key" value="3iqAJvFlU0Y4bjB7MNkA4tu8tDMNI4QVYkh"/>
	            </method>
	            <data>
		            <oauth client_id="132" token="ee8f93068ed00972542d9a214ae52745" token_expiration="1510250274"/>
	            </data>
            </api>
        */

        // get the oAuth token
        Parser.authToken = response.body.api.data.oauth['$'].token.toString();
        Parser.authTokenExpiration = new Date(response.body.api.data.oauth['$'].token_expiration);
        return callback(null, Parser.authToken);
    });
}

// Get team stats. Always return the season stats.
Parser.UpdateTeamStats = function (leagueName, teamId, season, callback) {

    const url = configuration.urlPrefix

    needle.get(url, { timeout: 50000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode != 200 && response.statusCode != 404)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));

            var teamStats = response.statusCode == 404 ?
                TranslateTeamStats(null) :
                TranslateTeamStats(response.body.apiResults[0].league.teams[0].seasons[0].eventType[0].splits[0].teamStats[0]);

            return mongoDb.teams.findOne({ "parserids.Statscore": teamId }, function (err, team) {
                if (err)
                    return callback(err);

                if (team) {
                    team.stats = teamStats;
                    team.markModified('stats');
                    team.save(function (err, result) {
                        if (err)
                            return callback(err);

                        return callback(null, teamStats);
                    });
                } else
                    return callback(null, teamStats);
            });

        }

        catch (err) {
            return callback(err);
        }
    });
};

// Get team stats. Always return the season stats.
Parser.UpdateTeamStatsFull = function (leagueName, teamId, season, outerCallback, mongoTeamId) {
    if (outerCallback)
        return outerCallback(new Error('[Statscore parser]: Method (UpdateTeamStatsFull) not implemented'));
}
/*
Parser.UpdateTeamStatsFull = function (leagueName, teamId, season, outerCallback, mongoTeamId) {

    season = Parser.GetSeasonYear();

    //soccer/epl/stats/players/345879?enc=true&
    const signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));

    // API Endpoint for season stats
    const stats_url = configuration.urlPrefix + leagueName + "/stats/teams/" + teamId + "?accept=json&season=" + season + "&" + signature;
    // API Endpoint for standing
    const standings_url = configuration.urlPrefix + leagueName + "/standings/teams/" + teamId + "?accept=json&season=" + season + "&" + signature;
    // API Endpoint for schedule
    const schedule_url = configuration.urlPrefix + leagueName + "/scores/teams/" + teamId + "?linescore=true&accept=json&season=" + season + "&" + signature;
    // AP Endpoint for team events
    const events_url = configuration.urlPrefix + leagueName + "/stats/teams/" + teamId + "/events/?accept=json&season=" + season + "&" + signature;
    // API Endpoint for top scorer
    const scorer_url = configuration.urlPrefix + leagueName + "/leaders/?teamId=" + teamId + "&accept=json&" + signature;

    var competitionId = null;

    async.waterfall(
        [
            function (callback) {
                Parser.FindCompetitionByParserid(leagueName, function (error, competition) {
                    if (error)
                        return callback(error);

                    competitionId = competition.id;
                    callback(null);
                });
            },
            function (callback) {
                return Parser.FindMongoTeamId(competitionId, teamId, false, callback, mongoTeamId);
            },

            // First let's update the stats for use in the client gamecard infos
            function (team, callback) {
                // if (team.nextmatch && team.nextmatch.eventdate >= Date.now())
                //     async.setImmediate(function () {
                //         return callback(new Error('Data are current. No need to update them yet.'), team);
                //     });

                needle.get(stats_url, { timeout: 50000 }, function (error, response) {
                    if (error)
                        return callback(error, team);
                    try {
                        // if (response.statusCode == 404)
                        //     return callback(null, team);

                        var teamStats = response.statusCode == 404 ?
                            TranslateTeamStats(null) :
                            TranslateTeamStats(response.body.apiResults[0].league.teams[0].seasons[0].eventType[0].splits[0].teamStats[0]);
                        team.stats = teamStats;

                        callback(null, team);
                    }
                    catch (err) {
                        return callback(err, team);
                    }
                });
            },

            // Secondly let's get the team standing in it's main league
            function (team, callback) {
                setTimeout(function () {
                    needle.get(standings_url, { timeout: 50000 }, function (error, response) {
                        if (error)
                            return callback(error, team);
                        try {
                            // if (response.statusCode == 404)
                            //     return callback(null, team);

                            var teamStanding = response.statusCode == 404 ? null : response.body.apiResults[0].league.season.eventType[0].conferences[0].divisions[0].teams[0];
                            team.standing = {
                                "rank": teamStanding && teamStanding.league ? teamStanding.league.rank : teamStanding && teamStanding.division ? teamStanding.division.rank : -1,
                                "teamName": team.name,
                                "teamId": team._id.toString(),
                                "points": teamStanding ? teamStanding.teamPoints : 0,
                                "pointsPerGame": teamStanding && teamStanding.teamPointsPerGame ? teamStanding.teamPointsPerGame : "0",
                                "penaltyPoints": teamStanding ? teamStanding.penaltyPoints : 0,
                                "wins": teamStanding ? teamStanding.record.wins : 0,
                                "losses": teamStanding ? teamStanding.record.losses : 0,
                                "ties": teamStanding ? teamStanding.record.ties : 0,
                                "gamesPlayed": teamStanding ? teamStanding.record.gamesPlayed : 0,
                                "goalsFor": teamStanding ? teamStanding.goalsFor.overall : 0,
                                "goalsAgainst": teamStanding ? teamStanding.goalsAgainst.overall : 0
                            };

                            callback(null, team);
                        }
                        catch (err) {
                            return callback(err, team);
                        }
                    });
                }, 500);
            },

            // Now let's do the difficult stuff and get the schedule
            function (team, callback) {
                setTimeout(function () {
                    // console.log(schedule_url);
                    needle.get(schedule_url, { timeout: 50000 }, function (error, response) {
                        if (error)
                            return callback(error, team);
                        try {
                            if (response.statusCode == 404) {
                                team.nextmatch = {
                                    "eventdate": moment().utc().add(1, 'd').toDate(),
                                };
                                return callback(null, team);
                            }

                            var itsNow = moment.utc();
                            var nextEvents = _.filter(response.body.apiResults[0].league.season.eventType[0].events, function (match) {
                                return itsNow.isBefore(moment.utc(match.startDate[1].full));
                            });

                            if (nextEvents.length > 0) {
                                var nextMatch = nextEvents[0];

                                team.nextmatch = {
                                    "home": "",
                                    "away": "",
                                    "eventdate": moment.utc(nextMatch.startDate[1].full).toDate(),
                                    "homescore": 0,
                                    "awayscore": 0
                                };

                                Parser.FindMongoTeamId(competitionId, nextMatch.teams[0].teamId, 'name logo', function (err, home_team) {
                                    if (!err)
                                        team.nextmatch.home = home_team ? home_team : { name: { en: nextMatch.teams[0].displayName } };

                                    Parser.FindMongoTeamId(competitionId, nextMatch.teams[1].teamId, 'name logo', function (err, away_team) {
                                        if (!err)
                                            team.nextmatch.away = away_team ? away_team : { name: { en: nextMatch.teams[1].displayName } };

                                        callback(null, team);
                                    });
                                });
                            }
                            else
                                callback(null, team);
                        }
                        catch (err) {
                            return callback(err, team);
                        }
                    });
                }, 500);
            },

            // It's time to go for the last match entry and recent form
            function (team, callback) {
                setTimeout(function () {
                    needle.get(events_url, { timeout: 50000 }, function (error, response) {
                        if (error)
                            return callback(error, team);
                        try {
                            if (response.statusCode != 200)
                                return callback(null, team);

                            var lastFiveEvents = _.takeRight(response.body.apiResults[0].league.teams[0].seasons[0].eventType[0].splits[0].events, 5);
                            var lastEvent = _.takeRight(response.body.apiResults[0].league.teams[0].seasons[0].eventType[0].splits[0].events)[0];

                            team.recentform = _.map(lastFiveEvents, function (o) {
                                return o.outcome.name;
                            });

                            // Now let's retrieve the last match data
                            team.lastmatch = {
                                "home": "",
                                "away": "",
                                "eventdate": moment.utc(lastEvent.startDate[1].full).toDate(),
                                "homescore": 0,
                                "awayscore": 0
                            };

                            Parser.FindMongoTeamId(competitionId, lastEvent.opponentTeam.teamId, 'name logo', function (teamError, opponent_team) {
                                if (teamError)
                                    return callback(teamError, team);

                                if (!opponent_team)
                                    opponent_team = {
                                        _id: "",
                                        name: { en: lastEvent.opponentTeam.displayName }
                                    };

                                if (lastEvent.team.teamLocationType.name == 'away') {
                                    team.lastmatch.away = _.pick(team, ['_id', 'name', 'logo']);
                                    team.lastmatch.awayscore = lastEvent.outcome.teamScore;
                                    team.lastmatch.home = opponent_team;
                                    team.lastmatch.homescore = lastEvent.outcome.opponentTeamScore;
                                } else {

                                    team.lastmatch.home = _.pick(team, ['_id', 'name', 'logo']);
                                    team.lastmatch.homescore = lastEvent.outcome.teamScore;
                                    team.lastmatch.away = opponent_team;
                                    team.lastmatch.awayscore = lastEvent.outcome.opponentTeamScore;
                                }
                                return callback(null, team);
                            });
                        }
                        catch (err) {
                            return callback(err, team);
                        }
                    });
                }, 500);
            },
            // Ok, now let's finish it with a drumroll. Get that awesome top scorer dude!
            function (team, callback) {

                try {
                    var q = mongoDb.players.find({ "teamId": team.id });
                    q.sort({ "stats.season.assistsTotal": -1 });
                    q.limit(1);
                    q.select('name uniformNumber pic stats.season.assistsTotal');
                    q.exec(function (err, players) {
                        if (err)
                            return callback(err, team);

                        if (players.length == 0)
                            return callback(null, team, null);

                        team.topassister = players[0]._id.toString();

                        return callback(null, team, players[0]);
                    });
                }
                catch (err) {
                    return callback(null, team);
                }

            },
            // Ok, now let's finish it with a drumroll. Get that awesome top scorer dude!
            function (team, assistPlayer, callback) {
                try {
                    var q = mongoDb.players.find({ "teamId": team.id });
                    q.sort({ "stats.season.goalsTotal": -1 });
                    q.limit(1);
                    q.select('name uniformNumber pic stats.season.goalsTotal');
                    q.exec(function (err, players) {
                        if (err)
                            return callback(err, team);

                        if (players.length == 0)
                            return callback(null, team, assistPlayer, null);

                        team.topscorer = players[0]._id.toString();

                        return callback(null, team, assistPlayer, players[0]);
                    });
                }
                catch (err) {
                    return callback(null, team, assistPlayer);
                }
            }],

        function (error, team, assistPlayer, player) {
            if (error)
                return outerCallback(error);

            team.save(function (err, result) {
                if (err)
                    return outerCallback(err);

                result = result.toObject();

                if (!player || !player.stats || !player.stats.season || !player.stats.season.goalsTotal)
                    delete result.topscorer;
                else
                    result.topscorer = player;

                if (!assistPlayer || !assistPlayer.stats || !assistPlayer.stats.season || !assistPlayer.stats.season.assistsTotal)
                    delete result.topassister;
                else
                    result.topassister = assistPlayer;
                return outerCallback(null, result);
            });
        }

    );


};
*/

// Get player stats. If season is null, then return the career stats, else the stats for the given season.
Parser.GetPlayerStats = function (leagueName, playerId, season, callback) {
    return callback(new Error('[Statscore parser]: Method (GetPlayerStats) not implemented'));
}
/*
Parser.GetPlayerStats = function (leagueName, playerId, season, callback) {
    let isCareer = false;
    if (!season) {
        isCareer = true;
    }

    //soccer/epl/stats/players/345879?enc=true&
    const signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    const url = configuration.urlPrefix + leagueName + "/stats/players/" + playerId + (isCareer ? "?accept=json&enc=true&careerOnly=true&" : "?accept=json&season=" + season + "&") + signature;

    needle.get(url, { timeout: 50000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode == 404)
                return callback(null, null);
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));

            var playerStats = response.body.apiResults[0].league.players[0].seasons[0].eventType[0].splits[0].playerStats;
            return callback(null, playerStats);
        }
        catch (err) {
            return callback(err);
        }
    });
};
*/

Parser.GetPlayerInTeamStats = function (leagueName, teamId, playerId, callback) {
    return callback(new Error('[Statscore parser]: Method (GetPlayerInTeamStats) not implemented'));
}
/*
Parser.GetPlayerInTeamStats = function (leagueName, teamId, playerId, callback) {
    //soccer/epl/stats/players/345879?enc=true&
    const signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    const url = configuration.urlPrefix + leagueName + "/stats/players/" + playerId + "/teams/" + teamId + "?accept=json&" + signature;

    needle.get(url, { timeout: 50000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode == 404)
                return callback(null, null);
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));

            var playerStats = response.body.apiResults[0].league.players[0].seasons[0].eventType[0].splits[0].playerStats;
            return callback(null, playerStats);
        }
        catch (err) {
            return callback(err);
        }
    });
};
*/



/*
Parser.GetTeamPlayers: Each player in the JSON response is of the type:

        {
          "id": 209433,
          "type": "person",
          "name": "César Azpilicueta Tanco",
          "short_name": "Azpilicueta César",
          "acronym": "CÉS",
          "gender": "male",
          "area_id": 70,
          "area_name": "Spain",
          "area_code": "ESP",
          "sport_id": 5,
          "sport_name": "Soccer",
          "national": "no",
          "website": "",
          "ut": 1457601286,
          "old_participant_id": 57088,
          "slug": "cesar-azpilicueta,209433",
          "logo": "no",
          "virtual": "no",
          "details": {
            "founded": "",
            "phone": "",
            "email": "",
            "address": "",
            "venue_id": "",
            "venue_name": "",
            "weight": 70,
            "height": 178,
            "nickname": "",
            "position_name": "Defender",
            "birthdate": "1989-08-28",
            "born_place": "Pamplona",
            "is_retired": "no",
            "subtype": "athlete"
          }
        }
*/

Parser.GetTeamPlayers = function (competitionId, teamId, languageId, callback) {
    if (!Parser.authToken)
        return callback(new Error('[Statscore]: The parser is not authenticated with valid token.'));

    let url = configuration.urlPrefix + "participants/" + teamId + "/squad?token=" + Parser.authToken + "&sport_id=5&season_id=" + competitionId.seasonid;
    // language parameter 'lang' is not properly supported as it should according to documentation. If included in the url, produces a 400 Bad Request response.
    //if (languageId !== 'undefined' || languageId != null)
    //    url += "&lang=" + languageId;

    needle.get(url, { timeout: 60000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));

            var players = response.body.api.data.participants;
            callback(null, players);
        }
        catch (err) {
            return callback(err);
        }
    });
};


Parser.GetLeagueTeams = function (competitionId, callback) {
    if (!Parser.authToken)
        return callback(new Error('[Statscore]: The parser is not authenticated with valid token.'));

    const url = configuration.urlPrefix + "participants?token=" + Parser.authToken + "&type=team&sport_id=5&season_id=" + competitionId.seasonid;

    needle.get(url, { timeout: 60000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            let teams = response.body.api.data.participants;
            callback(null, teams);
        }
        catch (err) {
            return callback(err);
        }
    });
};



Parser.GetLeagueStandings = function (leagueName, season, callback) {
    return callback(new Error('[Statscore parser]: Method (GetLeagueStandings) not implemented'));
}
/*
Parser.GetLeagueStandings = function (leagueName, season, callback) {
    const signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    const url = configuration.urlPrefix + leagueName + "/standings/?live=false&eventTypeId=1&" + (season ? "season=" + season + "&" : "") + signature;

    needle.get(url, { timeout: 60000 }, function (error, response) {
        if (error) {
            return callback(error);
        }
        if (!response.body.apiResults)
            log.error(response.body.message || response.body);
        try {
            var standings = response.body.apiResults[0].league.season.eventType[0].conferences[0].divisions[0].teams;
            var season = response.body.apiResults[0].league.season.season;
            callback(null, standings, season);
        }
        catch (err) {
            return callback();
        }
    });

};
*/

Parser.GetLeagueSeasonFixtures = function (competitionId, seasonId, callback) {
    // sample call https://api.softnetsport.com/v2/events?token=aaeb65a5c63897f05fd4ed1b217fee71&competition_id=1556&season_id=29860&date_from=2017-12-07+00:00:00

    const date_from = moment.utc(new Date()).startOf('day').format('YYYY-MM-DD+HH:mm:ss');
    const date_to = moment.utc(new Date()).startOf('day').add(30, 'd').format('YYYY-MM-DD+HH:mm:ss');
    const now = new Date();


    return async.waterfall([
        (cbk) => {
            if (!Parser.authToken || !Parser.authTokenExpiration || now > Parser.authTokenExpiration)
                return Parser.Authenticate(cbk);
            else
                return async.setImmediate(() => { return cbk(null); });
        },
        (authToken, cbk) => {
            const url = `${configuration.urlPrefix}events?token=${Parser.authToken}&competition_id=${competitionId}&season_id=${seasonId}&&date_from=${date_from}&date_to=${date_to}&scoutsfeed=yes&status_type=scheduled`;

            needle.get(url, { timeout: 60000 }, function (error, response) {
                if (error)
                    return cbk(error);

                try {
                    if (response.body.api.error)
                        return cbk(new Error(response.body.api.error.message));


                    const fixtures = response.body.api.data.competitions[0].seasons[0].stages[0].groups[0].events;

                    // iterate over next pages
                    return cbk(null, fixtures);
                }
                catch (err) {
                    return cbk(err);
                }
            });
        }
    ], callback);

};


Parser.GetTeamSeasonFixtures = function (leagueName, teamId, seasonYear, callback) {
    return callback(new Error('[Statscore parser]: Method (GetTeamSeasonFixtures) not implemented'));
}
/*
Parser.GetTeamSeasonFixtures = function (leagueName, teamId, seasonYear, callback) {
    const signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    const url = configuration.urlPrefix + leagueName + "/scores/teams/" + teamId + "?" + signature + "&season=" + seasonYear + "&linescore=false";

    needle.get(url, { timeout: 60000 }, function (error, response) {
        if (error)
            return callback(error);

        if (response.body.status != 'OK' || response.body.recordCount == 0)
            return callback(new Error(response.body));

        try {
            let fixtures = [];
            _.forEach(response.body.apiResults[0].league.season.eventType, function (category) {
                fixtures = _.concat(fixtures, category.events);
            });
            callback(null, fixtures);
        }
        catch (err) {
            return callback(err);
        }
    });

};


Parser.GetMatchEvents = function (leagueName, matchId, callback) {
    var signature = "api_key=" + configuration.apiKey + "&sig=" + crypto.SHA256(configuration.apiKey + configuration.apiSecret + Math.floor((new Date().getTime()) / 1000));
    var url = configuration.urlPrefix + leagueName + "/events/" + matchId + "?pbp=true&" + signature; // &box=true for boxing statistics

    needle.get(url, { timeout: 50000 }, function (error, response) {
        if (error)
            return callback(error);
        try {
            if (response.statusCode != 200)
                return callback(new Error("Response code from " + url + " : " + response.statusCode));
            var events = response.body.apiResults[0].league.season.eventType[0].events[0].pbp;
            var teams = response.body.apiResults[0].league.season.eventType[0].events[0].teams;
            var matchStatus = response.body.apiResults[0].league.season.eventType[0].events[0].eventStatus;
            callback(null, events, teams, matchStatus);
        }
        catch (err) {
            console.log(err);
            if (callback)
                return callback(err);
        }
    });
};
*/


// Parser methods that other modules may call:

Parser.UpdateCompetitionTeamsStats = function (competitionId, season, callback) {
    mongoDb.competitions.findById(competitionId, function (competitionError, competition) {
        if (competitionError)
            return callback(competitionError);

        if (!competition.parserids || !competition.parserids[Parser.Name])
            return callback(new Error('No proper parserids found in selected competition with id ' + competitionId));

        Parser.FindMongoTeamsInCompetition(competitionId, function (error, teams) {
            if (error)
                return callback(error);

            async.eachSeries(teams, function (team, cbk) {
                setTimeout(function () {
                    Parser.UpdateTeamStats(competition.parserids[Parser.Name], team.parserids[Parser.Name], season, function (teamError, updateOutcome) {
                        if (teamError)
                            log.error(teamError.message);
                        cbk(null);
                    })
                }, 1000);
            }, function (seriesErr) {
                if (seriesErr)
                    log.error(seriesErr.message);

                callback(null);
            });
        });
    });
};

Parser.GetCompetitionTeamsStatsSchedule = function (competitionId, callback) {
    var schedule = Parser.methodSchedules['UpdateCompetitionStats'];
    return callback(null, schedule);
};


Parser.CreateCompetitionTeamsStatsSchedule = function (competitionId, season, schedulePattern, callback) {
    if (Parser.methodSchedules['UpdateCompetitionStats']) {
        log.info('Deleting existing UpdateCompetitionStats schedule to replace it with a new one');
        Parser.methodSchedules['UpdateCompetitionStats'].cancel();

    }

    log.info('Scheduling UpdateCompetitionStats for season %s with the pattern %s', season, schedulePattern);
    Parser.methodSchedules['UpdateCompetitionStats'] = scheduler.scheduleJob(schedulePattern, function () {
        log.info('Scheduled job is running for %s', Parser.methodSchedules['UpdateCompetitionStats']);
        Parser.UpdateCompetitionTeamsStats(competitionId, season, function (error, data) {
            if (error)
                log.error(error.message);

        });
    });

    let newSetting = {
        competitionId: competitionId,
        season: season,
        cronPattern: schedulePattern
    };

    mongoDb.gameserversettings.findOne({}, function (findError, settings) { //{'scheduledTasks.updateTeamStats.competitionId': competitionId, 'scheduledTasks.updateTeamStats.season': season}, {$pull: {'scheduledTasks.updateTeamStats' : { 'scheduledTasks.updateTeamStats.competitionId': competitionId, 'scheduledTasks.updateTeamStats.season': season} } }, { safe: true }, function(removeError, settings) {
        if (findError)
            return callback(findError);

        if (settings && settings.scheduledTasks)
            // let instanceToBeRemoved = _.find(settings.scheduledTasks.updateTeamStats, { competitionId: competitionId, season: season });
            // if (instanceToBeRemoved)
            _.remove(settings.scheduledTasks, { competitionId: competitionId, season: season });
        if (settings)
            settings.scheduledTasks.push(newSetting);
        if (!settings) {
            settings = new mongoDb.gameserversettings({
                scheduledTasks: []
            });
            settings.scheduledTasks.push(newSetting);
        }
        settings.markModified('scheduledTasks');

        settings.save(function (saveError) {
            if (saveError)
                return callback(saveError);

            callback(null, Parser.methodSchedules['UpdateCompetitionStats']);
        });
    });
};


Parser.DeleteCompetitionTeamsStatsSchedule = function (competitionId, season, schedulePattern, callback) {
    if (Parser.methodSchedules['UpdateCompetitionStats']) {
        log.info('Deleting existing UpdateCompetitionStats schedule');
        Parser.methodSchedules['UpdateCompetitionStats'].cancel();
    }
    callback(null);
};

Parser.UpdateTeams = function (competitionId, callback) {
    return callback(new Error('[Statscore parser]: Method (UpdateTeams) not implemented'));
}

Parser.UpdateTeamAndPlayerMappings = function (competitionId, callback) {
    const StatsName = 'Stats';

    // Start by fetching the specified sportimo competition by id
    mongoDb.competitions.findById(competitionId, function (err, competition) {
        if (err)
            return callback(err);

        const competitionStatscoreId = competition.parserids[Parser.Name];
        const competitionId = competition.id;

        if (!competitionStatscoreId || !competitionId)
            return callback(new Error('No league name or league Id is defined in call'));

        if (!Parser.Configuration.supportedLanguages)
            return callback(new Error('No supported languages are defined in parser&apos;s configuration'));

        if (_.indexOf(Parser.Configuration.supportedLanguages, "en") < 0)
            return callback(new Error('The default english language ("en") is NOT set amongst the supported languages in parser&apos;s configuration.'));


        // Get all teams, and then collect all teamIds and query for the related players
        mongoDb.teams.find({ competitionid: competitionId }, function (teamError, existingTeams) {
            if (teamError)
                return callback(teamError);

            let existingTeamIds = _.map(existingTeams, function (team) { return team.id; });

            let existingTeamsLookup = {};
            let existingTeamNameLookup = {};
            let existingPlayerLookup = {};
            let existingPlayerNameLookup = {};
            let languageData = {};

            _.forEach(existingTeams, function (team) {
                if (team.parserids && team.parserids[Parser.Name] && !existingTeamsLookup[team.parserids[Parser.Name]])
                    existingTeamsLookup[team.parserids[Parser.Name]] = team;
                if (team.name && team.name['en'] && !existingTeamNameLookup[team.name && team.name['en']])
                    existingTeamNameLookup[team.name && team.name['en']] = team;
            });

            mongoDb.players.find({ teamId: { '$in': existingTeamIds } }, function (playerError, existingPlayers) {
                if (playerError)
                    return callback(playerError);


                _.forEach(existingPlayers, function (player) {
                    if (player.parserids[Parser.Name] && !existingPlayerLookup[player.parserids[Parser.Name]])
                        existingPlayerLookup[player.parserids[Parser.Name]] = player;
                    if (player.name && player.name['en'] && !existingPlayerNameLookup[player.name && player.name['en']])
                        existingPlayerNameLookup[player.name && player.name['en']] = player;
                });


                const language = "en";

                //                async.eachSeries(Parser.Configuration.supportedLanguages, function (language, cbk) {
                if (languageMapping[language]) {
                    languageData[language] = {};

                    // Get statscore teams
                    Parser.GetLeagueTeams(competitionStatscoreId, function (teamsErr, teams) {
                        if (teamsErr)
                            return callback(teamsErr);

                        languageData[language].teams = {};
                        _.forEach(teams, function (team) {
                            if (!languageData[language].teams[team.id])
                                languageData[language].teams[team.id] = team;
                        });

                        async.each(teams, function (team, teamCbk) {
                            Parser.GetTeamPlayers(competitionStatscoreId, team.id, languageMapping[language], function (error, players) {
                                if (error)
                                    return teamCbk(error);
                                if (!languageData[language].teams[team.id].players)
                                    languageData[language].teams[team.id].players = {};
                                _.forEach(players, function (player) {
                                    if (!languageData[language].teams[team.id].players[player.id])
                                        languageData[language].teams[team.id].players[player.id] = player;
                                });

                                teamCbk(null);
                            });
                        }, function (teamErr) {
                            if (teamErr)
                                return callback(teamErr);


                            let parsedTeams = {};
                            let parsedPlayers = {};
                            let teamsToAdd = [];
                            let teamsToUpdate = [];
                            let playersToAdd = [];
                            let playersToUpdate = [];
                            //let playersToRemove = [];

                            let creationDate = new Date();

                            // Find mappings



                            // Find the players that exist in existingPlayersLookup but not in languageData["en"].players and add them to playersToUpdate after unlinking them from their team
                            // Similarly find the teams that exist in existingTeamsLookup but not in languageData["en"].players and add them to teamsToUpdate after unlinking them from their competition
                            let teamsMissedFromMapping = [];
                            let playersMissedFromMapping = [];
                            _.forEach(_.keys(languageData["en"].teams), function (teamKey) {
                                const teamId = languageData["en"].teams[teamKey].id;

                                const keyExists = existingTeamsLookup[teamKey];
                                const nameExists = existingTeamNameLookup[_.deburr(languageData["en"].teams[teamKey].name)];
                                let shortNameExists = existingTeamNameLookup[_.deburr(languageData["en"].teams[teamKey].short_name)];

                                let existingTeamFound = keyExists || nameExists || shortNameExists;

                                // This tries to capture differences like 'Everton' and 'Everton F.C.'
                                if (!existingTeamFound) {
                                    shortNameExists = existingTeamNameLookup[_.deburr(_.split(languageData["en"].teams[teamKey].short_name, ' ')[0])];
                                    existingTeamFound = shortNameExists;

                                    if (!existingTeamFound) {
                                        const shortNameWithoutParenthesis = _.trim(languageData["en"].teams[teamKey].short_name.replace(/\([^()]*\)/g, ''));
                                        shortNameExists = existingTeamNameLookup[_.deburr(shortNameWithoutParenthesis)];
                                        existingTeamFound = shortNameExists;

                                        if (!existingTeamFound) {
                                            shortNameExists = existingTeamNameLookup[_.deburr(_.replace(shortNameWithoutParenthesis, ' ', '-'))];
                                            existingTeamFound = shortNameExists;
                                        }
                                    }
                                }

                                if (existingTeamFound) {
                                    existingTeamFound.parserids[Parser.Name] = teamId;
                                    teamsToUpdate.push(existingTeamFound);
                                }
                                else
                                    teamsMissedFromMapping.push(languageData["en"].teams[teamKey]);


                                _.forEach(_.keys(languageData["en"].teams[teamKey].players), function (playerKey) {
                                    const playerId = languageData["en"].teams[teamKey].players[playerKey].id;
                                    const player = languageData["en"].teams[teamKey].players[playerKey];

                                    if (!(player.details && player.details.subtype && player.details.subtype != 'athlete')) {
                                        const keyExists = existingPlayerLookup[playerKey];
                                        const nameExists = existingPlayerNameLookup[languageData["en"].teams[teamKey].players[playerKey].name];

                                        // Statscore short name is last name first, first name latter. We need to inverse this order before lookup
                                        const nameParts = _.split(languageData["en"].teams[teamKey].players[playerKey].short_name, ' ');
                                        let invertedName = nameParts[nameParts.length > 1 ? 1 : 0];
                                        if (nameParts.length > 1)
                                            invertedName += ' ' + nameParts[0]; // add last name, ignore middle names

                                        // Convert inverted name to ascii equivalent with Unidecode package
                                        // alternatively: invertedName = unidecode(invertedName);
                                        invertedName = _.deburr(invertedName);
                                        let shortNameExists = existingPlayerNameLookup[invertedName];

                                        let existingPlayerFound = keyExists || nameExists || shortNameExists;

                                        if (!existingPlayerFound && nameParts.length > 2) {
                                            invertedName = '';
                                            for (let i = 0; i < nameParts.length - 1; i++)
                                                invertedName += ' ' + _.capitalize(nameParts[i + 1]);
                                            invertedName += ' ' + _.capitalize(nameParts[0]);

                                            invertedName = _.trimStart(_.deburr(invertedName));
                                            shortNameExists = existingPlayerNameLookup[invertedName];
                                            existingPlayerFound = shortNameExists;

                                            if (!existingPlayerFound) {
                                                invertedName = _.capitalize(nameParts[2]) + ' ' + _.capitalize(nameParts[0]);
                                                shortNameExists = existingPlayerNameLookup[invertedName];
                                                existingPlayerFound = shortNameExists;
                                            }
                                        }

                                        if (existingPlayerFound) {
                                            existingPlayerFound.parserids[Parser.Name] = playerId;
                                            playersToUpdate.push(existingPlayerFound);
                                        }
                                        else
                                            playersMissedFromMapping.push(languageData["en"].teams[teamKey].players[playerKey]);
                                    }
                                });
                            });

                            // Gathering updating Stats
                            console.log(`${teamsToUpdate.length} teams mapped, ${teamsMissedFromMapping.length} teams missed mapping:`);
                            _.forEach(teamsMissedFromMapping, (team) => { console.log(`id: ${team.id}, name: ${team.name}`); });
                            console.log(`${playersToUpdate.length} players mapped, ${playersMissedFromMapping.length} players missed mapping:`);
                            _.forEach(playersMissedFromMapping, (player) => { console.log(`id: ${player.id}, name: ${player.name}`); });

                            // Update instances parserids for teams
                            if (teamsToUpdate && teamsToUpdate.length > 0) {
                                async.parallel([
                                    (cbk3) => {
                                        async.each(teamsToUpdate, function (teamToUpdate, cbk2) {
                                            return mongoDb.teams.findOneAndUpdate({ _id: new objectId(teamToUpdate.id) }, { $set: { parserids: teamToUpdate.parserids } }, cbk2);
                                        }, cbk3);
                                    },
                                    (cbk3) => {
                                        async.each(playersToUpdate, function (playerToUpdate, cbk2) {
                                            return mongoDb.players.findOneAndUpdate({ _id: new objectId(playerToUpdate.id) }, { $set: { parserids: playerToUpdate.parserids } }, cbk2);
                                        }, cbk3);
                                    }], (parallelErr, parallelResults) => {
                                        if (parallelErr)
                                            return callback(parallelErr);
                                        return callback(null, parallelResults);
                                    });
                            }
                            else
                                callback(null);
                        });
                    });
                }
                //else {
                //    async.setImmediate(function () {
                //        cbk(new Error('language ' + language + ' is not found amongst languageMapping dictionary.'));
                //    });
                //}
                //}, function (error) {
                //if (error && !languageData["en"])
                //    return callback(error);

            });
        });
    });



                    //_.forEach(existingTeams, function (team) {
                    //    if (!updatedTeamsLookup[team.parserids[Parser.Name]]) {
                    //        //team.competitionId = null;
                    //        teamsToUpdate.push(team);
                    //    }
                    //});
                    //_.forEach(_.values(existingPlayerLookup), function (player) {
                    //    if (!updatedPlayersLookup[player.parserids[Parser.Name]]) {
                    //        player.teamId = null;
                    //        playersToUpdate.push(player);
                    //    }
                    //});

                    /*

                    // Scan the english data to get all teams and players
                    _.forEach(_.keys(languageData["en"].teams), function (teamId) {

                        if (player.team && player.team.teamId) {
                            if (!parsedTeams[player.team.teamId]) {
                                // If new team, add to teamsToAdd collection
                                if (!existingTeamsLookup[player.team.teamId]) {
                                    var newTeam = new mongoDb.teams();
                                    //newTeam.name_en = player.team.displayName;
                                    newTeam.name = { "en": player.team.displayName };
                                    newTeam.name["abbr"] = player.team.abbreviation;
                                    newTeam.logo = null;
                                    //newTeam.league = leagueName;
                                    newTeam.created = creationDate;
                                    newTeam.parserids = {};
                                    newTeam.parserids[Parser.Name] = player.team.teamId;
                                    newTeam.competitionid = competitionId;

                                    parsedTeams[player.team.teamId] = newTeam;
                                    newTeam.save();
                                    teamsToAdd.push(newTeam);
                                }
                                else {
                                    var oldTeam = existingTeamsLookup[player.team.teamId];
                                    if (!oldTeam.name)
                                        oldTeam.name = {};
                                    oldTeam.name["en"] = player.team.displayName;
                                    oldTeam.name["abbr"] = player.team.abbreviation;
                                    if (!oldTeam.logo)
                                        oldTeam.logo = null; // leave this property untouched to what it was
                                    if (!oldTeam.parserids)
                                        oldTeam.parserids = {};
                                    oldTeam.parserids[Parser.Name] = player.team.teamId;
                                    oldTeam.competitionid = competitionId;

                                    parsedTeams[player.team.teamId] = oldTeam;
                                    teamsToUpdate.push(oldTeam);
                                }
                            }

                            if (player.playerId && !parsedPlayers[player.playerId]) {
                                // If new player, add to playersToAdd collection
                                if (!existingPlayerLookup[player.playerId]) {
                                    var newPlayer = new mongoDb.players();
                                    if (player.firstName)
                                        newPlayer.firstName = { "en": player.firstName };
                                    if (player.lastName)
                                        newPlayer.lastName = { "en": player.lastName };
                                    newPlayer.name = { "en": (player.firstName ? player.firstName + " " : "") + player.lastName };
                                    newPlayer.uniformNumber = player.uniform;
                                    newPlayer.position = player.positions[0].name;
                                    newPlayer.personalData = {
                                        height: player.height,
                                        weight: player.weight,
                                        birth: player.birth,
                                        nationality: player.nationality
                                    };
                                    newPlayer.parserids = {};
                                    newPlayer.parserids[Parser.Name] = player.playerId;
                                    newPlayer.created = creationDate;

                                    if (parsedTeams[player.team.teamId]._id)
                                        newPlayer.teamId = parsedTeams[player.team.teamId].id;

                                    parsedPlayers[player.playerId] = newPlayer;
                                    playersToAdd.push(newPlayer);
                                }
                                else {
                                    var oldPlayer = existingPlayerLookup[player.playerId];
                                    if (!oldPlayer.firstName)
                                        oldPlayer.firstName = {};
                                    if (player.firstName)
                                        oldPlayer.firstName["en"] = player.firstName;
                                    oldPlayer.lastName_en = player.lastName;
                                    if (!oldPlayer.lastName)
                                        oldPlayer.lastName = {};
                                    if (player.lastName)
                                        oldPlayer.lastName["en"] = player.lastName;
                                    if (!oldPlayer.name)
                                        oldPlayer.name = {};
                                    oldPlayer.name["en"] = (player.firstName ? player.firstName + " " : "") + player.lastName;
                                    oldPlayer.uniformNumber = player.uniform;
                                    oldPlayer.position = player.positions[0].name;
                                    oldPlayer.personalData = {
                                        height: player.height,
                                        weight: player.weight,
                                        birth: player.birth,
                                        nationality: player.nationality
                                    };
                                    if (!oldPlayer.parserids)
                                        oldPlayer.parserids = {};
                                    oldPlayer.parserids[Parser.Name] = player.playerId;

                                    if (parsedTeams[player.team.teamId]._id)
                                        oldPlayer.teamId = parsedTeams[player.team.teamId].id;

                                    parsedPlayers[player.playerId] = oldPlayer;
                                    playersToUpdate.push(oldPlayer);

                                }
                            }
                        }
                    });


                    // Now merge other languages data with english ones, based on their id.
                    _.forEach(languageData, function (value, key, val) {
                        _.forEach(value.players, function (player) {
                            if (parsedTeams[player.team.teamId])
                                parsedTeams[player.team.teamId].name[key] = player.team.displayName;

                            if (parsedPlayers[player.playerId]) {
                                if (player.firstName) {
                                    if (!parsedPlayers[player.playerId].firstName)
                                        parsedPlayers[player.playerId].firstName = {};
                                    parsedPlayers[player.playerId].firstName[key] = player.firstName;
                                }
                                parsedPlayers[player.playerId].lastName[key] = player.lastName;
                                parsedPlayers[player.playerId].name[key] = (player.firstName ? player.firstName + " " : "") + player.lastName;
                            }
                        });
                    });


                    // Try Upserting in mongo all teams and players
                    try {
                        async.parallel([
                            function (innerCallback) {
                                if (teamsToAdd && teamsToAdd.length > 0) {
                                    async.each(teamsToAdd, function (teamToAdd, cbk1) {
                                        return teamToAdd.save(cbk1);
                                    }, innerCallback);
                                }
                                else
                                    innerCallback(null);
                            },
                            function (innerCallback) {
                                if (playersToAdd && playersToAdd.length > 0) {
                                    async.each(playersToAdd, function (playerToAdd, cbk2) {
                                        return playerToAdd.save(cbk2);
                                    }, innerCallback);
                                }
                                else
                                    innerCallback(null);
                            },
                            function (innerCallback) {
                                if (teamsToUpdate && teamsToUpdate.length > 0) {
                                    async.each(teamsToUpdate, function (teamToUpdate, cbk3) {
                                        return teamToUpdate.save(cbk3);
                                    }, innerCallback);
                                }
                                else
                                    innerCallback(null);
                            },
                            function (innerCallback) {
                                if (playersToUpdate && playersToUpdate.length > 0) {
                                    async.each(playersToUpdate, function (playerToUpdate, cbk4) {
                                        return playerToUpdate.save(cbk4);
                                    }, innerCallback);
                                }
                                else
                                    innerCallback(null);
                            }
                        ], function (parallelError, parallelResults) {
                            if (parallelError)
                                return callback(parallelError);

                            callback(null, teamsToAdd, teamsToUpdate, playersToAdd, playersToUpdate);
                        });

                    }
                    catch (err) {
                        return callback(err);
                    }



                    //callback(null, teamsToAdd, teamsToUpdate, playersToAdd, playersToUpdate);
                });

            });

        }); // competitionid: leagueId
    });
    */
};


var GetLeagueFromMongo = function (leagueId, callback) {
    mongoDb.competitions.findById(leagueId, function (error, competition) {
        if (error)
            return callback(error);

        if (!competition.parserids || !competition.parserids[Parser.Name])
            return callback(new Error('The selected competition (id:' + leagueId + ') does not have a valid ' + Parser.Name + ' parser id.'));

        callback(null, competition);
    });
};

Parser.UpdateLeagueStandings = function (competitionDocument, leagueId, season, outerCallback) {
    return callback(new Error('[Statscore parser]: Method (UpdateLeagueStandings) not implemented'));
}
/*
Parser.UpdateLeagueStandings = function (competitionDocument, leagueId, season, outerCallback) {
    leagueId = competitionDocument ? competitionDocument.id : leagueId;
    //statsLeagueId = competitionDocument.parserids[Parser.Name] || statsLeagueId;

    if (!leagueId)
        return outerCallback(new Error('No league id is defined in call'));

    // Schedule cascading callback functions: 
    // get competition, 
    // get teams for this competition and build a lookup dictionary
    // get standings for this competition and fill in team ids from lookup dictionary
    async.waterfall(
        [
            function (callback) {
                console.log("Starting standings waterfall");
                if (competitionDocument && competitionDocument.parserids && competitionDocument.parserids[Parser.Name])
                    return async.setImmediate(function () {
                        return callback(null, competitionDocument);
                    });
                GetLeagueFromMongo(leagueId, function (error, competition) {
                    if (error)
                        return callback(error);
                    return callback(null, competition);
                });
            },
            function (competition, callback) {
                var parserQuery = 'parserids.' + Parser.Name;
                mongoDb.teams.find().ne(parserQuery, null).where('competitionid', leagueId).exec(function (teamError, teams) {
                    if (teamError)
                        return callback(teamError);

                    var existingTeamIds = {};
                    _.forEach(teams, function (team) {
                        if (team.parserids[Parser.Name] && !existingTeamIds[team.parserids[Parser.Name]])
                            existingTeamIds[team.parserids[Parser.Name]] = team;
                    });

                    return callback(null, competition, existingTeamIds);
                });
            },
            function (competition, existingTeamIds, callback) {
                var statsLeagueId = competition.parserids[Parser.Name];
                Parser.GetLeagueStandings(statsLeagueId, season, function (error, standings, seasonYear) {
                    if (error)
                        return callback(error);

                    callback(null, competition, existingTeamIds, standings, seasonYear);
                });

            },
            function (competition, existingTeamIds, standings, seasonYear, callback) {
                mongoDb.standings.where('identity', Parser.Name).where('season', seasonYear).where('competitionid', competition.id).exec(function (error, standing) {
                    if (error)
                        return callback(error);

                    callback(null, competition, existingTeamIds, standings, seasonYear, standing ? standing[0] : null);
                });
            }
        ], function (error, competition, existingTeamIds, standings, seasonYear, standing) {
            if (error) {
                log.error(error);
                if (outerCallback)
                    return outerCallback(error);
            }

            if (!standings)
                if (outerCallback)
                    return outerCallback(null, null);

            // Translate the global properties and then iterate over the team properties inside the teams array.
            var newStandings = null;
            if (standing)
                newStandings = standing;
            else
                newStandings = new mongoDb.standings();

            newStandings.competitionid = leagueId;
            newStandings.name = competition.name;
            newStandings.identity = Parser.Name;
            newStandings.season = seasonYear;
            newStandings.teams = [];
            newStandings.lastupdate = new Date();


            standings.forEach(function (teamStanding) {
                if (existingTeamIds[teamStanding.teamId]) {
                    var team = {
                        rank: teamStanding.league.rank,
                        teamName: existingTeamIds[teamStanding.teamId].name,
                        teamId: existingTeamIds[teamStanding.teamId].id,
                        points: teamStanding.teamPoints,
                        pointsPerGame: teamStanding.teamPointsPerGame || "0",
                        penaltyPoints: teamStanding.penaltyPoints,
                        wins: teamStanding.record.wins,
                        losses: teamStanding.record.losses,
                        ties: teamStanding.record.ties,
                        gamesPlayed: teamStanding.record.gamesPlayed,
                        goalsFor: teamStanding.goalsFor.overall,
                        goalsAgainst: teamStanding.goalsAgainst.overall
                    };

                    newStandings.teams.push(team);
                }
            });

            //newStandings.teams.markModified();
            newStandings.save(function (err, data) {
                if (err)
                    return outerCallback(err);

                if (outerCallback)
                    outerCallback(null, leagueId);
            });
        });

};

Parser.UpdateStandings = function (season, callback) {

    let leagueStandingsUpdated = [];

    // Get all competitions from Mongo
    mongoDb.competitions.find({}, function (competitionError, leagues) {
        if (competitionError)
            return callback(competitionError, leagueStandingsUpdated);

        async.eachLimit(leagues, 1, function (league, cbk) {
            // Get all teams foreach competition
            setTimeout(function () {
                console.log("Requesting UpdateLeagueStandings for " + league.id);
                Parser.UpdateLeagueStandings(league, league.id, season, function (error, leagueid) {
                    if (error)
                        return cbk(error);
                    if (leagueid)
                        leagueStandingsUpdated.push(leagueid);
                    cbk();
                });
            }, 1000)
        }, function (asyncError) {
            if (asyncError)
                return callback(asyncError, leagueStandingsUpdated);

            callback(null, leagueStandingsUpdated);
        });
    });
};
*/

Parser.GetCompetitionFixtures = function (competitionId, seasonYear, outerCallback) {
    if (!competitionId)
        return outerCallback(new Error('No competition id parameter is included in the request.'));

    const season = seasonYear || Parser.GetSeasonYear();

    // Get competition from Mongo
    // Get teams from Mongo and build the team lookup dictionary
    // Get the fixtures
    // Filter the fixtures for the ones scheduled in the future, and return the results
    async.waterfall([
        function (callback) {
            return GetLeagueFromMongo(competitionId, callback);
        },
        function (competition, callback) {
            let parserQuery = 'parserids.' + Parser.Name;

            mongoDb.teams.find().ne(parserQuery, null).where('competitionid', competitionId).exec(function (teamError, teams) {
                if (teamError)
                    return callback(teamError);

                let existingTeamIds = {};
                _.forEach(teams, function (team) {
                    if (team.parserids[Parser.Name] && !existingTeamIds[team.parserids[Parser.Name]])
                        existingTeamIds[team.parserids[Parser.Name]] = team;
                });

                return callback(null, competition, existingTeamIds);
            });
        },
        function (competition, existingTeamIds, callback) {
            const competitionId = competition.parserids[Parser.Name].id;
            const seasonId = competition.parserids[Parser.Name].seasonid;

            if (!competitionId)
                return callback(new Error(`Missing competition id from competition\'s Statscore parserids`));
            if (!seasonId)
                return callback(new Error(`Missing seasonid from competition\'s Statscore parserids`));

            Parser.GetLeagueSeasonFixtures(competitionId, seasonId, function (error, fixtures) {
                if (error)
                    return callback(error);

                callback(null, competition, existingTeamIds, fixtures);
            });
        },
    ], function (asyncError, competition, existingTeamIds, fixtures) {
        if (asyncError)
            return outerCallback(asyncError);

        const now = new Date();
        //let futureFixtures = _.filter(fixtures, function (fixture) {
        //    if (!fixture.startDate || fixture.startDate.length < 2)
        //        return false;
        //    if (fixture.eventStatus.isActive)
        //        return false;

        //    const startDateString = fixture.startDate[1].full;
        //    const startDate = Date.parse(startDateString);

        //    return startDate > moment().subtract(5, 'h');
        //});

        var futureSchedules = _.map(fixtures, function (fixture) {
            try {
                let homeTeam, awayTeam;
                homeTeam = fixture.participants[0];
                awayTeam = fixture.participants[1];

                // If no statscore parserid is available for either home or away team found, then ignore this match since it can't be properly used for event feeding
                if (!existingTeamIds[homeTeam.id] || !existingTeamIds[awayTeam.id])
                    return null;

                let schedule = {
                    sport: 'soccer',
                    home_team: existingTeamIds[homeTeam.id] ? existingTeamIds[homeTeam.id].id : null,
                    away_team: existingTeamIds[awayTeam.id] ? existingTeamIds[awayTeam.id].id : null,
                    competitionId: competition.id,
                    competitionName: competition.name,
                    home_score: 0,
                    away_score: 0,
                    time: null,
                    parserids: {},
                    moderation: [],
                    start: moment.utc(fixture.start_date).toDate(),
                    state: 0
                };

                schedule.moderation.push({
                    type: 'rss-feed',
                    parsername: Parser.Name,
                    active: false,
                    parserid: fixture.id
                });
                //schedule.parserids[Parser.Name] = fixture.id;

                return schedule;
            }
            catch (err) {
                return;
            }
        });

        outerCallback(null, _.compact(futureSchedules));
    });
};

/*
// Approximate calculation of season Year from current date
var GetSeasonYear = function () {
    var now = new Date();
    if (now.getMonth() > 6)
        return now.getFullYear();
    else return now.getFullYear() - 1;
};
*/

Parser.UpdateTeamPlayersCareerStats = function (teamId, seasonYear, outerCallback) {
    return callback(new Error('[Statscore parser]: Method (UpdateTeamPlayersCareerStats) not implemented'));
}
/*
Parser.UpdateTeamPlayersCareerStats = function (teamId, seasonYear, outerCallback) {
    // Schedule the following cascading callbacks:
    // 1. Get the team from Mongo by the teamId
    // 2. Get the linked competition
    // 3. Get the team's linked players in mongo and build a dictionary of their ids as keys
    // 4. Call for each player having a valid parserids["Stats"] id, the stats endpoint for the player career stats
    // 5. Finally, update each player's document and save back in Mongo

    if (!seasonYear)
        seasonYear = GetSeasonYear();

    async.waterfall([
        function (callback) {
            return mongoDb.teams.findById(teamId, callback);
        },
        function (team, callback) {
            GetLeagueFromMongo(team.competitionid, function (error, competition) {
                if (error)
                    return callback(error);
                callback(null, team, competition);
            });
        },
        function (team, competition, callback) {
            mongoDb.players.find({ teamId: teamId }, function (error, data) {
                if (error)
                    return callback(error);

                let playersLookup = {};
                _.forEach(data, function (player) {
                    if (player.parserids && player.parserids[Parser.Name] && !playersLookup[player.parserids[Parser.Name]])
                        playersLookup[player.parserids[Parser.Name]] = player;
                });

                callback(null, team, competition, playersLookup);
            });
        }
    ], function (error, team, competition, playersLookup) {
        if (error)
            return outerCallback(error);


        let playerStatIds = _.keys(playersLookup);
        let updatedPlayerStats = 0;

        async.eachSeries(playerStatIds, function (playerId, innerCallback) {
            async.waterfall([
                // first waterfall step: get the player's stats while in the team
                function (callback) {
                    if (!team.parserids[Parser.Name])
                        async.setImmediate(function () {
                            callback(null);
                        });
                    // wait for .5 sec, to anticipate the service's throttling
                    setTimeout(function () {
                        Parser.GetPlayerInTeamStats(competition.parserids[Parser.Name], team.parserids[Parser.Name], playerId, function (statsError, stats) {
                            if (statsError) {
                                log.warn('Error while calling team GetPlayerInTeamStats for player %s', playerId);
                                return callback();
                            }

                            let playerDocInstance = playersLookup[playerId];
                            if (!playerDocInstance.stats)
                                playerDocInstance.stats = {};
                            playerDocInstance.stats["team"] = TranslatePlayerStats(stats);

                            callback(null);
                        });
                    }, 500);
                },
                // next waterfall step: get the player's career stats
                function (callback) {
                    // wait for .5 sec, to anticipate the service's throttling
                    setTimeout(function () {
                        Parser.GetPlayerStats(competition.parserids[Parser.Name], playerId, null, function (statsError, stats) {
                            if (statsError) {
                                log.warn('Error while calling career GetPlayerInTeamStats for player %s', playerId);
                                return callback();
                            }

                            let playerDocInstance = playersLookup[playerId];
                            if (!playerDocInstance.stats)
                                playerDocInstance.stats = {};
                            playerDocInstance.stats["career"] = TranslatePlayerStats(stats);

                            callback(null);
                        });
                    }, 500);
                },
                // next waterfall step: get the player's last season stats
                function (callback) {
                    // wait for .5 sec, to anticipate the service's throttling
                    setTimeout(function () {
                        Parser.GetPlayerStats(competition.parserids[Parser.Name], playerId, seasonYear, function (statsError, stats) {
                            if (statsError) {
                                log.warn('Error while calling season GetPlayerInTeamStats for player %s', playerId);
                                return callback();
                            }

                            let playerDocInstance = playersLookup[playerId];
                            if (!playerDocInstance.stats)
                                playerDocInstance.stats = {};
                            playerDocInstance.stats["season"] = TranslatePlayerStats(stats);

                            callback(null);
                        });
                    }, 500);
                },
            ],
                function (inneError) {
                    innerCallback();
                });
        }, function (outerError) {
            if (outerError)
                return outerCallback(outerError);

            // save all documents in playersLookup
            //     // Save playerDocInstance document back in Mongo
            //     playerDocInstance.save(innerCallback);
            //     updatedPlayerStats++;
            let allPlayers = _.values(playersLookup);
            _.forEach(allPlayers, function (onePlayer) {
                onePlayer.markModified('stats');
                onePlayer.save();
            });

            outerCallback(null, updatedPlayerStats);
        });

        //outerCallback(null, results);
    });
};
*/

// Execute all update functions that bring back team and player stats for a given competition and season
Parser.UpdateAllCompetitionStats = function (competitionId, season, outerCallback) {
    return callback(new Error('[Statscore parser]: Method (UpdateAllCompetitionStats) not implemented'));
}
/*
Parser.UpdateAllCompetitionStats = function (competitionId, season, outerCallback) {

    // TODO: We should check if next match date < Date.now and then call for stats update to team and players, otherwise it is not needed.
    var competitionTeams = [];
    var competition;
    var itsNow = moment.utc();
    async.waterfall(
        [
            function (callback) {
                mongoDb.competitions.findById(competitionId, function (error, comp) {
                    if (error)
                        return callback(error);
                    competition = comp;
                    callback(null);
                });
            },
            function (callback) {
                Parser.UpdateTeams(competitionId, function (error, teamsAdded, playersAdded, teamsUpdated, playersUpdated) {
                    if (error)
                        return callback(error);
                    callback(null);
                });
            },
            function (callback) {
                Parser.FindMongoTeamsInCompetition(competitionId, function (error, teams) {
                    if (error)
                        return callback(error);

                    // Filter teams for the ones that should be updated, the ones that their next match date has already passed.
                    competitionTeams = _.filter(teams, function (ateam) {
                        return (!ateam.nextmatch || !ateam.nextmatch.eventdate || moment.utc(ateam.nextmatch.eventdate).isBefore(itsNow));
                    });
                    callback(null);
                });
            },
            //function (callback) {
            //    if (!competition.parserids || !competition.parserids.Statscore)
            //        async.setImmediate(function () {
            //            callback(null);
            //        });
            //    else {
            //        log.info('Now on to updating team standings for competition %s', competition.name.en);
            //        Parser.UpdateLeagueStandings(competition, competition.id, season, function (standingsError) {
            //            callback(null);
            //        });
            //    }
            //},
            function (callback) {
                async.eachSeries(competitionTeams, function (team, innerCallback) {
                    return Parser.UpdateTeamPlayersCareerStats(team.id, season, innerCallback);
                }, function (seriesError) {
                    if (seriesError)
                        log.error(seriesError.message);
                    //return callback(seriesError);
                    callback(null);
                });
            },
            function (callback) {
                //return Parser.UpdateCompetitionTeamsStats(competitionId, season, callback);
                async.eachSeries(competitionTeams, function (team, cbk) {
                    setTimeout(function () {
                        Parser.UpdateTeamStats(competition.parserids[Parser.Name], team.parserids[Parser.Name], season, function (teamError, updateOutcome) {
                            if (teamError)
                                log.error(teamError.message);
                            cbk(null);
                        })
                    }, 1000);
                }, function (seriesErr) {
                    if (seriesErr)
                        log.error(seriesErr.message);

                    callback(null);
                });

            },
            function (callback) {
                async.eachSeries(competitionTeams, function (team, innerCallback) {
                    if (!competition.parserids || !team.parserids || !competition.parserids.Statscore || !team.parserids.Statscore)
                        async.setImmediate(function () {
                            innerCallback(null);
                        });
                    else {
                        log.info('Now on to updating full stats for team %s', team.name.en);

                        Parser.UpdateTeamStatsFull(competition.parserids.Statscore, team.parserids.Statscore, season, function (teamStatsError) {
                            innerCallback(null);
                        });

                    }
                }, callback);
            }
        ], function (error) {
            if (error) {
                log.error('Error while updating all stats for competition %s and season %d: %s', competitionId, season, error.message);
                return outerCallback(error);
            }
            outerCallback(null);
        });
};


Parser.TestGuruStats = function (callback) {
    mongoDb.scheduled_matches.findById('57ea626c7b588100f9d9551c', function (err, match) {
        if (err)
            return callback(err);
        return Parser.UpdateGuruStats(match, callback);
    });
};
*/

// Used properties from scheduledMatch: competition, home_team, away_team
Parser.UpdateGuruStats = function (scheduledMatch, outerCallback) {
    return callback(new Error('[Statscore parser]: Method (UpdateGuruStats) not implemented'));
}
/*
Parser.UpdateGuruStats = function (scheduledMatch, outerCallback) {
    if (
        //!scheduledMatch.moderation || scheduledMatch.moderation.length == 0 || !scheduledMatch.moderation[0].parserid
        !scheduledMatch.home_team || !scheduledMatch.away_team)
        return outerCallback(null);

    //let parserid = scheduledMatch.moderation[0].parserid;
    let competitionid = scheduledMatch.competition;
    let homeTeamId = scheduledMatch.home_team;
    let awayTeamId = scheduledMatch.away_team;

    let leagueName;
    let homeTeamParserId, awayTeamParserId;
    let season;
    // Get competition parser id, and the parser ids from the 2 teams
    async.parallel([
        function (callback) {
            mongoDb.competitions.findById(competitionid, 'parserids season', function (compError, competition) {
                if (compError)
                    return callback(compError);
                leagueName = competition.parserids[Parser.Name];
                season = competition.season;
                callback(null, leagueName);
            });
        },
        function (callback) {
            mongoDb.teams.findById(homeTeamId, 'parserids', function (teamError, team) {
                if (teamError)
                    return callback(teamError);

                if (team.parserids && team.parserids[Parser.Name])
                    homeTeamParserId = team.parserids[Parser.Name];

                callback(null, homeTeamParserId);
            });
        },
        function (callback) {
            mongoDb.teams.findById(awayTeamId, 'parserids', function (teamError, team) {
                if (teamError)
                    return callback(teamError);

                if (team.parserids && team.parserids[Parser.Name])
                    awayTeamParserId = team.parserids[Parser.Name];
                callback(null, awayTeamParserId);
            });
        }
    ], function (error) {
        if (error)
            return outerCallback(error);
        if (!homeTeamParserId || !awayTeamParserId)
            return outerCallback();

        async.parallel([
            function (callback) {
                return Parser.GetTeamSeasonFixtures(leagueName, homeTeamParserId, season, callback);
            },
            function (callback) {
                setTimeout(function () {
                    return Parser.GetTeamSeasonFixtures(leagueName, awayTeamParserId, season, callback);
                }, 400);
            }
        ], function (innerError, results) {
            if (innerError)
                return outerCallback(innerError);

            let cutOffTime = moment.utc().add(3, 'hours');

            let homeTeamMatches = _.take(_.orderBy(_.filter(results[0], function (result) { return cutOffTime.isAfter(moment.utc(result.startDate[1].full)); }), ['startDate[1].full'], ['desc']), 10);
            let awayTeamMatches = _.take(_.orderBy(_.filter(results[1], function (result) { return cutOffTime.isAfter(moment.utc(result.startDate[1].full)); }), ['startDate[1].full'], ['desc']), 10);
            let homeTeamMatchParserIds = _.map(homeTeamMatches, 'eventId');
            let awayTeamMatchParserIds = _.map(awayTeamMatches, 'eventId');

            let interestingEventIds = [2, 5, 11, 20];
            // "2": "Yellow",
            // "5": "Corner",
            // "7": "Red",
            // "8": "Foul",
            // "11": "Goal",
            // "14": "Injury",
            // "16": "Offside",
            // "17": "Penalty",
            // "18": "Penalty",
            // "20": "Shot_on_Goal",
            // // "22": "Substitution",
            // "28": "Own_Goal"

            let guruStats = {
                Yellow: {
                    homeTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    awayTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    total: [0, 0, 0, 0, 0, 0, 0, 0, 0]
                },
                Corner: {
                    homeTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    awayTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    total: [0, 0, 0, 0, 0, 0, 0, 0, 0]
                },
                Goal: {
                    homeTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    awayTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    total: [0, 0, 0, 0, 0, 0, 0, 0, 0]
                },
                Shot_On_Goal: {
                    homeTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    awayTeam: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    total: [0, 0, 0, 0, 0, 0, 0, 0, 0]
                }
            };

            let homeTeamMatchesCount = 0;
            let awayTeamMatchesCount = 0;
            // first dimension is 0 for the total stats for both teams, 1 for home team, 2 for away team.
            // second dimension is the 10 minutes match period.
            // each cell holds the average per event type (0 for Yellow, 1 for Corner, 2 for Goal, 3 for Shot on Goal)
            let index = 0;
            async.series([
                function (s1cbk) {
                    async.each(homeTeamMatchParserIds, function (parserId, callback) {
                        setTimeout(function () {
                            Parser.GetMatchEvents(leagueName, parserId, function (err, events, teams, matchStatus) {
                                if (err) {
                                    log.warn(err.message + '\nError while getting match %s events while computing Guru stats. Continuing with next one...', parserId);
                                    return callback(null);
                                }

                                homeTeamMatchesCount++;
                                let interestingEvents = _.filter(events, function (event) {
                                    return _.indexOf(interestingEventIds, event.playEvent.playEventId) > -1 && (event.teamId == homeTeamParserId);
                                });
                                _.forEach(interestingEvents, function (event) {
                                    if (!event.time || !event.time.minutes)
                                        return;

                                    let timeIndex = event.time.minutes >= 90 ? 8 : Math.floor(event.time.minutes / 10);

                                    switch (event.playEvent.playEventId) {
                                        case 2:
                                            if (!guruStats.Yellow.homeTeam[timeIndex])
                                                guruStats.Yellow.homeTeam[timeIndex] = 1;
                                            else
                                                guruStats.Yellow.homeTeam[timeIndex]++;
                                            break;
                                        case 5:
                                            if (!guruStats.Corner.homeTeam[timeIndex])
                                                guruStats.Corner.homeTeam[timeIndex] = 1;
                                            else
                                                guruStats.Corner.homeTeam[timeIndex]++;
                                            break;
                                        case 11:
                                            if (!guruStats.Goal.homeTeam[timeIndex])
                                                guruStats.Goal.homeTeam[timeIndex] = 1;
                                            else
                                                guruStats.Goal.homeTeam[timeIndex]++;
                                            break;
                                        case 20:
                                            if (!guruStats.Shot_On_Goal.homeTeam[timeIndex])
                                                guruStats.Shot_On_Goal.homeTeam[timeIndex] = 1;
                                            else
                                                guruStats.Shot_On_Goal.homeTeam[timeIndex]++;
                                            break;
                                    }
                                });
                                callback(null);
                            });
                        }, index++ * 500);
                    }, s1cbk);
                },
                function (s2cbk) {
                    index = 0;
                    async.each(awayTeamMatchParserIds, function (parserId, callback) {
                        setTimeout(function () {
                            Parser.GetMatchEvents(leagueName, parserId, function (err, events, teams, matchStatus) {
                                if (err) {
                                    log.warn(err.message + '\nError while getting match %s events while computing Guru stats. Continuing with next one...', parserId);
                                    return callback(null);
                                }

                                awayTeamMatchesCount++;
                                let interestingEvents = _.filter(events, function (event) {
                                    return _.indexOf(interestingEventIds, event.playEvent.playEventId) > -1 && (event.teamId == awayTeamParserId);
                                });
                                _.forEach(interestingEvents, function (event) {
                                    if (!event.time || !event.time.minutes)
                                        return;

                                    let timeIndex = event.time.minutes >= 90 ? 8 : Math.floor(event.time.minutes / 10);

                                    switch (event.playEvent.playEventId) {
                                        case 2:
                                            if (!guruStats.Yellow.awayTeam[timeIndex])
                                                guruStats.Yellow.awayTeam[timeIndex] = 1;
                                            else
                                                guruStats.Yellow.awayTeam[timeIndex]++;
                                            break;
                                        case 5:
                                            if (!guruStats.Corner.awayTeam[timeIndex])
                                                guruStats.Corner.awayTeam[timeIndex] = 1;
                                            else
                                                guruStats.Corner.awayTeam[timeIndex]++;
                                            break;
                                        case 11:
                                            if (!guruStats.Goal.awayTeam[timeIndex])
                                                guruStats.Goal.awayTeam[timeIndex] = 1;
                                            else
                                                guruStats.Goal.awayTeam[timeIndex]++;
                                            break;
                                        case 20:
                                            if (!guruStats.Shot_On_Goal.awayTeam[timeIndex])
                                                guruStats.Shot_On_Goal.awayTeam[timeIndex] = 1;
                                            else
                                                guruStats.Shot_On_Goal.awayTeam[timeIndex]++;
                                            break;
                                    }
                                });
                                callback(null);
                            });
                        }, index++ * 500);
                    }, s2cbk);
                }
            ], function (seriesError) {
                if (seriesError) {
                    //log.error('Failed to save Guru stats due to: %s', seriesError.message);
                    return outerCallback(seriesError);
                }

                // Calc totals and averages
                for (let i = 0; i < 9; i++) {
                    guruStats.Yellow.total[i] = (guruStats.Yellow.homeTeam[i] + guruStats.Yellow.awayTeam[i]);
                    guruStats.Corner.total[i] = (guruStats.Corner.homeTeam[i] + guruStats.Corner.awayTeam[i]);
                    guruStats.Goal.total[i] = (guruStats.Goal.homeTeam[i] + guruStats.Goal.awayTeam[i]);
                    guruStats.Shot_On_Goal.total[i] = (guruStats.Shot_On_Goal.homeTeam[i] + guruStats.Shot_On_Goal.awayTeam[i]);
                }

                mongoDb.scheduled_matches.update({ _id: scheduledMatch._id }, { guruStats: guruStats }, function (updateError) {
                    if (updateError)
                        return outerCallback(updateError);

                    outerCallback(null, guruStats);
                });
            }
            );

        });

    });
};
*/

var TranslatePlayerStats = function (stats) {
    return {
        gamesPlayed: stats ? stats.gamesPlayed : 0,
        gamesStarted: stats ? stats.gamesStarted : 0,
        minutesPlayed: stats ? stats.minutesPlayed : 0,
        goalsTotal: stats && stats.goals && stats.goals.total ? stats.goals.total : 0,
        goalsGameWinning: stats && stats.goals && stats.goals.gameWinning ? stats.goals.gameWinning : 0,
        goalsOwn: stats && stats.goals && stats.goals.goalsOwn ? stats.goals.goalsOwn : 0,
        goalsHeaded: stats && stats.goals && stats.goals.headed ? stats.goals.headed : 0,
        goalsKicked: stats && stats.goals && stats.goals.kicked ? stats.goals.kicked : 0,
        assistsTotal: stats && stats.assists && stats.assists.total ? stats.assists.total : 0,
        assistsGameWinning: stats && stats.assists && stats.assists.gameWinning ? stats.assists.gameWinning : 0,
        shots: stats ? stats.shots : 0,
        shotsOnGoal: stats ? stats.shotsOnGoal : 0,
        crosses: stats ? stats.crosses : 0,
        penaltyKicksShots: stats && stats.penaltyKicks && stats.penaltyKicks.shots ? stats.penaltyKicks.shots : 0,
        penaltyKicksGoals: stats && stats.penaltyKicks && stats.penaltyKicks.goals ? stats.penaltyKicks.goals : 0,
        foulsCommitted: stats ? stats.foulsCommitted : 0,
        foulsSuffered: stats ? stats.foulsSuffered : 0,
        yellowCards: stats ? stats.yellowCards : 0,
        redCards: stats ? stats.redCards : 0,
        offsides: stats ? stats.offsides : 0,
        cornerKicks: stats ? stats.cornerKicks : 0,
        clears: stats ? stats.clears : 0,
        goalMouthBlocks: stats ? stats.goalMouthBlocks : 0,
        touchesTotal: stats && stats.touches && stats.touches.total ? stats.touches.total : 0,
        touchesPasses: stats && stats.touches && stats.touches.passes ? stats.touches.passes : 0,
        touchesInterceptions: stats && stats.touches && stats.touches.interceptions ? stats.touches.interceptions : 0,
        touchesBlocks: stats && stats.touches && stats.touches.blocks ? stats.touches.blocks : 0,
        tackles: stats ? stats.tackles : 0,
        attacks: stats ? stats.attacks : 0,
        overtimeShots: stats && stats.overtime && stats.overtime.shots ? stats.overtime.shots : 0,
        overtimeGoals: stats && stats.overtime && stats.overtime.goals ? stats.overtime.goals : 0,
        overtimeAssists: stats && stats.overtime && stats.overtime.assists ? stats.overtime.assists : 0,
        suspensions: stats ? stats.suspensions : 0
    };
};

// TODO: Team stat names should be the same as the events referenced through out the game.
var TranslateTeamStats = function (stats) {
    return {
        gamesPlayed: stats && stats.gamesPlayed ? stats.gamesPlayed : 0,
        Goal: stats && stats.goals.total ? stats.goals.total : 0,
        Shot_On_Goal: stats && stats.shotsOnGoal ? stats.shotsOnGoal : 0,
        Crosses: stats && stats.crosses ? stats.crosses : 0,
        Penalty: stats && stats.penaltyKicks && stats.penaltyKicks.shots ? stats.penaltyKicks.shots : 0,
        Foul: stats && stats.foulsCommitted ? stats.foulsCommitted : 0,
        Yellow: stats && stats.yellowCards ? stats.yellowCards : 0,
        Red: stats && stats.redCards ? stats.redCards : 0,
        Offside: stats && stats.offsides ? stats.offsides : 0,
        Corner: stats && stats.cornerKicks ? stats.cornerKicks : 0,
        Clear: stats && stats.clears ? stats.clears : 0
    };
};


module.exports = Parser;

