'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

if (mongoose.models.scheduled_matches)
  module.exports = mongoose.models.scheduled_matches;
else {

  var matchEvent = new mongoose.Schema({
    id: Number,
    match_id: String,
    type: String,
    stats: mongoose.Schema.Types.Mixed,
    playerscount: Number,
    status: String,
    timeline_event: Boolean,
    state: Number,
    sender: String,
    time: Number,
    team: String,
    complete: Boolean,
    playerSelected: String,
    players: [mongoose.Schema.Types.Mixed],
    linked_mods: [
      {
        type: String,
        ref: 'statsMod'
      }
    ]
  });

  var segment = new mongoose.Schema({
    start: Date,
    // The time in sport time that this segment starts e.g. 46' for second half
    sport_start_time: Number,
    end: Date,
    // time duration that the segment was on hold
    break_duration: Number,
    events: [matchEvent]
  });

  var moderationService = new mongoose.Schema({
    type: String,
    parserid: String,
    parsername: String,
    status: Boolean
  })

  var match_schema = new mongoose.Schema({
    sport: String,
    home_team: {
      type: String,
      ref: 'teams'
    },
    away_team: {
      type: String,
      ref: 'teams'
    },
    start: Date,
    color: String,
    competition: {
      type: String,
      ref: 'competitions'
    },
    visiblein: [String],
    isTimeCounting: { type: Boolean, default: false },
    home_score: Number,
    away_score: Number,
    match_date: Date,
    time: String,
    state: Number,
    stats: mongoose.Schema.Types.Mixed,
    timeline: [segment],
    settings: mongoose.Schema.Types.Mixed,
    moderation: [moderationService],
    parserids: mongoose.Schema.Types.Mixed
  }, {
      collection: 'scheduled_matches',
      minimize: false
    });

  module.exports = mongoose.model("scheduled_matches", match_schema);
}