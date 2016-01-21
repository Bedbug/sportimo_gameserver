'use strict';

var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;


var team_schema = new mongoose.Schema({
  name: String,
  logo: String,
  players: [{
    type: Number,
    ref: 'player'
  }]
});

module.exports = mongoose.model("team", team_schema);
