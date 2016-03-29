'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

if (mongoose.models.standings)
    module.exports = mongoose.models.standings;
else {
    var standing = {
        identity: { type: String, required: true, unique: true },
        season: {type: Number, required: true},
        competitionid: { type: String, ref: 'competitions' },
        name: { type: Schema.Types.Mixed, required: true },
        teams: [{ type: Schema.Types.Mixed }],
        visiblein: [{ type: Schema.Types.Mixed}],
        parserids: { type: Array },
        created: {type:Date, default:Date.now},
        lastupdate: {type:Date, default:Date.now}
    };
    
    var standingSchema = new Schema(standing);
    
    module.exports = mongoose.model('standings', standingSchema);
}