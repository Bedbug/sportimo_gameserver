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

if (mongoose.models.gamecardTemplates)
    module.exports = mongoose.models.gamecardTemplates;
else {
    var optionTemplate = new mongoose.Schema({
       optionId: String,
       startPoints: Number,
       endPoints: Number,
       pointsPerMinute: Number,
       activationLatency: Number,
       duration: Number,
       winConditions: [Schema.Types.Mixed],
       terminationConditions: [Schema.Types.Mixed]
    }, { _id : false });

    
    var gamecardTemplate = new mongoose.Schema({
        title: Schema.Types.Mixed, // card title
        image: Schema.Types.Mixed, // icon image
        text: Schema.Types.Mixed, // text template with placeholders: [[player]] for player name, [[team]] for team name
        // Trigger specifications
        activationLatency: Number, // seconds between the wildcard's creation and activation
        duration: Number,   // seconds between the wildcard's activation and termination
        appearConditions: [Schema.Types.Mixed], // the wildcard will appear (start its lifetime in a pending state 0) when all the conditionsToAppear are met.
        winConditions: [Schema.Types.Mixed], // the wildcard wins when all win conditions are met
        terminationConditions: [Schema.Types.Mixed], // the wildcard is terminated when any of the terminationConditions is met, or the duration is over (if not null).
        options: [optionTemplate],
        // Awarded points specs
        pointsPerMinute: Number,
        startPoints: Number,
        endPoints: Number,
        cardType: { type: String, enum: ['Instant', 'Overall']},
    });
    
    module.exports = mongoose.model("gamecardTemplates", gamecardTemplate);
}
