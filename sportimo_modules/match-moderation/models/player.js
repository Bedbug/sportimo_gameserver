'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


if (mongoose.models.player)
    module.exports = mongoose.model.player;
else {
var player = {
    firstName: { type: Schema.Types.Mixed },
    firstName_en: { type: String },
    lastName: { type: Schema.Types.Mixed },
    lastName_en: { type: String },
    uniformNumber : { type: String },
    pic: { type: String },
    position: { type: String },
    personalData: { type: Schema.Types.Mixed },
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