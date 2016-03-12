'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


if (mongoose.models.player)
    module.exports = mongoose.model.player;
else {
var player = {
    name: { type: Schema.Types.Mixed },
    name_en: { type: String },
    pic: { type: String },
    position: { type: String },
    parserids: {  type: Schema.Types.Mixed },
    team: [{
        type: String,
        ref: 'team'
    }],
    created: { type: Date, default: Date.now }
};

var playerSchema = new Schema(player);

module.exports = mongoose.model('players', playerSchema);
}