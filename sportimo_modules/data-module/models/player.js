'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    l = require('../config/lib');

var player = {
    name: { type: Schema.Types.Mixed },
    team: {
        type: String,
        ref: 'team'
    },
	pic: { type: String },
    created: { type: Date, default: Date.now }
};

var playerSchema = new Schema(player);

module.exports = mongoose.model('player', playerSchema);
