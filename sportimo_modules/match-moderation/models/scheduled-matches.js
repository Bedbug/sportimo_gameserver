'use strict';

var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;


var matchevent = new mongoose.Schema({
  type: String,
  time: Number,
  data: mongoose.Schema.Types.Mixed,
  created: Date
});

var match_schema = new mongoose.Schema({
  sport: String,
  home_team: {
    type: String,
    ref: 'team'
  },
  away_team: {
    type: String,
    ref: 'team'
  },
  start: Date,
  competition: String,
  home_score: Number,
  away_score: Number,
  match_date: Date,
  time: String,
  state: Number,
  stats: mongoose.Schema.Types.Mixed,
  timeline: [mongoose.Schema.Types.Mixed],
  settings: mongoose.Schema.Types.Mixed,
  moderation: [mongoose.Schema.Types.Mixed]
}, {
    collection: 'scheduled_matches',
    minimize: false
  });
  
module.exports = mongoose.model("scheduled_matches", match_schema);