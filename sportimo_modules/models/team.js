'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


if (mongoose.models.teams)
    module.exports = mongoose.models.teams;
else {
    var team = {
        name: { type: Schema.Types.Mixed },
        // No need for short_name property. The abbreviation should be a key 'short' in the 'name' object property
        // that will hold the short name value.
        // short_name: { type: String },
        logo: { type: String },
        color: { type: String },
        stats: { type: Schema.Types.Mixed },
        parserids: {  type: Schema.Types.Mixed },
        competitionid: { type: String, ref: 'competitions' },
        created: { type: Date, default: Date.now }
    };
    
    var teamSchema = new Schema(team);
    
    module.exports = mongoose.model('teams', teamSchema);
}
