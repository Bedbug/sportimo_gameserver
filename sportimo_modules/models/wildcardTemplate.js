/**
 * Wildcard Model
 *
 * @description :: Mongoose model schema for a wildcard
 * 
 */
// the wildcardTemplate is a abstract template for a wildcard or for a userWildcard. It is not related with a specific match, its instantiations (through the widcard model or the userWildcard model) do.

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

if (mongoose.models.wildcardTemplate)
    module.exports = mongoose.models.wildcardTemplate;
else {
    var wildcardTemplate = new mongoose.Schema({
        text: Schema.Types.Mixed, // text template with placeholders: [[player]] for player name, [[team]] for team name
        // Trigger specifications
        activationLatency: Number, // seconds between the wildcard's creation and activation
        duration: Number,   // seconds between the wildcard's activation and termination
        conditionsToAppear: [Schema.Types.Mixed], // the wildcard will appear (start its lifetime in a pending state 0) when all the conditionsToAppear are met.
        winConditions: [Schema.Types.Mixed], // the wildcard wins when all win conditions are met
        terminationConditions: [Schema.Types.Mixed], // the wildcard is terminated when any of the terminationConditions is met, or the duration is over (if not null).
        // Awarded points specs
        pointStep: Number,
        minPoints: Number,
        maxPoints: Number
    });
    
    module.exports = mongoose.model("wildcardTemplates", wildcardTemplate);
}
