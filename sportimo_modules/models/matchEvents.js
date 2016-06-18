'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var matchevent = new mongoose.Schema({
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
    team_id: String,
    complete: Boolean,
    playerSelected: String,
    extrainfo: String,
    players: [mongoose.Schema.Types.Mixed],
    linked_mods: [
      {
        type: String,
        ref: 'statsMod'
      }
    ],
    created: { type: Date, default: Date.now }
  });

  
  
  module.exports = mongoose.model("matchEvents", matchevent);
