'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    l = require('../config/lib');


if (mongoose.models.team)
    module.exports = mongoose.model.team;
else {
var team = {
    name: [{ lang: String, text: String }],
    name_en: { type: String },
    logo: { type: String },
    league: { type: String },
    parser: { type: Array },
    players: [{
        type: String,
        ref: 'player'
    }],
    created: { type: Date, default: Date.now }
};

var teamSchema = new Schema(team);

module.exports = mongoose.model('team', teamSchema);
}