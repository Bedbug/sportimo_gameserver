'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


if (mongoose.models.competition)
    module.exports = mongoose.model.competition;
else {
var competition = {
    name: { type: Schema.Types.Mixed },
    pic: { type: String },
    parserids: {  type: Schema.Types.Mixed }
};

var competitionSchema = new Schema(competition);

module.exports = mongoose.model('competitions', competitionSchema);
}