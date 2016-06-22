'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;
  
if (mongoose.models.gameserversettings)
    module.exports = mongoose.models.gameserversettings;
else {
    var gameServerSetting = new mongoose.Schema({
        scheduledTasks: [{
                competitionId: String,
                season: String,
                cronPattern: String
        }]
    });

    module.exports = mongoose.model("gameserversettings", gameServerSetting);
}