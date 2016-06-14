'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

if (mongoose.models.scheduled_matches)
  module.exports = mongoose.models.scheduled_matches;
else {

  var matchEvent = new mongoose.Schema({
    match_id: String,
    type: String,
    stats: mongoose.Schema.Types.Mixed,
    headtohead: [String],
    playerscount: Number,
    status: String,
    timeline_event: Boolean,
    state: Number,
    sender: String,
    time: Number,
    team: String,
    team_id: String,
    complete: Boolean,
    playerSelected: String,
    players: [mongoose.Schema.Types.Mixed],
    linked_mods: [
      {
        type: String,
        ref: 'statsMod'
      }
    ],
    created: { type: Date, default: Date.now }
  });

  var segment = new mongoose.Schema({
    start: Date,
    // The time in sport time that this segment starts e.g. 46' for second half
    sport_start_time: Number,
    end: Date,
    timed: Boolean,
    text: mongoose.Schema.Types.Mixed,
    // time duration that the segment was on hold
    break_duration: Number,
    events: [matchEvent]
  });


  var moderationService = new mongoose.Schema({
    type: String,
    parserid: String,
    parsername: String,
    parsed_eventids: [String],
    active: Boolean,
    interval: Number
  })

  var match_schema = new mongoose.Schema({
    sport: {type:String, default:'soccer'},
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
    home_score: {type:Number, default:0},
    away_score: {type:Number, default:0},
    match_date: Date,
    time: {type:Number, default:0},
    state: {type:Number, default:0},
    completed: {type: Boolean, default: false},
    stats: [mongoose.Schema.Types.Mixed],
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