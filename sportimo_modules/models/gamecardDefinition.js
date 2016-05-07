// wildcard is a definition that the moderator (manual or automatic) creates, to be played by users. It is not related with wildcards in play, this is handled by the userWildcard model.

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    moment = require('moment');

if (mongoose.models.gamecardDefinitions)
    module.exports = mongoose.models.gamecardDefinitions;
else {
    
    var optionDefinition = new mongoose.Schema({
       optionId: String,
       text: Schema.Types.Mixed,
       startPoints: Number,
       endPoints: Number,
       pointsPerMinute: Number,
       activationLatency: Number,
       duration: Number,
       winConditions: [Schema.Types.Mixed],
       terminationConditions: [Schema.Types.Mixed]
    });
    
    var gamecardDefinition = new mongoose.Schema({
        matchid: String,
        gamecardTemplateId: String, // reference to the gamecard template that this definition represents, optional
        text: Schema.Types.Mixed,
        // Trigger specifications
        activationLatency: Number,
        duration: Number,  // instant gamecards only;
        appearConditions: [Schema.Types.Mixed],
        winConditions: [Schema.Types.Mixed],
        terminationConditions: [Schema.Types.Mixed], // when a played card is terminated and pending resolution before put out of play
        options: [optionDefinition], // mainly instant gamecards
        // Specs for awarding points to winning cards
        pointsPerMinute: Number,  // overall gamecards only; the rate by which the startPoints get increased or decreased in time
        startPoints: Number,
        endPoints: Number,
        // States and state times
        cardType: { type: String, enum: ['Instant', 'Overall']},
        maxUserInstances: Number,   // maximum number of times a user may play this card
        creationTime: Date,
        activationTime: Date,
        terminationTime: Date,
        isVisible: { type: Boolean, default: true }, // overall cards only; true if it can appear on clients' list of gamecard, false if it can't
        status: 0  // 0: pending activation, 1: active, 2: terminated (dead)
    });
    
    
    gamecardDefinition.pre('save', function(next){
        let now = moment.utc();
    
        if (this.status == 0)   // auto-set times only if this is a new instance
        {
            if (!this.creationTime)
                this.creationTime = now.toDate();
            if (!this.activationTime)
                this.activationTime = now.add(this.activationLatency, 'ms').toDate(); // add activates_in seconds
            if (!this.terminationTime)
                this.terminationTime = now.add(this.activationLatency, 'ms').add(this.duration, 'ms').toDate();
        }
      
        next();
    });
    
    module.exports = mongoose.model("gamecardDefinitions", gamecardDefinition);
}