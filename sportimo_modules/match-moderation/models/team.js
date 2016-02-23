'use strict';

var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;


var team_schema = new mongoose.Schema({
  name: String,
  logo: String,
  name_en: String,
  league: String
});

module.exports = mongoose.model("team", team_schema);
